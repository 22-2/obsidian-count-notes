import log from "loglevel";
import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import {
	CountNovelsSettingTab,
	type CountNovelsSettings,
	DEFAULT_SETTINGS,
} from "./settings";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;

	async onload() {
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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
