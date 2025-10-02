import log from "loglevel";
import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { DataStorage } from "./data";
import {
	CountNovelsSettingTab,
	type CountNovelsSettings,
	DEFAULT_SETTINGS,
} from "./settings";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;

	async onload() {
		// データストレージを初期化
		this.dataStorage = new DataStorage(this);

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

		// プラグインデータを読み込み
		await this.dataStorage.loadData();
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
