import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./utils/constants";
import { DirectLogger, Logger } from "./utils/logging";
import { MyPluginSettings, MyPluginSettingTab } from "./settings";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings = DEFAULT_SETTINGS;
	logger!: DirectLogger;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MyPluginSettingTab(this));
		this.initializeLogger();
	}

	onunload() {
		this.logger.debug("Plugin unloaded");
	}

	initializeLogger(): void {
		this.logger = new DirectLogger({
			level: this.settings.logLevel,
			name: "MyPlugin",
		});
		this.logger.debug("debug mode enabled");
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
