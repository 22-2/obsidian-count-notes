import { PluginSettingTab, Setting } from "obsidian";
import type MyPlugin from "./main";

export interface MyPluginSettings {
	logLevel: any;
}
export class MyPluginSettingTab extends PluginSettingTab {
	constructor(public plugin: MyPlugin) {
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
						this.plugin.initializeLogger();
					});
			});
	}
}
