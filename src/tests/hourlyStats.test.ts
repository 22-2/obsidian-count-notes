import { PeriodDataService } from "../services/periodDataService";
import type { StatsStorage } from "../services/statsStorage";

// This is a simplified mock for StatsStorage, similar to the one in periodDataService.test.ts
class MockStatsStorage implements Partial<StatsStorage> {
	private mockDailyStats: any;
	private mockHourlyStats: any;

	constructor(dailyStats: any, hourlyStats: any) {
		this.mockDailyStats = dailyStats;
		this.mockHourlyStats = hourlyStats;
	}

	async getDailyStats() {
		return this.mockDailyStats;
	}

	async getHourlyStats() {
		return this.mockHourlyStats;
	}

	async getDailyStatsByDateRange(startDate: string, endDate: string) {
		return this.mockDailyStats;
	}

	async getHourlyStatsByDateRange(startDate: string, endDate: string) {
		return this.mockHourlyStats;
	}
}


// テスト用の日付を固定 (例: 2025-10-02)
const MOCK_DATE = new Date(2025, 9, 2);

describe("Hourly Stats - Time-based Data Collection", () => {
	let service: PeriodDataService;

	beforeAll(() => {
		// Date.now() をモックして、テストが常に同じ日付で実行されるようにする
		vi.useFakeTimers().setSystemTime(MOCK_DATE);
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	beforeEach(() => {
		const dailyStats = {
			"2025-10-02": 2400, // 今日の合計
		};
		const hourlyStats = {
			// 今日の時間別データ（1時間単位）
			"2025-10-02-9": 300, // 9時台
			"2025-10-02-10": 400, // 10時台
			"2025-10-02-11": 300, // 11時台（8-12hスロット合計: 1000）
			"2025-10-02-14": 500, // 14時台
			"2025-10-02-15": 200, // 15時台（12-16hスロット合計: 700）
			"2025-10-02-17": 350, // 17時台
			"2025-10-02-18": 250, // 18時台（16-20hスロット合計: 600）
			"2025-10-02-21": 100, // 21時台（20-24hスロット合計: 100）
		};

		const mockStorage = new MockStatsStorage(dailyStats, hourlyStats);
		service = new PeriodDataService(mockStorage as any);
	});

	describe("getDayChartData with hourly stats", () => {
		test("should aggregate hourly data into 4-hour slots", async () => {
			const chartData = await service.getChartData("day");

			expect(chartData).to.have.lengthOf(6);

			// 0-4h: データなし
			expect(chartData[0].label).toBe("0h");
			expect(chartData[0].value).toBe(0);

			// 4-8h: データなし
			expect(chartData[1].label).toBe("4h");
			expect(chartData[1].value).toBe(0);

			// 8-12h: 9時(300) + 10時(400) + 11時(300) = 1000
			expect(chartData[2].label).toBe("8h");
			expect(chartData[2].value).toBe(1000);

			// 12-16h: 14時(500) + 15時(200) = 700
			expect(chartData[3].label).toBe("12h");
			expect(chartData[3].value).toBe(700);

			// 16-20h: 17時(350) + 18時(250) = 600
			expect(chartData[4].label).toBe("16h");
			expect(chartData[4].value).toBe(600);

			// 20-24h: 21時(100) = 100
			expect(chartData[5].label).toBe("20h");
			expect(chartData[5].value).toBe(100);
		});

		test("should handle partial hour data within 4-hour slots", async () => {
			const dailyStats = { "2025-10-02": 500 };
			const hourlyStats = {
				"2025-10-02-8": 200, // 8時台のみ
				"2025-10-02-13": 300, // 13時台のみ
			};

			const partialStorage = new MockStatsStorage(dailyStats, hourlyStats);
			const partialService = new PeriodDataService(partialStorage as any);
			const chartData = await partialService.getChartData("day");

			// 8-12hスロット: 8時台のみ
			expect(chartData[2].value).toBe(200);

			// 12-16hスロット: 13時台のみ
			expect(chartData[3].value).toBe(300);
		});

		test("should return empty slots when no hourly data exists", async () => {
			const dailyStats = { "2025-10-02": 0 };
			const hourlyStats = {};

			const emptyStorage = new MockStatsStorage(dailyStats, hourlyStats);
			const emptyService = new PeriodDataService(emptyStorage as any);
			const chartData = await emptyService.getChartData("day");

			expect(chartData).to.have.lengthOf(6);
			chartData.forEach((point) => {
				expect(point.value).toBe(0);
			});
		});
	});

	describe("getDayStats with hourly stats", () => {
		test("should calculate average from 4-hour slots", async () => {
			const stats = await service.getPeriodStats("day");

			// 4つの4時間スロットに執筆データがある
			// 8-12h: 1000, 12-16h: 700, 16-20h: 600, 20-24h: 100
			// 平均 = (1000 + 700 + 600 + 100) / 4 = 600
			expect(stats.average).toBe(600);
		});

		test("should only count non-zero slots in average calculation", async () => {
			const dailyStats = { "2025-10-02": 1000 };
			const hourlyStats = {
				"2025-10-02-9": 500, // 8-12hスロット
				"2025-10-02-15": 500, // 12-16hスロット
				// 他のスロットはデータなし
			};
			const sparseStorage = new MockStatsStorage(
				dailyStats,
				hourlyStats
			);
			const sparseService = new PeriodDataService(sparseStorage as any);
			const stats = await sparseService.getPeriodStats("day");

			// 2つのスロットのみ: (500 + 500) / 2 = 500
			expect(stats.average).toBe(500);
		});

		test("should return 0 average when no hourly data exists", async () => {
			const dailyStats = { "2025-10-02": 1000 };
			const hourlyStats = {};
			const noHourlyStorage = new MockStatsStorage(
				dailyStats,
				hourlyStats
			);
			const noHourlyService = new PeriodDataService(
				noHourlyStorage as any
			);
			const stats = await noHourlyService.getPeriodStats("day");

			expect(stats.average).toBe(0);
		});

		test("should return correct total from dailyStats", async () => {
			const stats = await service.getPeriodStats("day");

			expect(stats.total).toBe(2400);
		});
	});

	describe("edge cases", () => {
		test("should handle missing hourlyStats property", async () => {
			const dailyStats = { "2025-10-02": 1000 };
			const hourlyStats = undefined; // hourlyStats プロパティが存在しない
			const storage = new MockStatsStorage(dailyStats, hourlyStats);
			const testService = new PeriodDataService(storage as any);

			await expect(testService.getChartData("day")).resolves.not.toThrow();
			await expect(
				testService.getPeriodStats("day")
			).resolves.not.toThrow();
		});

		test("should handle all hours in a single 4-hour slot", async () => {
			const dailyStats = { "2025-10-02": 1600 };
			const hourlyStats = {
				"2025-10-02-8": 400,
				"2025-10-02-9": 400,
				"2025-10-02-10": 400,
				"2025-10-02-11": 400,
			};

			const storage = new MockStatsStorage(dailyStats, hourlyStats);
			const testService = new PeriodDataService(storage as any);
			const chartData = await testService.getChartData("day");

			// 8-12hスロットに全てのデータ
			expect(chartData[2].value).toBe(1600);

			// 他のスロットは0
			expect(chartData[0].value).toBe(0);
			expect(chartData[1].value).toBe(0);
			expect(chartData[3].value).toBe(0);
			expect(chartData[4].value).toBe(0);
			expect(chartData[5].value).toBe(0);
		});

		test("should handle data across all 24 hours", async () => {
			const dailyStats: any = { "2025-10-02": 2400 };
			const hourlyStats: any = {};

			// 0-23時まで全ての時間に100文字ずつ
			for (let hour = 0; hour < 24; hour++) {
				hourlyStats[`2025-10-02-${hour}`] = 100;
			}

			const storage = new MockStatsStorage(dailyStats, hourlyStats);
			const testService = new PeriodDataService(storage as any);
			const chartData = await testService.getChartData("day");

			// 各4時間スロットに400文字ずつ
			chartData.forEach((point) => {
				expect(point.value).toBe(400);
			});

			// 平均も400
			const stats = await testService.getPeriodStats("day");
			expect(stats.average).toBe(400);
		});

		test("should handle negative values gracefully", async () => {
			const dailyStats = { "2025-10-02": -100 };
			const hourlyStats = {
				"2025-10-02-10": -50,
				"2025-10-02-14": -50,
			};
			const storage = new MockStatsStorage(dailyStats, hourlyStats);
			const testService = new PeriodDataService(storage as any);
			const chartData = await testService.getChartData("day");

			// 負の値は0として扱われる
			chartData.forEach((point) => {
				expect(point.value).toBeGreaterThanOrEqual(0);
			});
		});
	});

	describe("date formatting", () => {
		test("should use correct date format for chart data", async () => {
			const chartData = await service.getChartData("day");

			chartData.forEach((point) => {
				// YYYY-MM-DD-HH形式
				expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}-\d{1,2}$/);
			});
		});

		test("should group data by correct 4-hour boundaries", async () => {
			const chartData = await service.getChartData("day");

			// 各スロットの開始時刻を確認
			expect(chartData[0].date).toContain("-0");
			expect(chartData[1].date).toContain("-4");
			expect(chartData[2].date).toContain("-8");
			expect(chartData[3].date).toContain("-12");
			expect(chartData[4].date).toContain("-16");
			expect(chartData[5].date).toContain("-20");
		});
	});
});
