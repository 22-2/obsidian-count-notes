import log from "loglevel";
import { Plugin, TFile, Notice } from "obsidian";
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
// @ts-expect-error: inline worker import
import SchedulerWorker from "./workers/scheduler.worker.ts";

const COLLECTION_INTERVAL = 10 * 60 * 1000; // 10分間隔
const STATUS_BAR_UPDATE_INTERVAL = 60 * 1000; // 1分間隔

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;
	statsStorage!: StatsStorage;
	dataCollectionService!: DataCollectionService;
	statusBarItemEl!: HTMLElement;

	schedulerWorker?: Worker;

	async onload() {
		try {
			this.app.workspace.onLayoutReady(async () => {
				await this.initializeServices();
				await this.setupUI();
				
				// データの初期ロードと収集
				await this.dataStorage.loadData();
				await this.dataCollectionService.collectData();
				this.updateStatusBar();

				// Workerのセットアップと開始
				setupAndStartWorker(this);
			});
		} catch (error) {
			log.error("Count Novels: Failed to initialize plugin:", error);
			new Notice("Count Novels: Failed to initialize.");
		}
	}

	onunload() {
		this.terminateWorker();
	}

	terminateWorker() {
		if (this.schedulerWorker) {
			try {
				this.schedulerWorker.postMessage({ cmd: "stop" });
				this.schedulerWorker.terminate();
			} catch (e) {
				log.error("Count Novels: Failed to terminate worker", e);
			}
			this.schedulerWorker = undefined;
		}
	}

	async loadSettings(): Promise<void> {
		try {
			const pluginData = await this.dataStorage.loadData();
			const loadedSettings = migrateSettings(pluginData.settings);

			this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
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
			refreshViews(this);
		} catch (error) {
			log.error("Count Novels: Data collection failed:", error);
			throw error;
		}
	}

	updateStatusBar(): void {
		const lastCollectedAt = this.dataStorage.getData()?.lastCollectedAt;
		this.statusBarItemEl.setText(formatStatusBarText(lastCollectedAt));
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

	private async initializeServices(): Promise<void> {
		this.dataStorage = new DataStorage(this);
		this.statsStorage = new StatsStorage();
		this.dataCollectionService = new DataCollectionService(
			this,
			this.statsStorage
		);
		await this.loadSettings();
		configureLogging(this.settings.logLevel);
		registerFileModificationHandler(this);
	}

	private async setupUI(): Promise<void> {
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.registerView(VIEW_TYPE_COUNT_NOVEL, (leaf) => {
			const view = new CountNovelView(leaf);
			view.setPlugin(this);
			return view;
		});
		registerCommands(this);
		this.statusBarItemEl = this.addStatusBarItem();
	}
}

// ===== Helper Functions =====

function setupAndStartWorker(plugin: CountNovelsPlugin): void {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const factory = SchedulerWorker as any;
		plugin.schedulerWorker = factory();

		if (!plugin.schedulerWorker) {
			throw new Error("Worker factory returned undefined");
		}

		// イベントハンドラの登録
		plugin.schedulerWorker.onmessage = (ev: MessageEvent) => {
			const data = ev.data as any;
			if (!data) return;

			if (data.type === "collect") {
				plugin.collectData().catch((err) => 
					log.error("Count Novels: Scheduled collection failed", err)
				);
			} else if (data.type === "status") {
				plugin.updateStatusBar();
			} else if (data.type === "tick") {
				const now = typeof data.now === 'number' ? data.now : Date.now();
				// forward tick to all CountNovelView instances
				plugin.app.workspace.iterateAllLeaves((leaf) => {
					try {
						if (leaf.view.getViewType() === VIEW_TYPE_COUNT_NOVEL) {
							const view = leaf.view as any;
							if (typeof view.handleTick === 'function') {
								view.handleTick(now);
							}
						}
					} catch (_e) {
						// ignore per-leaf errors
					}
				});
			}
		};

		// 計測開始（tickInterval を追加）
		plugin.schedulerWorker.postMessage({
			cmd: "start",
			collectInterval: COLLECTION_INTERVAL,
			statusInterval: STATUS_BAR_UPDATE_INTERVAL,
			tickInterval: 1000,
		});

		log.log("Count Novels: Scheduler worker started.");
	} catch (e) {
		const msg = "Count Novels: Critical Error - Scheduler Worker failed to start.";
		log.error(msg, e);
		try { new Notice(msg); } catch (_e) {}
		plugin.schedulerWorker = undefined;
	}
}
function migrateSettings(loadedSettings: any): any {
	if (!loadedSettings) return loadedSettings;
	if (loadedSettings.trackingTag && !loadedSettings.trackingTags) {
		loadedSettings.trackingTags = [loadedSettings.trackingTag];
		delete loadedSettings.trackingTag;
	}
	return loadedSettings;
}

function configureLogging(level: log.LogLevelDesc): void {
	Object.values(log.getLoggers()).forEach((logger) => {
		logger.setLevel(level);
	});
}

function registerFileModificationHandler(plugin: CountNovelsPlugin): void {
	plugin.registerEvent(
		plugin.app.vault.on("modify", async (file) => {
			if (!(file instanceof TFile) || file.extension !== "md") return;

			if (isPathInExcludedFolders(file.path, plugin.settings.excludedFolders)) {
				return;
			}

			const tags = getAllTags(file.path, plugin.app);
			const hasTrackingTag = plugin.settings.trackingTags.some((tag) =>
				tags.includes(tag.tag)
			);

			if (hasTrackingTag) {
				log.debug(`Count Novels: File modified: ${file.path}`);
				await plugin.collectData().catch((err) => {
					log.error("Count Novels: Modification update failed:", err);
				});
			}
		})
	);
}

function registerCommands(plugin: CountNovelsPlugin): void {
	plugin.addCommand({
		id: "open-count-novels-home",
		name: "Open Count Novels Home",
		callback: () => openCountNovelsView(plugin),
	});

	plugin.addCommand({
		id: "collect-data-manually",
		name: "Collect Data Manually (Debug)",
		callback: () => plugin.handleManualDataCollection(),
	});
}

async function openCountNovelsView(plugin: CountNovelsPlugin): Promise<void> {
	try {
		const existingLeaf = plugin.app.workspace.getLeavesOfType(
			VIEW_TYPE_COUNT_NOVEL
		)[0];

		if (existingLeaf) {
			plugin.app.workspace.revealLeaf(existingLeaf);
		} else {
			const leaf = plugin.app.workspace.getRightLeaf(false)!;
			await leaf.setViewState({
				type: VIEW_TYPE_COUNT_NOVEL,
				active: true,
			});
			plugin.app.workspace.revealLeaf(leaf);
		}
	} catch (error) {
		log.error("Count Novels: Failed to open view:", error);
	}
}

async function refreshViews(plugin: CountNovelsPlugin): Promise<void> {
	const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_COUNT_NOVEL);
	// 各ビューを順次更新して競合を防ぐ
	for (const leaf of leaves) {
		const view = leaf.view as CountNovelView;
		// ビューが完全に初期化されている場合のみ更新
		await view.renderView?.();
	}
}

function formatStatusBarText(lastCollectedAt: string | undefined): string {
	if (!lastCollectedAt) return "Count Novels: No data";

	const lastCollectedDate = new Date(lastCollectedAt);
	const now = new Date();
	const diffInMinutes = Math.floor(
		(now.getTime() - lastCollectedDate.getTime()) / (1000 * 60)
	);

	if (diffInMinutes < 1) return "Count Novels: Just now";
	return `Count Novels: ${diffInMinutes}m ago`;
}
