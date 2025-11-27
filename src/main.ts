import log from "loglevel";
import { Plugin, TFile } from "obsidian";
import { CountNovelView } from "./CountNovelView";
import { DataStorage } from "./data";
import { DEFAULT_SETTINGS, type CountNovelsSettings } from "./schemas";
import { DataCollectionService } from "./services/dataCollection";
import { StatsStorage } from "./services/statsStorage";
import { CountNovelsSettingTab } from "./settings";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";
import { getAllTags } from "./utils/markdwon";
import {
	isPathInExcludedFolders,
	normalizeExcludedFolders,
} from "./utils/excludedFolders";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;
	statsStorage!: StatsStorage;
	dataCollectionService!: DataCollectionService;
	private dataCollectionIntervalId?: number;
	private statusBarUpdateIntervalId?: number;
	statusBarItemEl!: HTMLElement;

	async onload() {
		try {
			this.app.workspace.onLayoutReady(async () => {
				await this.initializeServices();
				await this.setupUI();
				await this.startDataCollection();
				this.updateStatusBar();
			});
		} catch (error) {
			log.error("Count Novels: Failed to initialize plugin:", error);
		}
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

		// Monitor file modifications to trigger data collection
		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!(file instanceof TFile) || file.extension !== "md") {
					return;
				}

				if (
					isPathInExcludedFolders(
						file.path,
						this.settings.excludedFolders
					)
				) {
					log.debug(
						`Count Novels: Ignoring excluded file modification: ${file.path}`
					);
					return;
				}

				const tags = getAllTags(file.path, this.app);

				const hasTrackingTag = this.settings.trackingTags.some((tag) =>
					tags.includes(tag)
				);

				if (!hasTrackingTag) {
					return;
				}

				log.debug(
					`Count Novels: Detected modification in file: ${file.path}`
				);
				await this.collectData().catch((err) => {
					log.error(
						"Count Novels: Error collecting data after file modification:",
						err
					);
					throw err;
				});
			})
		);
	}

	private async setupUI(): Promise<void> {
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.registerView(VIEW_TYPE_COUNT_NOVEL, (leaf) => {
			const view = new CountNovelView(leaf);
			view.setPlugin(this);
			return view;
		});
		this.registerCommands();
		this.statusBarItemEl = this.addStatusBarItem();
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
			// 既存のビューがあるかチェック
			const existingLeaf = this.app.workspace.getLeavesOfType(
				VIEW_TYPE_COUNT_NOVEL
			)[0];

			if (existingLeaf) {
				// 既存のビューをアクティブにする
				this.app.workspace.revealLeaf(existingLeaf);
			} else {
				// 新しいビューを作成
				const leaf = this.app.workspace.getRightLeaf(false)!;
				await leaf.setViewState({
					type: VIEW_TYPE_COUNT_NOVEL,
					active: true,
				});
				this.app.workspace.revealLeaf(leaf);
			}
		} catch (error) {
			log.error("Count Novels: Failed to open view:", error);
		}
	}

	public async handleManualDataCollection(): Promise<void> {
		log.debug("Count Novels: Manual data collection triggered");
		try {
			await this.collectData();
			log.debug("Count Novels: Manual data collection completed");
		} catch (error) {
			log.error("Count Novels: Manual data collection failed:", error);
		}
	}

	private async startDataCollection(): Promise<void> {
		await this.dataStorage.loadData();
		await this.dataCollectionService.collectData();
		this.startPeriodicDataCollection();
		this.startStatusBarUpdate();
	}

	onunload() {
		this.stopPeriodicDataCollection();
		this.stopStatusBarUpdate();
	}

	updateStatusBar(): void {
		const lastCollectedAt = this.dataStorage.getData()?.lastCollectedAt;
		if (!lastCollectedAt) {
			this.statusBarItemEl.setText("Count Novels: No data collected yet");
			return;
		}

		const lastCollectedDate = new Date(lastCollectedAt);
		const now = new Date();
		const diffInMinutes = Math.floor(
			(now.getTime() - lastCollectedDate.getTime()) / (1000 * 60)
		);

		if (diffInMinutes < 1) {
			this.statusBarItemEl.setText("Count Novels: Measured just now");
			return;
		}

		this.statusBarItemEl.setText(
			`Count Novels: Measured ${diffInMinutes} minutes ago`
		);
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

			// Migration: trackingTag -> trackingTags
			const loadedSettings = pluginData.settings as any;
			if (
				loadedSettings &&
				loadedSettings.trackingTag &&
				!loadedSettings.trackingTags
			) {
				loadedSettings.trackingTags = [loadedSettings.trackingTag];
				delete loadedSettings.trackingTag;
			}

			this.settings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				loadedSettings
			);
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

	async collectData(): Promise<void> {
		try {
			await this.dataCollectionService.collectData();
			this.dataStorage.updateLastCollectedAt(new Date().toISOString());
			await this.dataStorage.saveData();
			this.updateStatusBar();
			this.refreshViews();
		} catch (error) {
			log.error("Count Novels: Data collection failed:", error);
			throw error;
		}
	}

	private refreshViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === VIEW_TYPE_COUNT_NOVEL) {
				const view = leaf.view as CountNovelView;
				view.renderView();
			}
		});
	}

	private startPeriodicDataCollection(): void {
		this.stopPeriodicDataCollection();

		const COLLECTION_INTERVAL = 10 * 60 * 1000; // 10分間隔

		this.registerInterval(
			(this.dataCollectionIntervalId = window.setInterval(
				() => this.handlePeriodicDataCollection(),
				COLLECTION_INTERVAL
			))
		);

		log.log(
			"Count Novels: Periodic data collection started (10-minute interval)"
		);
	}

	private async handlePeriodicDataCollection(): Promise<void> {
		log.log("Count Novels: Periodic data collection triggered");
		try {
			await this.collectData();
			log.log("Count Novels: Periodic data collection completed");
		} catch (error) {
			log.error(
				"Count Novels: Error during periodic data collection:",
				error
			);
		}
	}

	private stopPeriodicDataCollection(): void {
		if (this.dataCollectionIntervalId) {
			window.clearInterval(this.dataCollectionIntervalId);
			this.dataCollectionIntervalId = undefined;
			log.log("Count Novels: Periodic data collection stopped");
		}
	}

	private startStatusBarUpdate(): void {
		this.stopStatusBarUpdate();

		const STATUS_BAR_UPDATE_INTERVAL = 60 * 1000; // 1分間隔

		this.registerInterval(
			(this.statusBarUpdateIntervalId = window.setInterval(
				() => this.updateStatusBar(),
				STATUS_BAR_UPDATE_INTERVAL
			))
		);

		log.log("Count Novels: Status bar update started (1-minute interval)");
	}

	private stopStatusBarUpdate(): void {
		if (this.statusBarUpdateIntervalId) {
			window.clearInterval(this.statusBarUpdateIntervalId);
			this.statusBarUpdateIntervalId = undefined;
			log.log("Count Novels: Status bar update stopped");
		}
	}
}
