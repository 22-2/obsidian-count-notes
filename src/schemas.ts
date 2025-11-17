import { z } from "zod";

/**
 * 期間タイプのzodスキーマ
 */
export const PeriodTypeSchema = z.enum(["day", "week", "month", "year"]);

/**
 * 期間設定のzodスキーマ
 */
export const PeriodConfigSchema = z.object({
	type: PeriodTypeSchema,
	label: z.string(),
	shortLabel: z.string(),
});

/**
 * 期間統計のzodスキーマ
 */
export const PeriodStatsSchema = z.object({
	total: z.number(),
	average: z.number(),
	streak: z.number(),
	periodLabel: z.string(),
});

/**
 * チャートデータポイントのzodスキーマ
 */
export const ChartDataPointSchema = z.object({
	label: z.string(),
	value: z.number(),
	date: z.string(),
});

/**
 * 設定のzodスキーマ
 */
export const CountNovelsSettingsSchema = z.object({
	logLevel: z.enum(["debug", "info", "warn", "error", "silent"]),
	trackingTag: z.string().min(1),
});

/**
 * 日付文字列のバリデーション（YYYY-MM-DD形式）
 */
export const DateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * ビュー状態のzodスキーマ
 */
export const ViewStateSchema = z.object({
	period: PeriodTypeSchema,
});

/**
 * Count Novel ビュー状態のzodスキーマ
 */
export const CountNovelViewStateSchema = z.object({
	period: PeriodTypeSchema,
});

/**
 * 時間単位の統計のzodスキーマ（YYYY-MM-DD-HH形式、HHは00-23）
 */
export const HourlyStatsSchema = z.record(
	z
		.string()
		.regex(
			/^\d{4}-\d{2}-\d{2}-\d{2}$/,
			"Time slot must be in YYYY-MM-DD-HH format (HH: 00-23)"
		),
	z.number().int()
);

/**
 * 日次統計のzodスキーマ
 */
export const DailyStatsSchema = z.record(DateStringSchema, z.number().int());

/**
 * プラグインデータ（data.json）のzodスキーマ
 * 設定とビューの状態のみを保持
 */
export const PluginDataSchema = z.object({
	settings: CountNovelsSettingsSchema,
	lastViewState: ViewStateSchema.optional(),
	lastCollectedAt: z.string().optional(),
});

// 型定義（zodスキーマから自動生成）
export type PeriodType = z.infer<typeof PeriodTypeSchema>;
export type PeriodConfig = z.infer<typeof PeriodConfigSchema>;
export type PeriodStats = z.infer<typeof PeriodStatsSchema>;
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
export type CountNovelsSettings = z.infer<typeof CountNovelsSettingsSchema>;
export type ViewState = z.infer<typeof ViewStateSchema>;
export type CountNovelViewState = z.infer<typeof CountNovelViewStateSchema>;
export type DailyStats = z.infer<typeof DailyStatsSchema>;
export type HourlyStats = z.infer<typeof HourlyStatsSchema>;
export type PluginData = z.infer<typeof PluginDataSchema>;

/**
 * 期間設定の定数（Zodスキーマでバリデーション済み）
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
 * デフォルト設定（Zodスキーマでバリデーション済み）
 */
export const DEFAULT_SETTINGS: CountNovelsSettings = {
	logLevel: "debug",
	trackingTag: "novel",
};

/**
 * 日付バリデーション用のヘルパー関数
 */
export const validateDateString = (date: string): boolean => {
	return DateStringSchema.safeParse(date).success;
};

/**
 * 期間タイプバリデーション用のヘルパー関数
 */
export const validatePeriodType = (period: string): period is PeriodType => {
	return PeriodTypeSchema.safeParse(period).success;
};

/**
 * 設定バリデーション用のヘルパー関数
 */
export const validateSettings = (
	settings: unknown
): CountNovelsSettings | null => {
	const result = CountNovelsSettingsSchema.safeParse(settings);
	return result.success ? result.data : null;
};
