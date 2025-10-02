import log from "loglevel";
import { Plugin } from "obsidian";
import { CountNovelHome } from "./CountNovelView";
import { DataStorage } from "./data";
import { DataCollectionService } from "./services/dataCollection";
import {
	CountNovelsSettingTab,
	DEFAULT_SETTINGS,
	type CountNovelsSettings,
} from "./settings";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;
	dataCollectionService!: DataCollectionService;
	intervalId?: number; // 定期実行用のタイマーID

	async onload() {
		// データストレージを初期化
		this.dataStorage = new DataStorage(this);

		// データ収集サービスを初期化
		this.dataCollectionService = new DataCollectionService(this);

		await this.loadSettings();
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.togglLoggersBy(this.settings.logLevel);
		this.registerView(VIEW_TYPE_COUNT_NOVEL, (leaf) => {
			const view = new CountNovelHome(leaf);
			view.setPlugin(this);
			return view;
		});
		this.addCommand({
			id: "open-count-novels-home",
			name: "Open Count Novels Home",
			callback: () => {
				this.app.workspace.getLeaf("tab")!.setViewState({
					type: VIEW_TYPE_COUNT_NOVEL,
					active: true,
				});
			},
		});

		// デバッグ用コマンド：手動でデータ収集を実行
		this.addCommand({
			id: "collect-data-manually",
			name: "Collect Data Manually (Debug)",
			callback: async () => {
				console.log("Count Novels: Manual data collection triggered");
				await this.collectData();
				console.log("Count Novels: Manual data collection completed");
			},
		});

		// プラグインデータを読み込み
		await this.dataStorage.loadData();

		// 要件2.1: Obsidian起動時にデータ収集を実行
		await this.dataCollectionService.collectData();

		// 要件2.2: 10分間隔でデータ収集を実行する定期実行機能を実装
		this.startPeriodicDataCollection();
	}

	onunload() {
		// プラグイン無効化時に定期実行を停止する機能を実装
		this.stopPeriodicDataCollection();
	}

	togglLoggersBy(
		level: log.LogLevelDesc,
		filter: (name: string) => boolean = () => true
	): void {
		Object.values(log.getLoggers())
			// @ts-expect-error
			.filter((logger) => filter(logger.name))
			.forEach((logger) => {
				logger.setLevel(level);
			});
	}

	async loadSettings() {
		// データストレージから設定を読み込み
		const pluginData = await this.dataStorage.loadData();
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			pluginData.settings
		);
	}

	async saveSettings() {
		// 設定をデータストレージに保存
		this.dataStorage.updateData({ settings: this.settings });
		await this.dataStorage.saveData();
	}

	/**
	 * データ収集を実行する（公開メソッド）
	 * 要件2.1, 2.2: 指定タグを持つ全ファイルの合計文字数を計算し、差分を記録
	 */
	async collectData(): Promise<void> {
		await this.dataCollectionService.collectData();
	}

	/**
	 * 10分間隔でデータ収集を実行する定期実行機能を開始
	 * 要件2.2: 10分経過する THEN システムは再度合計文字数を計算し、前回との差分を記録する
	 */
	private startPeriodicDataCollection(): void {
		// 既存のタイマーがあれば停止
		this.stopPeriodicDataCollection();

		// 10分間隔（600,000ミリ秒）でデータ収集を実行
		this.registerInterval(
			(this.intervalId = window.setInterval(async () => {
				console.log("Count Novels: Periodic data collection triggered");
				try {
					await this.collectData();
					console.log(
						"Count Novels: Periodic data collection completed"
					);
				} catch (error) {
					console.error(
						"Count Novels: Error during periodic data collection:",
						error
					);
				}
			}, 10 * 60 * 1000))
		); // 10分間隔

		console.log(
			"Count Novels: Periodic data collection started (10-minute interval)"
		);
	}

	/**
	 * 定期実行を停止する機能
	 * プラグイン無効化時に定期実行を停止する
	 */
	private stopPeriodicDataCollection(): void {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = undefined;
			console.log("Count Novels: Periodic data collection stopped");
		}
	}
}
