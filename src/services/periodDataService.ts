import type {
	ChartDataPoint,
	DailyStats,
	HourlyStats,
	PeriodStats,
	PeriodType,
} from "../schemas";
import type { StatsStorage } from "./statsStorage";

export class PeriodDataService {
	private static readonly HOURS_PER_SLOT = 4;
	private static readonly DAYS_IN_WEEK = 7;
	private static readonly DAYS_PER_MONTH_SLOT = 5;
	private static readonly MAX_STREAK_DAYS = 365;
	private static readonly DAY_LABELS = [
		"日",
		"月",
		"火",
		"水",
		"木",
		"金",
		"土",
	];
	private static readonly QUARTERS = [
		{ months: [1, 2, 3], label: "Q1" },
		{ months: [4, 5, 6], label: "Q2" },
		{ months: [7, 8, 9], label: "Q3" },
		{ months: [10, 11, 12], label: "Q4" },
	];

	constructor(private statsStorage: StatsStorage) {}

	async getPeriodStats(periodType: PeriodType): Promise<PeriodStats> {
		const { startDate, endDate } = this.getDateRange(periodType);
		const dailyStats = await this.statsStorage.getDailyStatsByDateRange(startDate, endDate);
		const hourlyStats = await this.statsStorage.getHourlyStatsByDateRange(startDate, endDate);

		const statsCalculators = {
			day: () => this.getDayStats(dailyStats, hourlyStats),
			week: () => this.getWeekStats(dailyStats),
			month: () => this.getMonthStats(dailyStats),
			year: () => this.getYearStats(dailyStats),
		};

		const calculator = statsCalculators[periodType];
		if (!calculator) {
			throw new Error(`Unsupported period type: ${periodType}`);
		}

		return calculator();
	}

	async getChartData(periodType: PeriodType): Promise<ChartDataPoint[]> {
		const { startDate, endDate } = this.getDateRange(periodType);
		const dailyStats = await this.statsStorage.getDailyStatsByDateRange(startDate, endDate);
		const hourlyStats = await this.statsStorage.getHourlyStatsByDateRange(startDate, endDate);

		const chartDataGenerators = {
			day: () => this.getDayChartData(hourlyStats),
			week: () => this.getWeekChartData(dailyStats),
			month: () => this.getMonthChartData(dailyStats),
			year: () => this.getYearChartData(dailyStats),
		};

		const generator = chartDataGenerators[periodType];
		if (!generator) {
			throw new Error(`Unsupported period type: ${periodType}`);
		}

		return generator();
	}

	private getDateRange(periodType: PeriodType): { startDate: string; endDate: string } {
		const today = new Date();
		switch (periodType) {
			case "day": {
				const todayStr = this.formatDateString(today);
				return { startDate: todayStr, endDate: todayStr };
			}
			case "week": {
				const startOfWeek = this.getStartOfWeek(today);
				const endOfWeek = new Date(startOfWeek);
				endOfWeek.setDate(startOfWeek.getDate() + 6);
				return {
					startDate: this.formatDateString(startOfWeek),
					endDate: this.formatDateString(endOfWeek),
				};
			}
			case "month": {
				const year = today.getFullYear();
				const month = today.getMonth();
				const startDate = new Date(year, month, 1);
				const endDate = new Date(year, month + 1, 0);
				return {
					startDate: this.formatDateString(startDate),
					endDate: this.formatDateString(endDate),
				};
			}
			case "year": {
				const year = today.getFullYear();
				const startDate = new Date(year, 0, 1);
				const endDate = new Date(year, 11, 31);
				return {
					startDate: this.formatDateString(startDate),
					endDate: this.formatDateString(endDate),
				};
			}
		}
	}

	private getDayStats(
		dailyStats: DailyStats,
		hourlyStats: HourlyStats
	): PeriodStats {
		if (!dailyStats) {
			return this.createEmptyStats("今日");
		}

		const today = new Date();
		const todayString = this.formatDateString(today);
		const todayCount = dailyStats[todayString] || 0;
		const average = this.calculateDayAverage(hourlyStats, todayString);
		const streak = this.calculateStreak(dailyStats);

		return {
			total: Math.max(0, todayCount),
			average: Math.max(0, average),
			streak,
			periodLabel: "今日",
		};
	}

	private calculateDayAverage(
		hourlyStats: HourlyStats,
		todayString: string
	): number {
		if (!hourlyStats) return 0;

		const slotTotals = this.calculateFourHourSlots(
			hourlyStats,
			todayString
		);
		const nonEmptySlots = slotTotals.filter((total) => total > 0);

		return nonEmptySlots.length > 0
			? Math.round(
					nonEmptySlots.reduce((acc, val) => acc + val, 0) /
						nonEmptySlots.length
			  )
			: 0;
	}

	private calculateFourHourSlots(
		hourlyStats: HourlyStats,
		todayString: string
	): number[] {
		const slots: number[] = [];

		for (
			let slotStart = 0;
			slotStart < 24;
			slotStart += PeriodDataService.HOURS_PER_SLOT
		) {
			const slotTotal = this.sumHoursInSlot(
				hourlyStats,
				todayString,
				slotStart,
				PeriodDataService.HOURS_PER_SLOT
			);
			slots.push(slotTotal);
		}

		return slots;
	}

	private sumHoursInSlot(
		hourlyStats: HourlyStats,
		dateString: string,
		startHour: number,
		duration: number
	): number {
		let total = 0;
		for (let hour = startHour; hour < startHour + duration; hour++) {
			const timeSlotKey = `${dateString}-${this.formatHour(hour)}`;
			total += hourlyStats[timeSlotKey] || 0;
		}
		return total;
	}

	private getWeekStats(dailyStats: DailyStats): PeriodStats {
		return this.calculatePeriodStats(
			dailyStats,
			this.getCurrentWeekData(dailyStats),
			"今週"
		);
	}

	private getMonthStats(dailyStats: DailyStats): PeriodStats {
		return this.calculatePeriodStats(
			dailyStats,
			this.getCurrentMonthData(dailyStats),
			"今月"
		);
	}

	private getYearStats(dailyStats: DailyStats): PeriodStats {
		return this.calculatePeriodStats(
			dailyStats,
			this.getCurrentYearData(dailyStats),
			"今年"
		);
	}

	private calculatePeriodStats(
		dailyStats: DailyStats,
		periodData: Array<[string, number]>,
		periodLabel: string
	): PeriodStats {
		if (!dailyStats) {
			return this.createEmptyStats(periodLabel);
		}

		const total = periodData.reduce(
			(sum, [, count]) => sum + Math.max(0, count),
			0
		);
		const writingDays = periodData.filter(([, count]) => count > 0).length;
		const average = writingDays > 0 ? Math.round(total / writingDays) : 0;
		const streak = this.calculateStreak(dailyStats);

		return { total, average, streak, periodLabel };
	}

	private createEmptyStats(periodLabel: string): PeriodStats {
		return { total: 0, average: 0, streak: 0, periodLabel };
	}

	private getDayChartData(hourlyStats: HourlyStats): ChartDataPoint[] {
		const today = new Date();
		const todayString = this.formatDateString(today);

		if (!hourlyStats) {
			return this.generateEmptyDaySlots(todayString);
		}

		return this.generateDaySlots(hourlyStats, todayString);
	}

	private generateDaySlots(
		hourlyStats: HourlyStats,
		dateString: string
	): ChartDataPoint[] {
		const chartData: ChartDataPoint[] = [];

		for (
			let slotStart = 0;
			slotStart < 24;
			slotStart += PeriodDataService.HOURS_PER_SLOT
		) {
			const slotTotal = this.sumHoursInSlot(
				hourlyStats,
				dateString,
				slotStart,
				PeriodDataService.HOURS_PER_SLOT
			);
			chartData.push({
				label: `${slotStart}h`,
				value: Math.max(0, slotTotal),
				date: `${dateString}-${this.formatHour(slotStart)}`,
			});
		}

		return chartData;
	}

	private generateEmptyDaySlots(dateString: string): ChartDataPoint[] {
		const chartData: ChartDataPoint[] = [];

		for (
			let hour = 0;
			hour < 24;
			hour += PeriodDataService.HOURS_PER_SLOT
		) {
			chartData.push({
				label: `${hour}h`,
				value: 0,
				date: `${dateString}-${this.formatHour(hour)}`,
			});
		}

		return chartData;
	}

	private getWeekChartData(dailyStats: DailyStats): ChartDataPoint[] {
		const weekData = this.getCurrentWeekData(dailyStats);

		return weekData.map(([dateString, count]) => {
			const date = new Date(dateString);
			const dayOfWeek = PeriodDataService.DAY_LABELS[date.getDay()];

			return {
				label: dayOfWeek,
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

		for (
			let startDay = 1;
			startDay <= daysInMonth;
			startDay += PeriodDataService.DAYS_PER_MONTH_SLOT
		) {
			const endDay = Math.min(
				startDay + PeriodDataService.DAYS_PER_MONTH_SLOT - 1,
				daysInMonth
			);
			const totalCount = this.sumDaysInRange(
				dailyStats,
				currentYear,
				currentMonth,
				startDay,
				endDay
			);
			const label =
				startDay === endDay
					? `${startDay}日`
					: `${startDay}-${endDay}日`;

			chartData.push({
				label,
				value: totalCount,
				date: this.formatDate(currentYear, currentMonth, startDay),
			});
		}

		return chartData;
	}

	private sumDaysInRange(
		dailyStats: DailyStats,
		year: number,
		month: number,
		startDay: number,
		endDay: number
	): number {
		let total = 0;
		for (let day = startDay; day <= endDay; day++) {
			const dateKey = this.formatDate(year, month, day);
			const dayCount = dailyStats?.[dateKey] || 0;
			total += Math.max(0, dayCount);
		}
		return total;
	}

	private getYearChartData(dailyStats: DailyStats): ChartDataPoint[] {
		const currentYear = new Date().getFullYear();

		return PeriodDataService.QUARTERS.map((quarter) => {
			const quarterTotal = this.calculateQuarterTotal(
				dailyStats,
				currentYear,
				quarter.months
			);

			return {
				label: quarter.label,
				value: quarterTotal,
				date: this.formatDate(currentYear, quarter.months[0], 1),
			};
		});
	}

	private calculateQuarterTotal(
		dailyStats: DailyStats,
		year: number,
		months: number[]
	): number {
		if (!dailyStats) return 0;

		let total = 0;
		months.forEach((month) => {
			const monthPrefix = `${year}-${month.toString().padStart(2, "0")}`;
			Object.entries(dailyStats).forEach(([dateString, count]) => {
				if (dateString.startsWith(monthPrefix)) {
					total += Math.max(0, count);
				}
			});
		});
		return total;
	}

	private getCurrentWeekData(
		dailyStats: DailyStats
	): Array<[string, number]> {
		if (!dailyStats) return [];

		const today = new Date();
		const startOfWeek = this.getStartOfWeek(today);
		const weekData: Array<[string, number]> = [];

		for (let i = 0; i < PeriodDataService.DAYS_IN_WEEK; i++) {
			const date = new Date(startOfWeek);
			date.setDate(startOfWeek.getDate() + i);
			const dateString = this.formatDateString(date);
			const count = dailyStats[dateString] || 0;
			weekData.push([dateString, count]);
		}

		return weekData;
	}

	private getStartOfWeek(date: Date): Date {
		const startOfWeek = new Date(date);
		startOfWeek.setDate(date.getDate() - date.getDay());
		return startOfWeek;
	}

	private getCurrentMonthData(
		dailyStats: DailyStats
	): Array<[string, number]> {
		if (!dailyStats) return [];

		const currentDate = new Date();
		const monthPrefix = this.formatDate(
			currentDate.getFullYear(),
			currentDate.getMonth() + 1,
			null
		);

		return this.filterAndSortByPrefix(dailyStats, monthPrefix);
	}

	private getCurrentYearData(
		dailyStats: DailyStats
	): Array<[string, number]> {
		if (!dailyStats) return [];

		const currentYear = new Date().getFullYear().toString();
		return this.filterAndSortByPrefix(dailyStats, currentYear);
	}

	private filterAndSortByPrefix(
		dailyStats: DailyStats,
		prefix: string
	): Array<[string, number]> {
		return Object.entries(dailyStats)
			.filter(([date]) => date.startsWith(prefix))
			.sort(([a], [b]) => a.localeCompare(b));
	}

	private calculateStreak(dailyStats: DailyStats): number {
		if (!dailyStats) return 0;

		const today = new Date();
		const todayString = this.formatDateString(today);
		const hasTodayData = (dailyStats[todayString] || 0) > 0;

		const startDate = hasTodayData
			? new Date(today)
			: new Date(today.setDate(today.getDate() - 1));

		return this.countConsecutiveDays(dailyStats, startDate);
	}

	private countConsecutiveDays(
		dailyStats: DailyStats,
		startDate: Date
	): number {
		let streak = 0;
		const currentDate = new Date(startDate);

		while (streak <= PeriodDataService.MAX_STREAK_DAYS) {
			const dateString = this.formatDateString(currentDate);
			const dayStats = dailyStats[dateString] || 0;

			if (dayStats > 0) {
				streak++;
				currentDate.setDate(currentDate.getDate() - 1);
			} else {
				break;
			}
		}

		return streak;
	}

	private formatHour(hour: number): string {
		return hour.toString().padStart(2, "0");
	}

	private formatDateString(date: Date): string {
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		return this.formatDate(year, month, day);
	}

	private formatDate(
		year: number,
		month: number,
		day: number | null
	): string {
		const monthStr = month.toString().padStart(2, "0");
		if (day === null) {
			return `${year}-${monthStr}`;
		}
		const dayStr = day.toString().padStart(2, "0");
		return `${year}-${monthStr}-${dayStr}`;
	}
}
