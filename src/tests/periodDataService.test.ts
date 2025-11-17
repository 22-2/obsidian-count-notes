import { PeriodDataService } from "../services/periodDataService";
import type { StatsStorage } from "../services/statsStorage";

// モックStatsStorage
class MockStatsStorage implements Partial<StatsStorage> {
	constructor(
		private mockDailyStats: Record<string, number> = {},
		private mockHourlyStats: Record<string, number> = {}
	) {}

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
const TEST_DATE = "2025-10-02";

const hourlyKey = (date: string, hour: number) =>
	`${date}-${hour.toString().padStart(2, "0")}`;

describe("PeriodDataService", () => {
	let service: PeriodDataService;

	beforeAll(() => {
		// Date.now() をモックして、テストが常に同じ日付で実行されるようにする
		vi.useFakeTimers().setSystemTime(MOCK_DATE);
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	beforeEach(() => {
		const mockDailyStats = {
			[TEST_DATE]: 1500,
			"2025-10-01": 1000,
			"2025-09-30": 500,
			"2025-07-15": 1200,
		};
		const mockHourlyStats = {
			[hourlyKey(TEST_DATE, 8)]: 500,
			[hourlyKey(TEST_DATE, 9)]: 1000,
		};

		const mockStorage = new MockStatsStorage(
			mockDailyStats,
			mockHourlyStats
		);
		service = new PeriodDataService(mockStorage as any);
	});

	describe("getPeriodStats", () => {
		test("should return correct stats for day", async () => {
			const stats = await service.getPeriodStats("day");
			expect(stats.total).toBe(1500);
			expect(stats.average).toBe(1500);
			expect(stats.streak).toBe(3);
			expect(stats.periodLabel).toBe("今日");
		});

		test("should aggregate totals and averages for current week", async () => {
			const weeklyStats = new MockStatsStorage({
				"2025-09-28": 0,
				"2025-09-29": 200,
				"2025-09-30": -50,
				"2025-10-01": 400,
				"2025-10-02": 100,
				"2025-10-03": 0,
				"2025-10-04": 50,
			});
			const weeklyService = new PeriodDataService(weeklyStats as any);

			const stats = await weeklyService.getPeriodStats("week");

			expect(stats).toMatchObject({
				total: 700,
				average: 140,
				streak: 2,
				periodLabel: "今週",
			});
		});

		test("should expose negative totals when deletions exceed additions", async () => {
			const hourlyStats = {
				"2025-10-02-08": -300,
			};
			const negativeStats = new MockStatsStorage(
				{ [TEST_DATE]: -300 },
				hourlyStats
			);
			const negativeService = new PeriodDataService(negativeStats as any);

			const stats = await negativeService.getPeriodStats("day");
			expect(stats.total).toBe(-300);
			const chartData = await negativeService.getChartData("day");
			expect(chartData.find((point) => point.label === "8h")?.value).toBe(
				-300
			);
		});

		test("should continue streak from previous day when today has no count", async () => {
			const streakStats = new MockStatsStorage({
				"2025-10-01": 120,
				"2025-09-30": 80,
				"2025-09-29": 0,
			});
			const streakService = new PeriodDataService(streakStats as any);

			const stats = await streakService.getPeriodStats("week");
			expect(stats.streak).toBe(2);
		});
	});

	describe("getChartData", () => {
		test("should return 6 time slots for day view", async () => {
			const chartData = await service.getChartData("day");
			expect(chartData).to.have.lengthOf(6);
			expect(chartData[2].value).toBe(1500); // 8h-12h slot
		});

		test("should group month data into 5-day buckets", async () => {
			const dailyStats = new MockStatsStorage({
				"2025-10-01": 100,
				"2025-10-02": 200,
				"2025-10-03": -50,
				"2025-10-05": 300,
				"2025-10-06": 100,
				"2025-10-10": 400,
				"2025-10-15": 500,
			});
			const monthlyService = new PeriodDataService(dailyStats as any);

			const chartData = await monthlyService.getChartData("month");
			expect(chartData[0]).toMatchObject({ label: "1-5日", value: 550 });
			expect(chartData[1]).toMatchObject({ label: "6-10日", value: 500 });
			expect(chartData[2]).toMatchObject({ label: "11-15日", value: 500 });
		});

		test("should aggregate quarterly totals for year chart", async () => {
			const yearlyStats = new MockStatsStorage({
				"2025-01-01": 100,
				"2025-02-10": 50,
				"2025-04-05": -100,
				"2025-07-15": 200,
				"2025-11-01": 300,
			});
			const yearlyService = new PeriodDataService(yearlyStats as any);

			const chartData = await yearlyService.getChartData("year");

			expect(chartData).toEqual([
				{ label: "Q1", value: 150, date: "2025-01-01" },
				{ label: "Q2", value: -100, date: "2025-04-01" },
				{ label: "Q3", value: 200, date: "2025-07-01" },
				{ label: "Q4", value: 300, date: "2025-10-01" },
			]);
		});
	});

	describe("error handling", () => {
		test("should handle empty stats gracefully", async () => {
			const emptyStorage = new MockStatsStorage({}, {});
			const emptyService = new PeriodDataService(emptyStorage as any);

			const dayStats = await emptyService.getPeriodStats("day");
			expect(dayStats.total).toBe(0);

			const dayChart = await emptyService.getChartData("day");
			expect(dayChart.every((d) => d.value === 0)).toBe(true);
		});
	});
});
