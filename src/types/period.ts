export type PeriodType = "day" | "week" | "month" | "year";

export interface PeriodConfig {
	type: PeriodType;
	label: string;
	shortLabel: string;
}

export const PERIOD_CONFIGS: Record<PeriodType, PeriodConfig> = {
	day: {
		type: "day",
		label: "日別",
		shortLabel: "日",
	},
	week: {
		type: "week",
		label: "週別",
		shortLabel: "週",
	},
	month: {
		type: "month",
		label: "月別",
		shortLabel: "月",
	},
	year: {
		type: "year",
		label: "年別",
		shortLabel: "年",
	},
};

export interface PeriodStats {
	total: number;
	average: number;
	streak: number;
	periodLabel: string;
}

export interface ChartDataPoint {
	label: string;
	value: number;
	date: string;
}
