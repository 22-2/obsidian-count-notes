import { PeriodDataService } from "../services/periodDataService";
import type { StatsStorage } from "../services/statsStorage";

// モックStatsStorage
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
			"2025-10-02": 1500,
			"2025-10-01": 1000,
			"2025-09-30": 500,
			"2025-07-15": 1200,
		};
		const mockHourlyStats = {
			"2025-10-02-8": 500,
			"2025-10-02-9": 1000,
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
	});

	describe("getChartData", () => {
		test("should return 6 time slots for day view", async () => {
			const chartData = await service.getChartData("day");
			expect(chartData).to.have.lengthOf(6);
			expect(chartData[2].value).toBe(1500); // 8h-12h slot
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
