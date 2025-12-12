import { PluginSettingTab, Setting, SuggestModal, App } from "obsidian";
import type CountNovelsPlugin from "./main";
import { type CountNovelsSettings } from "./schemas";
import { parseExcludedFoldersInput } from "./utils/excludedFolders";
import { getAllVaultTags } from "src/utils/tags";

class TagSuggestModal extends SuggestModal<string> {
	constructor(app: App, private onChoose: (tag: string) => void) {
		super(app);
	}

	getSuggestions(query: string): string[] {
		const tags = getAllVaultTags(this.app);
		return tags.filter((tag) =>
			tag.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(tag: string, el: HTMLElement) {
		el.createEl("div", { text: tag });
	}

	onChooseSuggestion(tag: string, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(tag);
	}
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

		new Setting(this.containerEl)
			.setName("Tracking Tags")
			.setDesc("Tags used to identify files for character counting.")
			.addButton((button) => {
				button.setButtonText("Add Tag").onClick(() => {
					new TagSuggestModal(this.app, async (tag) => {
						if (
							!this.plugin.settings.trackingTags.some((t) => t.tag === tag)
						) {
							this.plugin.settings.trackingTags.push({
								tag: tag,
								isActive: true,
							});
							await this.plugin.saveSettings();
							this.display();
						}
					}).open();
				});
			});

		this.plugin.settings.trackingTags.forEach((tagConfig, index) => {
			new Setting(this.containerEl)
				.setName(tagConfig.tag)
				.addToggle((toggle) => {
					toggle
						.setValue(tagConfig.isActive)
						.setTooltip("Enable tracking for this tag")
						.onChange(async (value) => {
							this.plugin.settings.trackingTags[index].isActive = value;
							await this.plugin.saveSettings();
						});
				})
				.addButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Remove this tag")
						.onClick(async () => {
							this.plugin.settings.trackingTags.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						});
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
