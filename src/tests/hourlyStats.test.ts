import type { DataStorage } from "../data";
import { PeriodDataService } from "../services/periodDataService";

// モックデータストレージ
class MockDataStorage implements Partial<DataStorage> {
	private mockData: any;

	constructor(mockData: any) {
		this.mockData = mockData;
	}

	getData() {
		return this.mockData;
	}
}

describe("Hourly Stats - Time-based Data Collection", () => {
	let service: PeriodDataService;
	let mockStorage: MockDataStorage;

	beforeEach(() => {
		// テスト用のモックデータを作成（2025-10-02を基準日とする）
		const mockData = {
			dailyStats: {
				"2025-10-02": 2400, // 今日の合計
			},
			hourlyStats: {
				// 今日の時間別データ（1時間単位）
				"2025-10-02-9": 300, // 9時台
				"2025-10-02-10": 400, // 10時台
				"2025-10-02-11": 300, // 11時台（8-12hスロット合計: 1000）
				"2025-10-02-14": 500, // 14時台
				"2025-10-02-15": 200, // 15時台（12-16hスロット合計: 700）
				"2025-10-02-17": 350, // 17時台
				"2025-10-02-18": 250, // 18時台（16-20hスロット合計: 600）
				"2025-10-02-21": 100, // 21時台（20-24hスロット合計: 100）
			},
		};

		mockStorage = new MockDataStorage(mockData);
		service = new PeriodDataService(mockStorage as any);
	});

	describe("getDayChartData with hourly stats", () => {
		test("should aggregate hourly data into 4-hour slots", () => {
			const chartData = service.getChartData("day");

			expect(chartData).toHaveLength(6);

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

		test("should handle partial hour data within 4-hour slots", () => {
			const partialData = {
				dailyStats: { "2025-10-02": 500 },
				hourlyStats: {
					"2025-10-02-8": 200, // 8時台のみ
					"2025-10-02-13": 300, // 13時台のみ
				},
			};

			const partialStorage = new MockDataStorage(partialData);
			const partialService = new PeriodDataService(partialStorage as any);
			const chartData = partialService.getChartData("day");

			// 8-12hスロット: 8時台のみ
			expect(chartData[2].value).toBe(200);

			// 12-16hスロット: 13時台のみ
			expect(chartData[3].value).toBe(300);
		});

		test("should return empty slots when no hourly data exists", () => {
			const emptyData = {
				dailyStats: { "2025-10-02": 0 },
				hourlyStats: {},
			};

			const emptyStorage = new MockDataStorage(emptyData);
			const emptyService = new PeriodDataService(emptyStorage as any);
			const chartData = emptyService.getChartData("day");

			expect(chartData).toHaveLength(6);
			chartData.forEach((point) => {
				expect(point.value).toBe(0);
			});
		});
	});

	describe("getDayStats with hourly stats", () => {
		test("should calculate average from 4-hour slots", () => {
			const stats = service.getPeriodStats("day");

			// 4つの4時間スロットに執筆データがある
			// 8-12h: 1000, 12-16h: 700, 16-20h: 600, 20-24h: 100
			// 平均 = (1000 + 700 + 600 + 100) / 4 = 600
			expect(stats.average).toBe(600);
		});

		test("should only count non-zero slots in average calculation", () => {
			const sparseData = {
				dailyStats: { "2025-10-02": 1000 },
				hourlyStats: {
					"2025-10-02-9": 500, // 8-12hスロット
					"2025-10-02-15": 500, // 12-16hスロット
					// 他のスロットはデータなし
				},
			};

			const sparseStorage = new MockDataStorage(sparseData);
			const sparseService = new PeriodDataService(sparseStorage as any);
			const stats = sparseService.getPeriodStats("day");

			// 2つのスロットのみ: (500 + 500) / 2 = 500
			expect(stats.average).toBe(500);
		});

		test("should return 0 average when no hourly data exists", () => {
			const noHourlyData = {
				dailyStats: { "2025-10-02": 1000 },
				hourlyStats: {},
			};

			const noHourlyStorage = new MockDataStorage(noHourlyData);
			const noHourlyService = new PeriodDataService(
				noHourlyStorage as any
			);
			const stats = noHourlyService.getPeriodStats("day");

			expect(stats.average).toBe(0);
		});

		test("should return correct total from dailyStats", () => {
			const stats = service.getPeriodStats("day");

			expect(stats.total).toBe(2400);
		});
	});

	describe("edge cases", () => {
		test("should handle missing hourlyStats property", () => {
			const noHourlyStats = {
				dailyStats: { "2025-10-02": 1000 },
				// hourlyStats プロパティが存在しない
			};

			const storage = new MockDataStorage(noHourlyStats);
			const testService = new PeriodDataService(storage as any);

			expect(() => {
				testService.getChartData("day");
				testService.getPeriodStats("day");
			}).not.toThrow();
		});

		test("should handle all hours in a single 4-hour slot", () => {
			const allInOneSlot = {
				dailyStats: { "2025-10-02": 1600 },
				hourlyStats: {
					"2025-10-02-8": 400,
					"2025-10-02-9": 400,
					"2025-10-02-10": 400,
					"2025-10-02-11": 400,
				},
			};

			const storage = new MockDataStorage(allInOneSlot);
			const testService = new PeriodDataService(storage as any);
			const chartData = testService.getChartData("day");

			// 8-12hスロットに全てのデータ
			expect(chartData[2].value).toBe(1600);

			// 他のスロットは0
			expect(chartData[0].value).toBe(0);
			expect(chartData[1].value).toBe(0);
			expect(chartData[3].value).toBe(0);
			expect(chartData[4].value).toBe(0);
			expect(chartData[5].value).toBe(0);
		});

		test("should handle data across all 24 hours", () => {
			const allHoursData: any = {
				dailyStats: { "2025-10-02": 2400 },
				hourlyStats: {},
			};

			// 0-23時まで全ての時間に100文字ずつ
			for (let hour = 0; hour < 24; hour++) {
				allHoursData.hourlyStats[`2025-10-02-${hour}`] = 100;
			}

			const storage = new MockDataStorage(allHoursData);
			const testService = new PeriodDataService(storage as any);
			const chartData = testService.getChartData("day");

			// 各4時間スロットに400文字ずつ
			chartData.forEach((point) => {
				expect(point.value).toBe(400);
			});

			// 平均も400
			const stats = testService.getPeriodStats("day");
			expect(stats.average).toBe(400);
		});

		test("should handle negative values gracefully", () => {
			const negativeData = {
				dailyStats: { "2025-10-02": -100 },
				hourlyStats: {
					"2025-10-02-10": -50,
					"2025-10-02-14": -50,
				},
			};

			const storage = new MockDataStorage(negativeData);
			const testService = new PeriodDataService(storage as any);
			const chartData = testService.getChartData("day");

			// 負の値は0として扱われる
			chartData.forEach((point) => {
				expect(point.value).toBeGreaterThanOrEqual(0);
			});
		});
	});

	describe("date formatting", () => {
		test("should use correct date format for chart data", () => {
			const chartData = service.getChartData("day");

			chartData.forEach((point) => {
				// YYYY-MM-DD-HH形式
				expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}-\d{1,2}$/);
			});
		});

		test("should group data by correct 4-hour boundaries", () => {
			const chartData = service.getChartData("day");

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
