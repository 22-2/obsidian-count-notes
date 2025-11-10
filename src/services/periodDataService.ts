import type {
	ChartDataPoint,
	DailyStats,
	HourlyStats,
	PeriodStats,
	PeriodType,
} from "../schemas";
import type { StatsStorage } from "./StatsStorage";

export class PeriodDataService {
	constructor(private statsStorage: StatsStorage) {}

	/**
	 * 指定された期間タイプの統計データを取得
	 */
	async getPeriodStats(periodType: PeriodType): Promise<PeriodStats> {
		const dailyStats = await this.statsStorage.getDailyStats();
		const hourlyStats = await this.statsStorage.getHourlyStats();

		switch (periodType) {
			case "day":
				return this.getDayStats(dailyStats, hourlyStats);
			case "week":
				return this.getWeekStats(dailyStats);
			case "month":
				return this.getMonthStats(dailyStats);
			case "year":
				return this.getYearStats(dailyStats);
			default:
				throw new Error(`Unsupported period type: ${periodType}`);
		}
	}

	/**
	 * 指定された期間タイプのチャートデータを取得
	 */
	async getChartData(periodType: PeriodType): Promise<ChartDataPoint[]> {
		const dailyStats = await this.statsStorage.getDailyStats();
		const hourlyStats = await this.statsStorage.getHourlyStats();

		switch (periodType) {
			case "day":
				return this.getDayChartData(hourlyStats);
			case "week":
				return this.getWeekChartData(dailyStats);
			case "month":
				return this.getMonthChartData(dailyStats);
			case "year":
				return this.getYearChartData(dailyStats);
			default:
				throw new Error(`Unsupported period type: ${periodType}`);
		}
	}

	private getDayStats(
		dailyStats: DailyStats,
		hourlyStats: HourlyStats
	): PeriodStats {
		const today = new Date();
		const todayString = this.formatDateString(today);

		if (!dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: "今日" };
		}

		const todayCount = dailyStats[todayString] || 0;
		const streak = this.calculateStreak(dailyStats);

		let average = 0;
		if (hourlyStats) {
			const fourHourSlots = [];

			for (let slotStart = 0; slotStart < 24; slotStart += 4) {
				let slotTotal = 0;
				for (let hour = slotStart; hour < slotStart + 4; hour++) {
					const timeSlotKey = `${todayString}-${hour}`;
					slotTotal += hourlyStats[timeSlotKey] || 0;
				}
				if (slotTotal > 0) {
					fourHourSlots.push(slotTotal);
				}
			}

			if (fourHourSlots.length > 0) {
				const sum = fourHourSlots.reduce((acc, val) => acc + val, 0);
				average = Math.round(sum / fourHourSlots.length);
			}
		}

		return {
			total: Math.max(0, todayCount),
			average: Math.max(0, average),
			streak,
			periodLabel: "今日",
		};
	}

	private getWeekStats(dailyStats: DailyStats): PeriodStats {
		if (!dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: "今週" };
		}

		const weekData = this.getCurrentWeekData(dailyStats);
		const total = weekData.reduce(
			(sum, [, count]) => sum + Math.max(0, count),
			0
		);
		const writingDays = weekData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak(dailyStats);

		return {
			total,
			average,
			streak,
			periodLabel: "今週",
		};
	}

	private getMonthStats(dailyStats: DailyStats): PeriodStats {
		if (!dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: "今月" };
		}

		const monthData = this.getCurrentMonthData(dailyStats);
		const total = monthData.reduce(
			(sum, [, count]) => sum + Math.max(0, count),
			0
		);
		const writingDays = monthData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak(dailyStats);

		return {
			total,
			average,
			streak,
			periodLabel: "今月",
		};
	}

	private getYearStats(dailyStats: DailyStats): PeriodStats {
		if (!dailyStats) {
			return { total: 0, average: 0, streak: 0, periodLabel: "今年" };
		}

		const yearData = this.getCurrentYearData(dailyStats);
		const total = yearData.reduce(
			(sum, [, count]) => sum + Math.max(0, count),
			0
		);
		const writingDays = yearData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak(dailyStats);

		return {
			total,
			average,
			streak,
			periodLabel: "今年",
		};
	}

	private getDayChartData(hourlyStats: HourlyStats): ChartDataPoint[] {
		const today = new Date();
		const todayString = this.formatDateString(today);

		if (!hourlyStats) {
			return this.generateEmptyDaySlots();
		}

		const chartData: ChartDataPoint[] = [];

		for (let slotStart = 0; slotStart < 24; slotStart += 4) {
			const label = `${slotStart}h`;
			let slotTotal = 0;
			for (let hour = slotStart; hour < slotStart + 4; hour++) {
				const timeSlotKey = `${todayString}-${hour}`;
				slotTotal += hourlyStats[timeSlotKey] || 0;
			}
			chartData.push({
				label,
				value: Math.max(0, slotTotal),
				date: `${todayString}-${slotStart}`,
			});
		}

		return chartData;
	}

	private generateEmptyDaySlots(): ChartDataPoint[] {
		const today = new Date();
		const todayString = this.formatDateString(today);
		const chartData: ChartDataPoint[] = [];

		for (let hour = 0; hour < 24; hour += 4) {
			const label = `${hour}h`;
			chartData.push({
				label,
				value: 0,
				date: `${todayString}-${hour}`,
			});
		}

		return chartData;
	}

	private getWeekChartData(dailyStats: DailyStats): ChartDataPoint[] {
		const weekData = this.getCurrentWeekData(dailyStats);

		return weekData.map(([dateString, count]) => {
			const date = new Date(dateString);
			const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][
				date.getDay()
			];

			return {
				label: `${dayOfWeek}`,
				value: Math.max(0, count),
				date: dateString,
			};
		});
	}

	private getMonthChartData(dailyStats: DailyStats): ChartDataPoint[] {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
		const chartData: ChartDataPoint[] = [];

		for (let startDay = 1; startDay <= daysInMonth; startDay += 5) {
			const endDay = Math.min(startDay + 4, daysInMonth);
			let totalCount = 0;
			for (let day = startDay; day <= endDay; day++) {
				const dateKey = `${currentYear}-${currentMonth
					.toString()
					.padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
				const dayCount = dailyStats?.[dateKey] || 0;
				totalCount += Math.max(0, dayCount);
			}
			const label =
				startDay === endDay
					? `${startDay}日`
					: `${startDay}-${endDay}日`;
			chartData.push({
				label,
				value: totalCount,
				date: `${currentYear}-${currentMonth
					.toString()
					.padStart(2, "0")}-${startDay.toString().padStart(2, "0")}`,
			});
		}

		return chartData;
	}

	private getYearChartData(dailyStats: DailyStats): ChartDataPoint[] {
		const currentYear = new Date().getFullYear();
		const chartData: ChartDataPoint[] = [];
		const quarters = [
			{ months: [1, 2, 3], label: "Q1" },
			{ months: [4, 5, 6], label: "Q2" },
			{ months: [7, 8, 9], label: "Q3" },
			{ months: [10, 11, 12], label: "Q4" },
		];

		quarters.forEach((quarter) => {
			let quarterTotal = 0;
			quarter.months.forEach((month) => {
				const monthPrefix = `${currentYear}-${month
					.toString()
					.padStart(2, "0")}`;
				if (dailyStats) {
					Object.entries(dailyStats).forEach(
						([dateString, count]) => {
							if (dateString.startsWith(monthPrefix)) {
								quarterTotal += Math.max(0, count);
							}
						}
					);
				}
			});
			chartData.push({
				label: quarter.label,
				value: quarterTotal,
				date: `${currentYear}-${quarter.months[0]
					.toString()
					.padStart(2, "0")}`,
			});
		});

		return chartData;
	}

	private getCurrentWeekData(
		dailyStats: DailyStats
	): Array<[string, number]> {
		if (!dailyStats) return [];
		const today = new Date();
		const currentDay = today.getDay();
		const startOfWeek = new Date(today);
		startOfWeek.setDate(today.getDate() - currentDay);
		const weekData: Array<[string, number]> = [];

		for (let i = 0; i < 7; i++) {
			const date = new Date(startOfWeek);
			date.setDate(startOfWeek.getDate() + i);
			const dateString = this.formatDateString(date);
			const count = dailyStats[dateString] || 0;
			weekData.push([dateString, count]);
		}

		return weekData;
	}

	private getCurrentMonthData(
		dailyStats: DailyStats
	): Array<[string, number]> {
		if (!dailyStats) return [];
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const monthPrefix = `${currentYear}-${currentMonth
			.toString()
			.padStart(2, "0")}`;

		return Object.entries(dailyStats)
			.filter(([date]) => date.startsWith(monthPrefix))
			.sort(([a], [b]) => a.localeCompare(b));
	}

	private getCurrentYearData(
		dailyStats: DailyStats
	): Array<[string, number]> {
		if (!dailyStats) return [];
		const currentYear = new Date().getFullYear();
		const yearPrefix = currentYear.toString();

		return Object.entries(dailyStats)
			.filter(([date]) => date.startsWith(yearPrefix))
			.sort(([a], [b]) => a.localeCompare(b));
	}

	private calculateStreak(dailyStats: DailyStats): number {
		if (!dailyStats) return 0;
		const today = new Date();
		let streak = 0;
		let currentDate = new Date(today);
		const todayString = this.formatDateString(today);
		const todayStats = dailyStats[todayString];
		const hasTodayData = todayStats && todayStats > 0;

		if (!hasTodayData) {
			currentDate.setDate(currentDate.getDate() - 1);
		}

		while (true) {
			const dateString = this.formatDateString(currentDate);
			const dayStats = dailyStats[dateString];
			if (dayStats && dayStats > 0) {
				streak++;
				currentDate.setDate(currentDate.getDate() - 1);
			} else {
				break;
			}
			if (streak > 365) break;
		}

		return streak;
	}

	private formatDateString(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}
