import { vi } from "vitest";
import { DataStorage } from "../data";

// モックプラグイン
class MockPlugin {
	settings = {
		logLevel: "debug" as const,
		trackingTags: ["novel"],
		excludedFolders: [] as string[],
	};

	loadData = vi.fn().mockResolvedValue(null);
	saveData = vi.fn().mockResolvedValue(undefined);
}

const createStorage = () => {
	const plugin = new MockPlugin();
	const storage = new DataStorage(plugin as any);
	return { plugin, storage };
};

describe("DataStorage", () => {
	test("loadData initializes new storage when no data exists", async () => {
		const { plugin, storage } = createStorage();
		const data = await storage.loadData();

		expect(plugin.loadData).toHaveBeenCalled();
		expect(plugin.saveData).toHaveBeenCalledWith({
			settings: plugin.settings,
			lastViewState: { period: "month" },
		});
		expect(data).toEqual({
			settings: plugin.settings,
			lastViewState: { period: "month" },
		});
	});

	test("loadData returns stored data when schema is valid", async () => {
		const { plugin, storage } = createStorage();
		const persisted = {
			settings: plugin.settings,
			lastViewState: { period: "week" },
			lastCollectedAt: "2025-10-02T10:00:00.000Z",
		};
		plugin.loadData.mockResolvedValueOnce(persisted);

		const data = await storage.loadData();
		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(data).toEqual(persisted);
	});

	test("loadData reinitializes when stored data is invalid", async () => {
		const { plugin, storage } = createStorage();
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		plugin.loadData.mockResolvedValueOnce({ unexpected: true });

		const data = await storage.loadData();

		expect(warnSpy).toHaveBeenCalled();
		expect(plugin.saveData).toHaveBeenCalledTimes(1);
		expect(data.lastViewState?.period).toBe("month");

		warnSpy.mockRestore();
	});

	test("loadData recovers when plugin throws", async () => {
		const { plugin, storage } = createStorage();
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		plugin.loadData.mockRejectedValueOnce(new Error("boom"));

		const data = await storage.loadData();

		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(data).toEqual({
			settings: plugin.settings,
			lastViewState: { period: "month" },
		});
		expect(errorSpy).toHaveBeenCalled();

		errorSpy.mockRestore();
	});

	test("updateData merges fields before save", async () => {
		const { plugin, storage } = createStorage();
		await storage.loadData();
		storage.updateData({ lastCollectedAt: "2025-10-02T12:00:00.000Z" });

		await storage.saveData();
		expect(plugin.saveData).toHaveBeenLastCalledWith({
			settings: plugin.settings,
			lastViewState: { period: "month" },
			lastCollectedAt: "2025-10-02T12:00:00.000Z",
		});
	});

	test("saveData logs when data is missing", async () => {
		const { plugin, storage } = createStorage();
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		await storage.saveData();

		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith("Count Novels: No data to save");

		errorSpy.mockRestore();
	});

	test("saveData rethrows plugin errors", async () => {
		const { plugin, storage } = createStorage();
		await storage.loadData();
		plugin.saveData.mockRejectedValueOnce(new Error("disk full"));

		await expect(storage.saveData()).rejects.toThrow("disk full");
	});

	test("updateLastCollectedAt initializes storage lazily", () => {
		const { storage } = createStorage();
		storage.updateLastCollectedAt("2025-10-02T12:00:00.000Z");

		expect(storage.getData()).toMatchObject({
			lastCollectedAt: "2025-10-02T12:00:00.000Z",
		});
	});

	describe("updateViewState", () => {
		test("updates the view state", () => {
			const { storage } = createStorage();
			storage.updateViewState("week");
			expect(storage.getData()?.lastViewState?.period).toBe("week");
		});

		test("throws for invalid period", () => {
			const { storage } = createStorage();
			expect(() => storage.updateViewState("invalid" as any)).toThrow(
				"Invalid period: invalid"
			);
		});
	});
});
