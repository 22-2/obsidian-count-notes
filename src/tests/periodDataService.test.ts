import { PeriodDataService } from '../services/periodDataService';
import type { DataStorage } from '../data';

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

describe('PeriodDataService', () => {
	let service: PeriodDataService;
	let mockStorage: MockDataStorage;

	beforeEach(() => {
		// テスト用のモックデータを作成（2025-10-02を基準日とする）
		const mockData = {
			dailyStats: {
				// 今日のデータ（2025-10-02）
				'2025-10-02': 1500,
				// 10月のデータ
				'2025-10-01': 1000,
				'2025-10-03': 800,
				'2025-10-04': 0,
				'2025-10-05': 1200,
				'2025-10-06': 900,
				'2025-10-07': 1100,
				'2025-10-08': 1300,
				'2025-10-09': 700,
				'2025-10-10': 1000,
				'2025-10-11': 1400,
				'2025-10-12': 600,
				'2025-10-13': 1600,
				'2025-10-14': 800,
				'2025-10-15': 1200,
				'2025-10-16': 1000,
				'2025-10-17': 1500,
				'2025-10-18': 900,
				'2025-10-19': 1100,
				'2025-10-20': 1300,
				'2025-10-21': 700,
				'2025-10-22': 1000,
				'2025-10-23': 1400,
				'2025-10-24': 600,
				'2025-10-25': 1600,
				'2025-10-26': 800,
				'2025-10-27': 1200,
				'2025-10-28': 1000,
				'2025-10-29': 1500,
				'2025-10-30': 900,
				'2025-10-31': 1100,
				// 今週のデータ（2025-09-28 - 2025-10-04）
				'2025-09-28': 800,  // 日曜日
				'2025-09-29': 900,  // 月曜日
				'2025-09-30': 1000, // 火曜日
				// 2025-10-01, 2025-10-02は上記に含まれる
				// 他の四半期のデータ
				'2025-01-15': 1000,
				'2025-04-15': 1500,
				'2025-07-15': 1200,
			}
		};

		mockStorage = new MockDataStorage(mockData);
		service = new PeriodDataService(mockStorage as any);
	});

	describe('getDayChartData', () => {
		test('should return 6 time slots for day view (4-hour intervals)', () => {
			const chartData = service.getChartData('day');
			
			expect(chartData).toHaveLength(6);
			expect(chartData[0].label).toBe('00-04');
			expect(chartData[1].label).toBe('04-08');
			expect(chartData[2].label).toBe('08-12');
			expect(chartData[3].label).toBe('12-16');
			expect(chartData[4].label).toBe('16-20');
			expect(chartData[5].label).toBe('20-24');
		});

		test('should handle empty data for day view', () => {
			const emptyStorage = new MockDataStorage({ dailyStats: {} });
			const emptyService = new PeriodDataService(emptyStorage as any);
			
			const chartData = emptyService.getChartData('day');
			
			expect(chartData).toHaveLength(6);
			chartData.forEach(point => {
				expect(point.value).toBe(0);
			});
		});
	});

	describe('getWeekChartData', () => {
		test('should return 7 days for week view', () => {
			const chartData = service.getChartData('week');
			
			expect(chartData).toHaveLength(7);
			// 各日のラベルが適切な形式であることを確認
			chartData.forEach(point => {
				expect(point.label).toMatch(/^\d+日\([日月火水木金土]\)$/);
			});
		});
	});

	describe('getMonthChartData', () => {
		test('should group days into 5-day intervals for month view', () => {
			const chartData = service.getChartData('month');
			
			// 10月は31日なので、5日単位で分割すると7グループになる
			// 1-5, 6-10, 11-15, 16-20, 21-25, 26-30, 31
			expect(chartData.length).toBeGreaterThan(0);
			
			// 最初のグループは1-5日
			expect(chartData[0].label).toBe('1-5日');
			
			// 各グループの値が正の数であることを確認
			chartData.forEach(point => {
				expect(point.value).toBeGreaterThanOrEqual(0);
			});
		});

		test('should calculate correct totals for 5-day groups', () => {
			const chartData = service.getChartData('month');
			
			// 最初のグループ（1-5日）の合計を手動計算
			// 1000 + 1500 + 800 + 0 + 1200 = 4500
			expect(chartData[0].value).toBe(4500);
		});
	});

	describe('getYearChartData', () => {
		test('should return 4 quarters for year view', () => {
			const chartData = service.getChartData('year');
			
			expect(chartData).toHaveLength(4);
			expect(chartData[0].label).toBe('Q1 (1-3月)');
			expect(chartData[1].label).toBe('Q2 (4-6月)');
			expect(chartData[2].label).toBe('Q3 (7-9月)');
			expect(chartData[3].label).toBe('Q4 (10-12月)');
		});

		test('should calculate correct quarterly totals', () => {
			const chartData = service.getChartData('year');
			
			// Q1には1月のデータ（1000）が含まれる
			expect(chartData[0].value).toBe(1000);
			
			// Q2には4月のデータ（1500）が含まれる
			expect(chartData[1].value).toBe(1500);
			
			// Q3には7月のデータ（1200）+ 9月のデータ（2000+1800）が含まれる
			// 実際の値を確認: 3900
			expect(chartData[2].value).toBe(3900);
			
			// Q4には10月の全データが含まれる
			expect(chartData[3].value).toBeGreaterThan(0);
		});
	});

	describe('getPeriodStats', () => {
		test('should return appropriate stats for each period type', () => {
			const dayStats = service.getPeriodStats('day');
			const weekStats = service.getPeriodStats('week');
			const monthStats = service.getPeriodStats('month');
			const yearStats = service.getPeriodStats('year');

			expect(dayStats.periodLabel).toBe('今日');
			expect(weekStats.periodLabel).toBe('今週');
			expect(monthStats.periodLabel).toBe('今月');
			expect(yearStats.periodLabel).toBe('今年');

			// 全ての統計が非負の値であることを確認
			[dayStats, weekStats, monthStats, yearStats].forEach(stats => {
				expect(stats.total).toBeGreaterThanOrEqual(0);
				expect(stats.average).toBeGreaterThanOrEqual(0);
				expect(stats.streak).toBeGreaterThanOrEqual(0);
			});
		});
	});

	describe('error handling', () => {
		test('should handle null/undefined data gracefully', () => {
			const nullStorage = new MockDataStorage(null);
			const nullService = new PeriodDataService(nullStorage as any);

			expect(() => {
				nullService.getChartData('day');
				nullService.getChartData('week');
				nullService.getChartData('month');
				nullService.getChartData('year');
			}).not.toThrow();
		});

		test('should handle empty dailyStats gracefully', () => {
			const emptyStorage = new MockDataStorage({ dailyStats: {} });
			const emptyService = new PeriodDataService(emptyStorage as any);

			const dayData = emptyService.getChartData('day');
			const weekData = emptyService.getChartData('week');
			const monthData = emptyService.getChartData('month');
			const yearData = emptyService.getChartData('year');

			expect(dayData).toHaveLength(6);
			expect(weekData).toHaveLength(7);
			expect(monthData.length).toBeGreaterThan(0);
			expect(yearData).toHaveLength(4);
		});
	});
});