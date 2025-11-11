import { db } from "../services/db";
import { StatsStorage } from "../services/StatsStorage";

describe("StatsStorage", () => {
	let statsStorage: StatsStorage;

	beforeEach(async () => {
		statsStorage = new StatsStorage();
		await db.delete();
		await db.open();
	});

	afterEach(async () => {
		await db.delete();
		await db.close();
	});

	describe("Daily Stats", () => {
		it("should save and retrieve daily stats", async () => {
			await statsStorage.updateDailyStats("2024-01-01", 100);
			await statsStorage.updateDailyStats("2024-01-02", 200);

			const dailyStats = await statsStorage.getDailyStats();
			expect(dailyStats).toEqual({
				"2024-01-01": 100,
				"2024-01-02": 200,
			});
		});

		it("should update existing daily stats", async () => {
			await statsStorage.updateDailyStats("2024-01-01", 100);
			await statsStorage.updateDailyStats("2024-01-01", 50);

			const dailyStats = await statsStorage.getDailyStats();
			expect(dailyStats).toEqual({
				"2024-01-01": 150,
			});
		});

		it("should retrieve daily stats by date range", async () => {
			await statsStorage.updateDailyStats("2024-01-01", 100);
			await statsStorage.updateDailyStats("2024-01-02", 200);
			await statsStorage.updateDailyStats("2024-01-03", 300);

			const stats = await statsStorage.getDailyStatsByDateRange(
				"2024-01-01",
				"2024-01-02"
			);
			expect(stats).toEqual({
				"2024-01-01": 100,
				"2024-01-02": 200,
			});
		});
	});

	describe("Hourly Stats", () => {
		it("should save and retrieve hourly stats", async () => {
			const hour = '03'; // Fixed hour for consistent testing
			await statsStorage.updateHourlyStats("2024-01-01", 10, hour);
			await statsStorage.updateHourlyStats("2024-01-02", 20, hour);

			const hourlyStats = await statsStorage.getHourlyStats();
			expect(hourlyStats).toEqual({
				[`2024-01-01-${String(hour).padStart(2, '0')}`]: 10,
				[`2024-01-02-${String(hour).padStart(2, '0')}`]: 20,
			});
		});

		it("should update existing hourly stats", async () => {
			const hour = 3; // Fixed hour for consistent testing
			await statsStorage.updateHourlyStats("2024-01-01", 10, hour);
			await statsStorage.updateHourlyStats("2024-01-01", 5, hour);

			const hourlyStats = await statsStorage.getHourlyStats();
			expect(hourlyStats).toEqual({
				[`2024-01-01-${String(hour).padStart(2, '0')}`]: 15,
			});
		});

		it("should retrieve hourly stats by date range", async () => {
			const hour = 3; // Fixed hour for consistent testing
			await statsStorage.updateHourlyStats("2024-01-01", 10, hour);
			await statsStorage.updateHourlyStats("2024-01-02", 20, hour);
			await statsStorage.updateHourlyStats("2024-01-03", 30, hour);

			const stats = await statsStorage.getHourlyStatsByDateRange(
				"2024-01-01",
				"2024-01-02",
				hour,
				hour
			);

			expect(stats).toEqual({
				[`2024-01-01-${String(hour).padStart(2, '0')}`]: 10,
				[`2024-01-02-${String(hour).padStart(2, '0')}`]: 20,
			});
		});
	});

	describe("Last Total Character Count", () => {
		it("should save and retrieve the last total character count", async () => {
			await statsStorage.saveLastTotalCharacterCount(12345);
			const count = await statsStorage.getLastTotalCharacterCount();
			expect(count).toBe(12345);
		});

		it("should return 0 if no count is saved", async () => {
			const count = await statsStorage.getLastTotalCharacterCount();
			expect(count).toBe(0);
		});
	});
});
