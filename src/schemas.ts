/**
 * 期間タイプ
 */
export type PeriodType = "day" | "week" | "month" | "year";

/**
 * 期間設定
 */
export interface PeriodConfig {
	type: PeriodType;
	label: string;
	shortLabel: string;
}

/**
 * 期間統計
 */
export interface PeriodStats {
	total: number;
	average: number;
	streak: number;
	periodLabel: string;
}

/**
 * チャートデータポイント
 */
export interface ChartDataPoint {
	label: string;
	value: number;
	date: string;
}

/**
 * 設定
 */
export interface CountNovelsSettings {
	logLevel: "debug" | "info" | "warn" | "error" | "silent";
	trackingTag: string;
	excludedFolders: string[];
}

/**
 * ビュー状態
 */
export interface ViewState {
	period: PeriodType;
}

/**
 * Count Novel ビュー状態
 */
export interface CountNovelViewState {
	period: PeriodType;
}

/**
 * 時間単位の統計（YYYY-MM-DD-HH形式、HHは00-23）
 */
export type HourlyStats = Record<string, number>;

/**
 * 日次統計
 */
export type DailyStats = Record<string, number>;

/**
 * プラグインデータ（data.json）
 * 設定とビューの状態のみを保持
 */
export interface PluginData {
	settings: CountNovelsSettings;
	lastViewState?: ViewState;
	lastCollectedAt?: string;
}

/**
 * 期間設定の定数
 */
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

/**
 * デフォルト設定
 */
export const DEFAULT_SETTINGS: CountNovelsSettings = {
	logLevel: "debug",
	trackingTag: "novel",
	excludedFolders: [],
};

