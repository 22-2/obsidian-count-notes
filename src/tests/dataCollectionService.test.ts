import { vi } from "vitest";
import { DataCollectionService } from "../services/dataCollection";
import type { StatsStorage } from "../services/statsStorage";
import { VIEW_TYPE_COUNT_NOVEL } from "../utils/constants";
import type { TFile } from "obsidian";
import {
	isPathInExcludedFolders,
	normalizeExcludedFolders,
} from "../utils/excludedFolders";

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
	trackingTags?: string[];
	excludedFolders?: string[];
};

const createService = (options: ServiceOptions = {}) => {
	const files = options.files ?? [];
	const caches = options.caches ?? {};
	const fileContents = options.fileContents ?? {};
	const leaves = options.leaves ?? [];
	const pluginMock = {
		settings: {
			trackingTags: options.trackingTags ?? ["novel"],
			excludedFolders: options.excludedFolders ?? [],
		},
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

		expect(calcSpy).toHaveBeenCalledWith("novel");
		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(1500, "novel");
		expect(statsStorage.updateDailyStats).toHaveBeenCalledWith("2025-10-02", 500, "novel");
		expect(statsStorage.updateHourlyStats).toHaveBeenCalledWith("2025-10-02", 500, "novel");
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

		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(500, "novel");
		expect(statsStorage.updateDailyStats).toHaveBeenCalledWith("2025-10-02", -1500, "novel");
		expect(statsStorage.updateHourlyStats).toHaveBeenCalledWith("2025-10-02", -1500, "novel");
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

		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(800, "novel");
		expect(statsStorage.updateDailyStats).not.toHaveBeenCalled();
		expect(statsStorage.updateHourlyStats).not.toHaveBeenCalled();
		expect(refreshSpy).toHaveBeenCalled();
	});

	test("handles first run (no previous stats)", async () => {
		const { service, statsStorage } = createService();
		statsStorage.getLastTotalCharacterCount.mockResolvedValueOnce(null);
		const calcSpy = vi
			.spyOn(service as any, "calculateTotalCharacterCount")
			.mockResolvedValueOnce(1500);
		const refreshSpy = vi
			.spyOn(service as any, "refreshViews")
			.mockImplementation(() => undefined);

		await service.collectData();

		expect(calcSpy).toHaveBeenCalledWith("novel");
		expect(statsStorage.saveLastTotalCharacterCount).toHaveBeenCalledWith(1500, "novel");
		expect(statsStorage.updateDailyStats).not.toHaveBeenCalled();
		expect(statsStorage.updateHourlyStats).not.toHaveBeenCalled();
		expect(refreshSpy).toHaveBeenCalled();
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

	test("excludes files located under configured folders", async () => {
		const included = createTFile("novels/chapter1.md");
		const excluded = createTFile("Archive/secret.md");
		const caches = {
			[included.path]: { tags: [{ tag: "#novel" }] },
			[excluded.path]: { tags: [{ tag: "#novel" }] },
		};
		const { service } = createService({
			files: [included, excluded],
			caches,
			excludedFolders: ["Archive"],
		});

		const files = await service.findFilesWithTag("novel");
		expect(files).toEqual([included]);
	});

	test("logs warning when tag is invalid", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { service } = createService();

		const files = await service.findFilesWithTag("  ");
		expect(files).toEqual([]);
	});
});

describe("DataCollectionService excluded folders helper", () => {
	test("normalizes excluded folder inputs", () => {
		const normalized = normalizeExcludedFolders([
			"Archive/",
			"archive",
			"notes\\personal",
		]);
		expect(normalized).toEqual(["Archive", "notes/personal"]);
	});

	test("detects paths inside excluded folders", () => {
		const folders = ["Archive", "notes/personal"];
		expect(isPathInExcludedFolders("Archive/ch1.md", folders)).toBe(true);
		expect(
			isPathInExcludedFolders("notes/personal/ch2.md", folders)
		).toBe(true);
		expect(isPathInExcludedFolders("notes/general.md", folders)).toBe(false);
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

		const total = await service.calculateTotalCharacterCount("novel");
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
