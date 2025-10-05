import type CountNovelsPlugin from "./main";
import {
	PluginDataSchema,
	validateDateString,
	type PeriodType,
	type PluginData,
} from "./schemas";

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
			lastViewState: {
				period: "month",
			},
			dailyStats: {},
			hourlyStats: {},
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

		const existingValue = this.data.dailyStats[date] || 0;
		this.data.dailyStats[date] = existingValue + characterDiff;
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

	/**
	 * ビュー状態を更新する（バリデーション付き）
	 */
	updateViewState(period: PeriodType): void {
		// 期間のバリデーション
		if (!["day", "week", "month", "year"].includes(period)) {
			throw new Error(`Invalid period: ${period}`);
		}

		if (!this.data) {
			this.data = this.createInitialData();
		}

		this.data.lastViewState = { period };
	}

	/**
	 * 時間単位の統計を更新する
	 */
	updateHourlyStats(date: string, characterDiff: number): void {
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

		// hourlyStatsが存在しない場合は初期化
		if (!this.data.hourlyStats) {
			this.data.hourlyStats = {};
		}

		// 現在の時刻を取得
		const currentHour = new Date().getHours();
		const timeSlotKey = `${date}-${currentHour}`;

		const existingValue = this.data.hourlyStats[timeSlotKey] || 0;
		this.data.hourlyStats[timeSlotKey] = existingValue + characterDiff;
	}
}
