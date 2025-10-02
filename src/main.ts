import log from "loglevel";
import { Plugin } from "obsidian";
import {
	CountNovelsSettingTab,
	CountNovelsSettings,
	DEFAULT_SETTINGS,
} from "./settings";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.togglLoggersBy(this.settings.logLevel);
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
