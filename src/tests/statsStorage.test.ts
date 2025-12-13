import { deleteDB } from "idb";
import { closeDB } from "../services/db";
import { StatsStorage } from "../services/statsStorage";

const DB_NAME = "obsidian-count-novels-db";

describe("StatsStorage", () => {
	let statsStorage: StatsStorage;

	beforeEach(async () => {
		await closeDB();
		await deleteDB(DB_NAME);
		statsStorage = new StatsStorage();
	});

	afterEach(async () => {
		await closeDB();
		await deleteDB(DB_NAME);
	});

	describe("Daily Stats", () => {
		it("should save and retrieve daily stats", async () => {
			await statsStorage.updateDailyStats("2024-01-01", 100, "novel");
			await statsStorage.updateDailyStats("2024-01-02", 200, "novel");

			const dailyStats = await statsStorage.getDailyStats("novel");
			expect(dailyStats).toEqual({
				"2024-01-01": 100,
				"2024-01-02": 200,
			});
		});

		it("should update existing daily stats", async () => {
			await statsStorage.updateDailyStats("2024-01-01", 100, "novel");
			await statsStorage.updateDailyStats("2024-01-01", 50, "novel");

			const dailyStats = await statsStorage.getDailyStats("novel");
			expect(dailyStats).toEqual({
				"2024-01-01": 150,
			});
		});

		it("should retrieve daily stats by date range", async () => {
			await statsStorage.updateDailyStats("2024-01-01", 100, "novel");
			await statsStorage.updateDailyStats("2024-01-02", 200, "novel");
			await statsStorage.updateDailyStats("2024-01-03", 300, "novel");

			const stats = await statsStorage.getDailyStatsByDateRange(
				"2024-01-01",
				"2024-01-02",
				"novel"
			);
			expect(stats).toEqual({
				"2024-01-01": 100,
				"2024-01-02": 200,
			});
		});
	});

	describe("Hourly Stats", () => {
		it("should save and retrieve hourly stats", async () => {
			const hour = 3; // Fixed hour for consistent testing
			await statsStorage.updateHourlyStats("2024-01-01", 10, "novel", hour);
			await statsStorage.updateHourlyStats("2024-01-02", 20, "novel", hour);

			const hourlyStats = await statsStorage.getHourlyStats("novel");
			expect(hourlyStats).toEqual({
				[`2024-01-01-${String(hour).padStart(2, "0")}`]: 10,
				[`2024-01-02-${String(hour).padStart(2, "0")}`]: 20,
			});
		});

		it("should update existing hourly stats", async () => {
			const hour = 3; // Fixed hour for consistent testing
			await statsStorage.updateHourlyStats("2024-01-01", 10, "novel", hour);
			await statsStorage.updateHourlyStats("2024-01-01", 5, "novel", hour);

			const hourlyStats = await statsStorage.getHourlyStats("novel");
			expect(hourlyStats).toEqual({
				[`2024-01-01-${String(hour).padStart(2, "0")}`]: 15,
			});
		});

		it("should retrieve hourly stats by date range", async () => {
			const hour = 3; // Fixed hour for consistent testing
			await statsStorage.updateHourlyStats("2024-01-01", 10, "novel", hour);
			await statsStorage.updateHourlyStats("2024-01-02", 20, "novel", hour);
			await statsStorage.updateHourlyStats("2024-01-03", 30, "novel", hour);

			const stats = await statsStorage.getHourlyStatsByDateRange(
				"2024-01-01",
				"2024-01-02",
				"novel",
				hour,
				hour
			);

			expect(stats).toEqual({
				[`2024-01-01-${String(hour).padStart(2, "0")}`]: 10,
				[`2024-01-02-${String(hour).padStart(2, "0")}`]: 20,
			});
		});
	});

	describe("Last Total Character Count", () => {
		it("should save and retrieve the last total character count", async () => {
			await statsStorage.saveLastTotalCharacterCount(12345, "novel");
			const count = await statsStorage.getLastTotalCharacterCount("novel");
			expect(count).toBe(12345);
		});

		it("should return null if no count is saved", async () => {
			const count = await statsStorage.getLastTotalCharacterCount("novel");
			expect(count).toBeNull();
		});
	});

	describe("File Stats", () => {
		it("should save and retrieve file character counts for a tag", async () => {
			await statsStorage.saveFileCharacterCount("novel", "a.md", 10);
			await statsStorage.saveFileCharacterCount("novel", "b.md", 20);

			const map = await statsStorage.getFileCharacterCounts("novel");
			expect(Object.fromEntries(map.entries())).toEqual({
				"a.md": 10,
				"b.md": 20,
			});
		});

		it("should delete file character count", async () => {
			await statsStorage.saveFileCharacterCount("novel", "a.md", 10);
			await statsStorage.deleteFileCharacterCount("novel", "a.md");

			const map = await statsStorage.getFileCharacterCounts("novel");
			expect(Object.fromEntries(map.entries())).toEqual({});
		});
	});
});
