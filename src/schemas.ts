import * as v from "valibot";

/**
 * 期間タイプのスキーマ
 */
export const PeriodTypeSchema = v.picklist(["24hours", "day", "week", "month", "year"]);

/**
 * 期間設定のスキーマ
 */
export const PeriodConfigSchema = v.object({
	type: PeriodTypeSchema,
	label: v.string(),
	shortLabel: v.string(),
});

/**
 * 期間統計のスキーマ
 */
export const PeriodStatsSchema = v.object({
	total: v.number(),
	average: v.number(),
	streak: v.number(),
	periodLabel: v.string(),
	last1Hour: v.optional(v.number()),
});

/**
 * チャートデータポイントのスキーマ
 */
export const ChartDataPointSchema = v.object({
	label: v.string(),
	value: v.number(),
	date: v.string(),
});

/**
 * 設定のスキーマ
 */
export const CountNovelsSettingsSchema = v.object({
	logLevel: v.picklist(["debug", "info", "warn", "error", "silent"]),
	trackingTags: v.array(
		v.object({
			tag: v.string(),
			isActive: v.boolean(),
		})
	),
	excludedFolders: v.optional(
		v.array(v.pipe(v.string(), v.minLength(1))),
		[]
	),
});

/**
 * 日付文字列のバリデーション（YYYY-MM-DD形式）
 */
export const DateStringSchema = v.pipe(
	v.string(),
	v.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
);

/**
 * ビュー状態のスキーマ
 */
export const ViewStateSchema = v.object({
	period: PeriodTypeSchema,
});

/**
 * Count Novel ビュー状態のスキーマ
 */
export const CountNovelViewStateSchema = v.object({
	period: PeriodTypeSchema,
});

/**
 * 時間単位の統計のスキーマ（YYYY-MM-DD-HH形式、HHは00-23）
 */
export const HourlyStatsSchema = v.record(
	v.pipe(
		v.string(),
		v.regex(
			/^\d{4}-\d{2}-\d{2}-\d{2}$/,
			"Time slot must be in YYYY-MM-DD-HH format (HH: 00-23)"
		)
	),
	v.pipe(v.number(), v.integer())
);

/**
 * 日次統計のスキーマ
 */
export const DailyStatsSchema = v.record(
	DateStringSchema,
	v.pipe(v.number(), v.integer())
);

/**
 * プラグインデータ（data.json）のスキーマ
 * 設定とビューの状態のみを保持
 */
export const PluginDataSchema = v.object({
	settings: CountNovelsSettingsSchema,
	lastViewState: v.optional(ViewStateSchema),
	lastCollectedAt: v.optional(v.string()),
});

// 型定義（valibotスキーマから自動生成）
export type PeriodType = v.InferOutput<typeof PeriodTypeSchema>;
export type PeriodConfig = v.InferOutput<typeof PeriodConfigSchema>;
export type PeriodStats = v.InferOutput<typeof PeriodStatsSchema>;
export type ChartDataPoint = v.InferOutput<typeof ChartDataPointSchema>;
export type CountNovelsSettings = v.InferOutput<
	typeof CountNovelsSettingsSchema
>;
export type ViewState = v.InferOutput<typeof ViewStateSchema>;
export type CountNovelViewState = v.InferOutput<
	typeof CountNovelViewStateSchema
>;
export type DailyStats = v.InferOutput<typeof DailyStatsSchema>;
export type HourlyStats = v.InferOutput<typeof HourlyStatsSchema>;
export type PluginData = v.InferOutput<typeof PluginDataSchema>;

/**
 * 期間設定の定数
 */
export const PERIOD_CONFIGS: Record<PeriodType, PeriodConfig> = {
	"24hours": {
		type: "24hours",
		label: "24時間",
		shortLabel: "24",
	},
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
	trackingTags: [{ tag: "novel", isActive: true }],
	excludedFolders: [],
};

/**
 * 日付バリデーション用のヘルパー関数
 */
export const validateDateString = (date: string): boolean => {
	return v.safeParse(DateStringSchema, date).success;
};

/**
 * 期間タイプバリデーション用のヘルパー関数
 */
export const validatePeriodType = (period: string): period is PeriodType => {
	return v.safeParse(PeriodTypeSchema, period).success;
};

/**
 * 設定バリデーション用のヘルパー関数
 */
export const validateSettings = (
	settings: unknown
): CountNovelsSettings | null => {
	const result = v.safeParse(CountNovelsSettingsSchema, settings);
	return result.success ? result.output : null;
};

