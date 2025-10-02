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
	private intervalId?: number;

	async onload() {
		try {
			await this.initializeServices();
			await this.setupUI();
			await this.startDataCollection();
		} catch (error) {
			console.error("Count Novels: Failed to initialize plugin:", error);
		}
	}

	private async initializeServices(): Promise<void> {
		this.dataStorage = new DataStorage(this);
		this.dataCollectionService = new DataCollectionService(this);
		await this.loadSettings();
		this.configureLogging();
	}

	private async setupUI(): Promise<void> {
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.registerView(VIEW_TYPE_COUNT_NOVEL, (leaf) => {
			const view = new CountNovelHome(leaf);
			view.setPlugin(this);
			return view;
		});
		this.registerCommands();
	}

	private registerCommands(): void {
		this.addCommand({
			id: "open-count-novels-home",
			name: "Open Count Novels Home",
			callback: () => this.openCountNovelsView(),
		});

		this.addCommand({
			id: "collect-data-manually",
			name: "Collect Data Manually (Debug)",
			callback: () => this.handleManualDataCollection(),
		});
	}

	private async openCountNovelsView(): Promise<void> {
		try {
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({
				type: VIEW_TYPE_COUNT_NOVEL,
				active: true,
			});
		} catch (error) {
			console.error("Count Novels: Failed to open view:", error);
		}
	}

	private async handleManualDataCollection(): Promise<void> {
		console.log("Count Novels: Manual data collection triggered");
		try {
			await this.collectData();
			console.log("Count Novels: Manual data collection completed");
		} catch (error) {
			console.error("Count Novels: Manual data collection failed:", error);
		}
	}

	private async startDataCollection(): Promise<void> {
		await this.dataStorage.loadData();
		await this.dataCollectionService.collectData();
		this.startPeriodicDataCollection();
	}

	onunload() {
		this.stopPeriodicDataCollection();
	}

	private configureLogging(): void {
		this.togglLoggersBy(this.settings.logLevel);
	}

	private togglLoggersBy(
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

	async loadSettings(): Promise<void> {
		try {
			const pluginData = await this.dataStorage.loadData();
			this.settings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				pluginData.settings
			);
		} catch (error) {
			console.error("Count Novels: Failed to load settings:", error);
			this.settings = DEFAULT_SETTINGS;
		}
	}

	async saveSettings(): Promise<void> {
		try {
			this.dataStorage.updateData({ settings: this.settings });
			await this.dataStorage.saveData();
		} catch (error) {
			console.error("Count Novels: Failed to save settings:", error);
		}
	}

	async collectData(): Promise<void> {
		try {
			await this.dataCollectionService.collectData();
		} catch (error) {
			console.error("Count Novels: Data collection failed:", error);
			throw error;
		}
	}

	private startPeriodicDataCollection(): void {
		this.stopPeriodicDataCollection();

		const COLLECTION_INTERVAL = 10 * 60 * 1000; // 10分間隔

		this.registerInterval(
			(this.intervalId = window.setInterval(
				() => this.handlePeriodicDataCollection(),
				COLLECTION_INTERVAL
			))
		);

		console.log("Count Novels: Periodic data collection started (10-minute interval)");
	}

	private async handlePeriodicDataCollection(): Promise<void> {
		console.log("Count Novels: Periodic data collection triggered");
		try {
			await this.collectData();
			console.log("Count Novels: Periodic data collection completed");
		} catch (error) {
			console.error("Count Novels: Error during periodic data collection:", error);
		}
	}

	private stopPeriodicDataCollection(): void {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = undefined;
			console.log("Count Novels: Periodic data collection stopped");
		}
	}
}
