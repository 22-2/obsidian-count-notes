import type CountNovelsPlugin from "./main";
import { PluginDataSchema, type PeriodType, type PluginData } from "./schemas";

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
	 */
	async loadData(): Promise<PluginData> {
		try {
			const loadedData = await this.plugin.loadData();

			if (!loadedData) {
				return this.initializeData();
			}

			return this.validateAndLoadData(loadedData);
		} catch (error) {
			console.error(
				"Count Novels: Failed to load data, using initial state:",
				error
			);
			this.data = this.createInitialData();
			return this.data;
		}
	}

	/**
	 * 読み込んだデータをバリデーションして返す
	 */
	private async validateAndLoadData(
		loadedData: unknown
	): Promise<PluginData> {
		const validationResult = PluginDataSchema.safeParse(loadedData);

		if (validationResult.success) {
			this.data = validationResult.data;
			return this.data;
		}

		console.warn(
			"Count Novels: Data validation failed:",
			validationResult.error.issues
		);
		return this.initializeData();
	}

	/**
	 * 初期データを作成して保存する
	 */
	private async initializeData(): Promise<PluginData> {
		console.log(
			"Count Novels: No existing data found, creating initial data structure"
		);
		this.data = this.createInitialData();
		await this.saveData();
		return this.data;
	}

	/**
	 * data.jsonにデータを保存する
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
	 */
	private createInitialData(): PluginData {
		return {
			settings: this.plugin.settings,
			lastViewState: {
				period: "month",
			},
		};
	}

	/**
	 * 現在のデータを取得する
	 */
	getData(): PluginData | null {
		return this.data;
	}

	/**
	 * ビュー状態を更新する(バリデーション付き)
	 */
	updateViewState(period: PeriodType): void {
		this.validatePeriod(period);
		this.ensureDataInitialized();
		this.data!.lastViewState = { period };
	}

	/**
	 * 期間タイプをバリデーションする
	 */
	private validatePeriod(period: PeriodType): void {
		const validPeriods: PeriodType[] = ["day", "week", "month", "year"];
		if (!validPeriods.includes(period)) {
			throw new Error(`Invalid period: ${period}`);
		}
	}

	/**
	 * データが初期化されていることを保証する
	 */
	private ensureDataInitialized(): void {
		if (!this.data) {
			this.data = this.createInitialData();
		}
	}
}
