import log from "loglevel";
import { Plugin, TFile, Notice } from "obsidian";
import { CountNovelView } from "./CountNovelView";
import { DataStorage } from "./data";
import { DEFAULT_SETTINGS, type CountNovelsSettings } from "./schemas";
import { DataCollectionService } from "./services/dataCollection";
import {
	setupAndStartWorker,
	terminateWorker,
} from "./services/schedulerWorkerService";
import { StatsStorage } from "./services/statsStorage";
import { CountNovelsSettingTab } from "./settings";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";
import {
	isPathInExcludedFolders,
	normalizeExcludedFolders,
} from "./utils/excludedFolders";
import { getAllTags } from "./utils/markdwon";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;
	statsStorage!: StatsStorage;
	dataCollectionService!: DataCollectionService;
	statusBarItemEl!: HTMLElement;
	schedulerWorker?: Worker;

	async onload(): Promise<void> {
		try {
			this.app.workspace.onLayoutReady(async () => {
				await this.initializePlugin();
			});
		} catch (error) {
			log.error("Count Novels: Failed to initialize plugin:", error);
			new Notice("Count Novels: Failed to initialize.");
		}
	}

	onunload(): void {
		terminateWorker(this);
	}

	async collectData(): Promise<void> {
		try {
			await this.dataCollectionService.collectData();
			this.dataStorage.updateLastCollectedAt(new Date().toISOString());
			await this.dataStorage.saveData();
			this.updateStatusBar();
		} catch (error) {
			log.error("Count Novels: Data collection failed:", error);
			throw error;
		}
	}

	updateStatusBar(): void {
		const lastCollectedAt = this.dataStorage.getData()?.lastCollectedAt;
		this.statusBarItemEl.setText(this.formatStatusBarText(lastCollectedAt));
	}

	// ===== Private Methods =====

	private async initializePlugin(): Promise<void> {
		await this.initializeServices();
		this.setupUI();
		await this.performInitialDataLoad();
		setupAndStartWorker(this);
	}

	private async initializeServices(): Promise<void> {
		this.dataStorage = new DataStorage(this);
		this.statsStorage = new StatsStorage();
		this.dataCollectionService = new DataCollectionService(
			this,
			this.statsStorage
		);
		await this.loadSettings();
		this.configureLogging();
		this.registerFileModificationHandler();
	}

	private setupUI(): void {
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.registerView(VIEW_TYPE_COUNT_NOVEL, (leaf) => {
			const view = new CountNovelView(leaf);
			view.setPlugin(this);
			return view;
		});
		this.registerCommands();
		this.statusBarItemEl = this.addStatusBarItem();
	}

	private async performInitialDataLoad(): Promise<void> {
		await this.dataStorage.loadData();
		await this.dataCollectionService.collectData();
		this.updateStatusBar();
	}

	private async loadSettings(): Promise<void> {
		try {
			const pluginData = await this.dataStorage.loadData();
			const loadedSettings = this.migrateSettings(pluginData.settings);

			this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
			this.settings.excludedFolders = normalizeExcludedFolders(
				this.settings.excludedFolders
			);
		} catch (error) {
			log.error("Count Novels: Failed to load settings:", error);
			this.settings = DEFAULT_SETTINGS;
		}
	}

	async saveSettings(): Promise<void> {
		try {
			this.settings.excludedFolders = normalizeExcludedFolders(
				this.settings.excludedFolders
			);
			this.dataStorage.updateData({ settings: this.settings });
			await this.dataStorage.saveData();
		} catch (error) {
			log.error("Count Novels: Failed to save settings:", error);
		}
	}

	private configureLogging(): void {
		for (const logger of Object.values(log.getLoggers())) {
			logger.setLevel(this.settings.logLevel);
		}
	}

	private registerFileModificationHandler(): void {
		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!this.isTrackableFile(file)) return;

				log.debug(`Count Novels: File modified: ${file.path}`);
				await this.collectData().catch((err) => {
					log.error("Count Novels: Modification update failed:", err);
				});
			})
		);
	}

	private isTrackableFile(file: unknown): file is TFile {
		if (!(file instanceof TFile) || file.extension !== "md") {
			return false;
		}

		if (isPathInExcludedFolders(file.path, this.settings.excludedFolders)) {
			return false;
		}

		const tags = getAllTags(file.path, this.app);
		return this.settings.trackingTags.some((tag) => tags.includes(tag.tag));
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
			const existingLeaf = this.app.workspace.getLeavesOfType(
				VIEW_TYPE_COUNT_NOVEL
			)[0];

			if (existingLeaf) {
				this.app.workspace.revealLeaf(existingLeaf);
			} else {
				const leaf = this.app.workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_COUNT_NOVEL,
						active: true,
					});
					this.app.workspace.revealLeaf(leaf);
				}
			}
		} catch (error) {
			log.error("Count Novels: Failed to open view:", error);
		}
	}

	async handleManualDataCollection(): Promise<void> {
		log.debug("Count Novels: Manual data collection triggered");
		try {
			await this.collectData();
			log.debug("Count Novels: Manual data collection completed");
		} catch (error) {
			log.error("Count Novels: Manual data collection failed:", error);
		}
	}

	private async refreshViews(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_COUNT_NOVEL);
		for (const leaf of leaves) {
			const view = leaf.view as CountNovelView;
			await view.renderView?.();
		}
	}

	private formatStatusBarText(lastCollectedAt: string | undefined): string {
		if (!lastCollectedAt) return "Count Novels: No data";

		const lastCollectedDate = new Date(lastCollectedAt);
		const now = new Date();
		const diffInMinutes = Math.floor(
			(now.getTime() - lastCollectedDate.getTime()) / (1000 * 60)
		);

		if (diffInMinutes < 1) return "Count Novels: Just now";
		return `Count Novels: ${diffInMinutes}m ago`;
	}

	/** 古い設定形式から新しい形式へ移行 */
	private migrateSettings(
		loadedSettings: Record<string, unknown> | undefined
	): Record<string, unknown> | undefined {
		if (!loadedSettings) return loadedSettings;

		// trackingTag → trackingTags への移行
		if (
			"trackingTag" in loadedSettings &&
			!("trackingTags" in loadedSettings)
		) {
			const settings = { ...loadedSettings };
			settings.trackingTags = [loadedSettings.trackingTag];
			delete settings.trackingTag;
			return settings;
		}

		return loadedSettings;
	}
}
