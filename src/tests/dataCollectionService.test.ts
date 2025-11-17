import { vi } from "vitest";
import { DataCollectionService } from "../services/dataCollection";
import type { StatsStorage } from "../services/statsStorage";
import { VIEW_TYPE_COUNT_NOVEL } from "../utils/constants";
import type { TFile } from "obsidian";

class StatsStorageMock implements Partial<StatsStorage> {
	getLastTotalCharacterCount = vi.fn().mockResolvedValue(0);
	saveLastTotalCharacterCount = vi.fn().mockResolvedValue(undefined);
	updateDailyStats = vi.fn().mockResolvedValue(undefined);
	updateHourlyStats = vi.fn().mockResolvedValue(undefined);
}

type ServiceOptions = {
	files?: TFile[];
	caches?: Record<string, any>;
	fileContents?: Record<string, string>;
	leaves?: Array<{ view: any }>;
	trackingTag?: string;
};

const createService = (options: ServiceOptions = {}) => {
	const files = options.files ?? [];
	const caches = options.caches ?? {};
	const fileContents = options.fileContents ?? {};
	const leaves = options.leaves ?? [];
	const pluginMock = {
		settings: { trackingTag: options.trackingTag ?? "novel" },
		app: {
			vault: {
				getMarkdownFiles: vi.fn().mockReturnValue(files),
				cachedRead: vi.fn((file: TFile) =>
					Promise.resolve(fileContents[file.path] ?? "")
				),
			},
			metadataCache: {
				getFileCache: vi.fn((file: TFile) => caches[file.path]),
			},
			workspace: {
				iterateAllLeaves: vi.fn((callback: (leaf: any) => void) => {
					leaves.forEach((leaf) => callback(leaf));
				}),
			},
		},
	};

	const statsStorage = new StatsStorageMock();
	const service = new DataCollectionService(pluginMock as any, statsStorage as any);

	return { service, statsStorage, plugin: pluginMock };
};

const createTFile = (path: string): TFile => ({ path } as TFile);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("DataCollectionService.collectData", () => {
	const mockDate = new Date("2025-10-02T12:00:00Z");

	beforeAll(() => {
		vi.useFakeTimers().setSystemTime(mockDate);
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	test("records positive differences", async () => {
		const { service, statsStorage } = createService();
		statsStorage.getLastTotalCharacterCount.mockResolvedValueOnce(1000);
		const calcSpy = vi
			.spyOn(service as any, "calculateTotalCharacterCount")
			.mockResolvedValueOnce(1500);
		const refreshSpy = vi
			.spyOn(service as any, "refreshViews")
			.mockImplementation(() => undefined);

		await service.collectData();

		expect(calcSpy).toHaveBeenCalled();
		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(1500);
		expect(statsStorage.updateDailyStats).toHaveBeenCalledWith("2025-10-02", 500);
		expect(statsStorage.updateHourlyStats).toHaveBeenCalledWith("2025-10-02", 500);
		expect(refreshSpy).toHaveBeenCalled();
	});

	test("records negative differences to roll back counts", async () => {
		const { service, statsStorage } = createService();
		statsStorage.getLastTotalCharacterCount.mockResolvedValueOnce(2000);
		vi.spyOn(service as any, "calculateTotalCharacterCount").mockResolvedValueOnce(500);
		const refreshSpy = vi
			.spyOn(service as any, "refreshViews")
			.mockImplementation(() => undefined);

		await service.collectData();

		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(500);
		expect(statsStorage.updateDailyStats).toHaveBeenCalledWith("2025-10-02", -1500);
		expect(statsStorage.updateHourlyStats).toHaveBeenCalledWith("2025-10-02", -1500);
		expect(refreshSpy).toHaveBeenCalled();
	});

	test("skips updates when there is no difference", async () => {
		const { service, statsStorage } = createService();
		statsStorage.getLastTotalCharacterCount.mockResolvedValueOnce(800);
		vi.spyOn(service as any, "calculateTotalCharacterCount").mockResolvedValueOnce(800);
		const refreshSpy = vi
			.spyOn(service as any, "refreshViews")
			.mockImplementation(() => undefined);

		await service.collectData();

		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(800);
		expect(statsStorage.updateDailyStats).not.toHaveBeenCalled();
		expect(statsStorage.updateHourlyStats).not.toHaveBeenCalled();
		expect(refreshSpy).not.toHaveBeenCalled();
	});
});

describe("DataCollectionService tag discovery", () => {
	test("filters files by inline and frontmatter tags", async () => {
		const inline = createTFile("inline.md");
		const frontmatter = createTFile("front.md");
		const other = createTFile("other.md");
		const caches = {
			[inline.path]: { tags: [{ tag: "#novel" }] },
			[frontmatter.path]: { frontmatter: { tags: ["novel"] } },
			[other.path]: {},
		};
		const { service } = createService({
			files: [inline, frontmatter, other],
			caches,
		});

		const files = await service.findFilesWithTag("novel");
		expect(files).toEqual([inline, frontmatter]);
	});

	test("logs warning when tag is invalid", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { service } = createService();

		const files = await service.findFilesWithTag("  ");
		expect(files).toEqual([]);
	});
});

describe("DataCollectionService character counting", () => {
	test("strips frontmatter before counting characters", async () => {
		const target = createTFile("target.md");
		const content = "---\ntags: [novel]\n---\n本文テキスト";
		const { service } = createService({
			fileContents: { [target.path]: content },
		});

		const length = await service.countCharactersInFile(target as any);
		expect(length).toBe("本文テキスト".length);
	});

	test("returns 0 when file read fails", async () => {
		const target = createTFile("broken.md");
		const { service, plugin } = createService();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		(plugin.app.vault.cachedRead as any).mockRejectedValueOnce(
			new Error("boom")
		);

		const length = await service.countCharactersInFile(target as any);
		expect(length).toBe(0);
	});
});

describe("DataCollectionService total calculation", () => {
	test("sums character counts from tagged files", async () => {
		const first = createTFile("first.md");
		const second = createTFile("second.md");
		const caches = {
			[first.path]: { tags: [{ tag: "#novel" }] },
			[second.path]: { frontmatter: { tags: ["novel"] } },
		};
		const contents = {
			[first.path]: "hello",
			[second.path]: "---\ntags: []\n---\nworld",
		};
		const { service } = createService({
			files: [first, second],
			caches,
			fileContents: contents,
		});

		const total = await service.calculateTotalCharacterCount();
		expect(total).toBe("hello".length + "world".length);
	});
});

describe("DataCollectionService view refresh", () => {
	test("refreshes all Count Novels views", () => {
		const refreshStats = vi.fn();
		const refreshSummary = vi.fn();
		const refreshChart = vi.fn();
		const leaves = [
			{
				view: {
					getViewType: () => VIEW_TYPE_COUNT_NOVEL,
					refreshStats,
				},
			},
			{
				view: {
					getViewType: () => VIEW_TYPE_COUNT_NOVEL,
					refreshSummary,
					refreshChart,
				},
			},
			{
				view: {
					getViewType: () => "other",
				},
			},
		];
		const { service } = createService({ leaves });

		(service as any).refreshViews();

		expect(refreshStats).toHaveBeenCalledTimes(1);
		expect(refreshSummary).toHaveBeenCalledTimes(1);
		expect(refreshChart).toHaveBeenCalledTimes(1);
	});
});
