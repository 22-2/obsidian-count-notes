import { z } from "zod";
import type CountNovelsPlugin from "./main";

/**
 * 設定のzodスキーマ
 */
const CountNovelsSettingsSchema = z.object({
	logLevel: z.enum(["debug", "info", "warn", "error", "silent"]), // log.LogLevelDescは複雑な型なのでanyで許可
	trackingTag: z.string().min(1), // 空文字列は許可しない
});

/**
 * 日付文字列のバリデーション（YYYY-MM-DD形式）
 */
const DateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * プラグインデータのzodスキーマ
 * data.jsonに保存される全データを定義
 */
export const PluginDataSchema = z.object({
	settings: CountNovelsSettingsSchema,
	lastTotalCharacterCount: z.number().int().min(0), // 非負の整数
	dailyStats: z.record(DateStringSchema, z.number().int()), // "YYYY-MM-DD" -> 整数の文字数差分
});

/**
 * 日付バリデーション用のヘルパー関数
 */
export const validateDateString = (date: string): boolean => {
	return DateStringSchema.safeParse(date).success;
};

/**
 * プラグインデータ型（zodスキーマから自動生成）
 */
export type PluginData = z.infer<typeof PluginDataSchema>;

/**
 * データストレージクラス
 * data.jsonの読み込み・保存・初期化を管理
 */
export class DataStorage {
	private plugin: CountNovelsPlugin;
	private data: PluginData | null = null;

	constructor(plugin: CountNovelsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * data.jsonからデータを読み込む
	 * 要件5.2: loadData APIを使用してdata.jsonからデータを読み込む
	 */
	async loadData(): Promise<PluginData> {
		try {
			const loadedData = await this.plugin.loadData();

			if (loadedData) {
				// zodスキーマでバリデーション
				const validationResult = PluginDataSchema.safeParse(loadedData);

				if (validationResult.success) {
					this.data = validationResult.data;
					return this.data;
				} else {
					// バリデーションエラーの詳細をログ出力
					console.warn(
						"Count Novels: Data validation failed:",
						validationResult.error.issues
					);
					console.log(
						"Count Novels: Creating initial data structure due to validation failure"
					);
					this.data = this.createInitialData();
					await this.saveData();
					return this.data;
				}
			} else {
				// 要件5.4: data.jsonが存在しない場合は初期データ構造を作成
				console.log(
					"Count Novels: No existing data found, creating initial data structure"
				);
				this.data = this.createInitialData();
				await this.saveData();
				return this.data;
			}
		} catch (error) {
			// 要件5.5: データの読み込みに失敗した場合はエラーログを出力し、初期状態で動作
			console.error(
				"Count Novels: Failed to load data, using initial state:",
				error
			);
			this.data = this.createInitialData();
			return this.data;
		}
	}

	/**
	 * data.jsonにデータを保存する
	 * 要件5.1: saveData APIを使用してdata.jsonに保存
	 */
	async saveData(): Promise<void> {
		if (!this.data) {
			console.error("Count Novels: No data to save");
			return;
		}

		try {
			await this.plugin.saveData(this.data);
		} catch (error) {
			console.error("Count Novels: Failed to save data:", error);
			throw error;
		}
	}

	/**
	 * 初期データ構造を作成する
	 * 要件5.4: data.jsonが存在しない場合の初期データ構造作成
	 */
	private createInitialData(): PluginData {
		return {
			settings: this.plugin.settings,
			lastTotalCharacterCount: 0,
			dailyStats: {},
		};
	}

	/**
	 * データバリデーション用のヘルパーメソッド
	 * 要件5.3: 後方互換性を維持（zodスキーマによる厳密な検証）
	 */
	validateData(data: unknown): PluginData | null {
		const validationResult = PluginDataSchema.safeParse(data);

		if (validationResult.success) {
			return validationResult.data;
		} else {
			console.warn(
				"Count Novels: Data validation failed:",
				validationResult.error.issues
			);
			return null;
		}
	}

	/**
	 * 現在のデータを取得する
	 */
	getData(): PluginData | null {
		return this.data;
	}

	/**
	 * データを更新する（zodバリデーション付き）
	 */
	updateData(updates: Partial<PluginData>): void {
		if (!this.data) {
			this.data = this.createInitialData();
		}

		const updatedData = { ...this.data, ...updates };

		// 更新後のデータをバリデーション
		const validationResult = PluginDataSchema.safeParse(updatedData);

		if (validationResult.success) {
			this.data = validationResult.data;
		} else {
			console.error(
				"Count Novels: Data update validation failed:",
				validationResult.error.issues
			);
			throw new Error(
				"Invalid data update: " + validationResult.error.message
			);
		}
	}

	/**
	 * 日次統計を更新する（zodバリデーション付き）
	 */
	updateDailyStats(date: string, characterDiff: number): void {
		// 日付形式のバリデーション
		if (!validateDateString(date)) {
			throw new Error(
				`Invalid date format: ${date}. Expected YYYY-MM-DD format.`
			);
		}

		// 文字数差分のバリデーション
		if (!Number.isInteger(characterDiff)) {
			throw new Error(
				`Character diff must be an integer: ${characterDiff}`
			);
		}

		if (!this.data) {
			this.data = this.createInitialData();
		}

		this.data.dailyStats[date] = characterDiff;
	}

	/**
	 * 最後の合計文字数を更新する（バリデーション付き）
	 */
	updateLastTotalCharacterCount(count: number): void {
		// 文字数のバリデーション
		if (!Number.isInteger(count) || count < 0) {
			throw new Error(
				`Character count must be a non-negative integer: ${count}`
			);
		}

		if (!this.data) {
			this.data = this.createInitialData();
		}

		this.data.lastTotalCharacterCount = count;
	}
}
