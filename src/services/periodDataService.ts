import type { PeriodType, PeriodStats, ChartDataPoint } from '../types/period';
import type { DataStorage } from '../data';

export class PeriodDataService {
	constructor(private dataStorage: DataStorage) {}

	/**
	 * 指定された期間タイプの統計データを取得
	 */
	getPeriodStats(periodType: PeriodType): PeriodStats {
		switch (periodType) {
			case 'day':
				return this.getDayStats();
			case 'week':
				return this.getWeekStats();
			case 'month':
				return this.getMonthStats();
			case 'year':
				return this.getYearStats();
			default:
				throw new Error(`Unsupported period type: ${periodType}`);
		}
	}

	/**
	 * 指定された期間タイプのチャートデータを取得
	 */
	getChartData(periodType: PeriodType): ChartDataPoint[] {
		switch (periodType) {
			case 'day':
				return this.getDayChartData();
			case 'week':
				return this.getWeekChartData();
			case 'month':
				return this.getMonthChartData();
			case 'year':
				return this.getYearChartData();
			default:
				throw new Error(`Unsupported period type: ${periodType}`);
		}
	}

	private getDayStats(): PeriodStats {
		const today = new Date();
		const todayString = this.formatDateString(today);
		const pluginData = this.dataStorage.getData();
		
		if (!pluginData?.dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: '今日' };
		}

		const todayCount = pluginData.dailyStats[todayString] || 0;
		const streak = this.calculateStreak();

		return {
			total: Math.max(0, todayCount),
			average: Math.max(0, todayCount),
			streak,
			periodLabel: '今日'
		};
	}

	private getWeekStats(): PeriodStats {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: '今週' };
		}

		const weekData = this.getCurrentWeekData();
		const total = weekData.reduce((sum, [, count]) => sum + Math.max(0, count), 0);
		const writingDays = weekData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak();

		return {
			total,
			average,
			streak,
			periodLabel: '今週'
		};
	}

	private getMonthStats(): PeriodStats {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: '今月' };
		}

		const monthData = this.getCurrentMonthData();
		const total = monthData.reduce((sum, [, count]) => sum + Math.max(0, count), 0);
		const writingDays = monthData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak();

		return {
			total,
			average,
			streak,
			periodLabel: '今月'
		};
	}

	private getYearStats(): PeriodStats {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: '今年' };
		}

		const yearData = this.getCurrentYearData();
		const total = yearData.reduce((sum, [, count]) => sum + Math.max(0, count), 0);
		const writingDays = yearData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak();

		return {
			total,
			average,
			streak,
			periodLabel: '今年'
		};
	}

	private getDayChartData(): ChartDataPoint[] {
		const today = new Date();
		const todayString = this.formatDateString(today);
		const pluginData = this.dataStorage.getData();
		
		if (!pluginData?.dailyStats) {
			return [];
		}

		const todayCount = pluginData.dailyStats[todayString] || 0;
		
		return [{
			label: '今日',
			value: Math.max(0, todayCount),
			date: todayString
		}];
	}

	private getWeekChartData(): ChartDataPoint[] {
		const weekData = this.getCurrentWeekData();
		
		return weekData.map(([dateString, count]) => {
			const date = new Date(dateString);
			const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
			
			return {
				label: `${date.getDate()}日(${dayOfWeek})`,
				value: Math.max(0, count),
				date: dateString
			};
		});
	}

	private getMonthChartData(): ChartDataPoint[] {
		const monthData = this.getCurrentMonthData();
		
		return monthData.map(([dateString, count]) => {
			const date = new Date(dateString);
			
			return {
				label: `${date.getDate()}日`,
				value: Math.max(0, count),
				date: dateString
			};
		});
	}

	private getYearChartData(): ChartDataPoint[] {
		const yearData = this.getCurrentYearData();
		const monthlyData = new Map<string, number>();

		// 月別に集計
		yearData.forEach(([dateString, count]) => {
			const date = new Date(dateString);
			const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
			const currentTotal = monthlyData.get(monthKey) || 0;
			monthlyData.set(monthKey, currentTotal + Math.max(0, count));
		});

		// チャートデータに変換
		return Array.from(monthlyData.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([monthKey, total]) => {
				const [year, month] = monthKey.split('-');
				return {
					label: `${parseInt(month)}月`,
					value: total,
					date: monthKey
				};
			});
	}

	private getCurrentWeekData(): Array<[string, number]> {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) return [];

		const today = new Date();
		const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
		const startOfWeek = new Date(today);
		startOfWeek.setDate(today.getDate() - currentDay); // 日曜日を週の開始とする

		const weekData: Array<[string, number]> = [];
		
		for (let i = 0; i < 7; i++) {
			const date = new Date(startOfWeek);
			date.setDate(startOfWeek.getDate() + i);
			const dateString = this.formatDateString(date);
			const count = pluginData.dailyStats[dateString] || 0;
			weekData.push([dateString, count]);
		}

		return weekData;
	}

	private getCurrentMonthData(): Array<[string, number]> {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) return [];

		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const monthPrefix = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

		return Object.entries(pluginData.dailyStats)
			.filter(([date]) => date.startsWith(monthPrefix))
			.sort(([a], [b]) => a.localeCompare(b));
	}

	private getCurrentYearData(): Array<[string, number]> {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) return [];

		const currentYear = new Date().getFullYear();
		const yearPrefix = currentYear.toString();

		return Object.entries(pluginData.dailyStats)
			.filter(([date]) => date.startsWith(yearPrefix))
			.sort(([a], [b]) => a.localeCompare(b));
	}

	private calculateStreak(): number {
		const pluginData = this.dataStorage.getData();
		if (!pluginData?.dailyStats) return 0;

		const today = new Date();
		let streak = 0;
		let currentDate = new Date(today);

		// 今日の執筆データがあるかチェック
		const todayString = this.formatDateString(today);
		const todayStats = pluginData.dailyStats[todayString];
		const hasTodayData = todayStats && todayStats > 0;

		// 今日まだ執筆していない場合は昨日から開始
		if (!hasTodayData) {
			currentDate.setDate(currentDate.getDate() - 1);
		}

		// 遡って連続する執筆日数を計算
		while (true) {
			const dateString = this.formatDateString(currentDate);
			const dayStats = pluginData.dailyStats[dateString];

			if (dayStats && dayStats > 0) {
				streak++;
				currentDate.setDate(currentDate.getDate() - 1);
			} else {
				break;
			}

			// 無限ループ防止（1年以上遡らない）
			if (streak > 365) break;
		}

		return streak;
	}

	private formatDateString(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
}