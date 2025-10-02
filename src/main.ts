import log from "loglevel";
import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { DataStorage } from "./data";
import {
	CountNovelsSettingTab,
	type CountNovelsSettings,
	DEFAULT_SETTINGS,
} from "./settings";
import { DataCollectionService } from "./services/dataCollection";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;
	dataCollectionService!: DataCollectionService;

	async onload() {
		// データストレージを初期化
		this.dataStorage = new DataStorage(this);
		
		// データ収集サービスを初期化
		this.dataCollectionService = new DataCollectionService(this);

		await this.loadSettings();
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.togglLoggersBy(this.settings.logLevel);
		this.registerView(
			VIEW_TYPE_COUNT_NOVEL,
			(leaf) => new CountNovelHome(leaf)
		);
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
	}

	onunload() {}

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
}

class CountNovelHome extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_COUNT_NOVEL;
	}

	getDisplayText() {
		return "Count Novels Home";
	}

	async onOpen() {
		this.containerEl.empty();
		this.containerEl.createEl("h1", { text: "Count Novels Home" });
		this.containerEl.createEl("p", {
			text: "Welcome to the Count Novels plugin!",
		});
	}

	async onClose() {}
}
