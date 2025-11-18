import { PluginSettingTab, Setting } from "obsidian";
import type CountNovelsPlugin from "./main";
import { type CountNovelsSettings } from "./schemas";
import { parseExcludedFoldersInput } from "./utils/excludedFolders";
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

		new Setting(this.containerEl)
			.setName("Tracking Tag")
			.setDesc(
				"Tag used to identify files for character counting (default: novel)"
			)
			.addText((text) => {
				text.setPlaceholder("novel")
					.setValue(this.plugin.settings.trackingTag)
					.onChange(async (value) => {
						this.plugin.settings.trackingTag = value || "novel";
						await this.plugin.saveSettings();
					});
			});

		new Setting(this.containerEl)
			.setName("Excluded Folders")
			.setDesc(
				"Relative folders to skip even when tagged. Enter one folder per line."
			)
			.addTextArea((text) => {
				text.setPlaceholder("Archive\nDrafts/Personal")
					.setValue(this.plugin.settings.excludedFolders.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = parseExcludedFoldersInput(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
			});
	}
}

// DEFAULT_SETTINGSはschemas.tsに移動
