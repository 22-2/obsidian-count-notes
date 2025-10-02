import { PluginSettingTab, Setting } from "obsidian";
import type CountNovelsPlugin from "./main";

export interface CountNovelsSettings {
	logLevel: any;
}
export class CountNovelsSettingTab extends PluginSettingTab {
	constructor(public plugin: CountNovelsPlugin) {
		super(plugin.app, plugin);
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl).setName("Plugin Settings").setHeading();

		new Setting(this.containerEl)
			.setName("Show Debug Messages")
			.setDesc("Enable or disable debug messages")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.logLevel === "debug")
					.onChange(async (val) => {
						this.plugin.settings.logLevel = val ? "debug" : "info";
						await this.plugin.saveSettings();
					});
			});
	}
}

export const DEFAULT_SETTINGS: CountNovelsSettings = {
	logLevel: "debug",
};
