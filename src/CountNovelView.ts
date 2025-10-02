import { ItemView, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { ChartComponent } from "./components/ChartComponent";
import { StatsComponent } from "./components/StatsComponent";
import { TabComponent } from "./components/TabComponent";
import type CountNovelsPlugin from "./main";
import { PeriodDataService } from "./services/periodDataService";
import type { PeriodType, CountNovelViewState } from "./schemas";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

// CountNovelViewStateはschemas.tsに移動
// Obsidian API互換性のための拡張
export interface CountNovelViewStateCompat extends CountNovelViewState {
	// DONT REMOVE THIS LINE
	// COMPAT FOR OBSIDIAN API
	[key: string]: any;
}

export class CountNovelView extends ItemView {
	private plugin!: CountNovelsPlugin;
	private tabComponent?: TabComponent;
	private statsComponent?: StatsComponent;
	private chartComponent?: ChartComponent;
	private periodDataService?: PeriodDataService;
	private currentPeriod: PeriodType = "month";

	navigation = true;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	setPlugin(plugin: CountNovelsPlugin): void {
		this.plugin = plugin;
		this.periodDataService = new PeriodDataService(plugin.dataStorage);
	}

	getViewType() {
		return VIEW_TYPE_COUNT_NOVEL;
	}

	getDisplayText() {
		return "Count Novels Home";
	}

	setState(
		state: CountNovelViewStateCompat,
		result: ViewStateResult
	): Promise<void> {
		// data.jsonを使うのでstate APIは使用しない
		return super.setState(state, result);
	}

	getState(): CountNovelViewStateCompat {
		// data.jsonを使うのでstate APIは使用しない
		return {
			period: this.getCurrentPeriod(),
		};
	}

	async onOpen() {
		try {
			// data.jsonから前回のビュー状態を復元
			this.loadViewStateFromData();
			console.log("onOpen called, restored period:", this.currentPeriod);
			this.renderView();
		} catch (error) {
			console.error("Count Novels: Failed to open view:", error);
			this.renderErrorMessage();
		}
	}

	async onClose() {
		try {
			// ビュー状態をdata.jsonに保存
			await this.saveViewStateToData();
			this.cleanup();
		} catch (error) {
			console.error("Count Novels: Error during cleanup:", error);
		}
	}

	private cleanup(): void {
		if (this.chartComponent) {
			this.chartComponent.destroy();
			this.chartComponent = undefined;
		}
		this.tabComponent = undefined;
		this.statsComponent = undefined;
		this.periodDataService = undefined;
	}

	private renderView(): void {
		if (!this.plugin || !this.periodDataService) {
			this.renderErrorMessage();
			return;
		}

		this.containerEl.empty();
		const mainContainer = this.containerEl.createDiv("count-novels-main");

		const hasData = this.hasValidData();
		if (!hasData) {
			this.renderNoDataMessage(mainContainer);
		} else {
			this.renderMainInterface(mainContainer);
		}
	}

	private renderErrorMessage(): void {
		this.containerEl.empty();
		const errorContainer = this.containerEl.createDiv("count-novels-error");
		errorContainer.createEl("p", {
			text: "プラグインの初期化に失敗しました",
			cls: "count-novels-error-message",
		});
	}

	private hasValidData(): boolean {
		const pluginData = this.plugin.dataStorage.getData();
		return !!(pluginData && Object.keys(pluginData.dailyStats).length > 0);
	}

	private renderNoDataMessage(container: HTMLElement): void {
		const noDataContainer = container.createDiv("count-novels-no-data");

		noDataContainer.createEl("p", {
			text: "データがありません",
			cls: "count-novels-no-data-message",
		});

		noDataContainer.createEl("p", {
			text: "執筆を開始すると、ここに進捗が表示されます。",
			cls: "count-novels-no-data-subtitle",
		});
	}

	private renderMainInterface(container: HTMLElement): void {
		try {
			// タブセクション
			const tabSection = container.createDiv("count-novels-tabs-section");
			this.createTabComponent(tabSection);

			// 統計セクション
			const summarySection = container.createDiv("count-novels-summary");
			this.createStatsComponent(summarySection);

			// チャートセクション
			const chartSection = container.createDiv("count-novels-chart");
			const chartContent = chartSection.createDiv(
				"count-novels-chart-content"
			);
			this.createChartComponent(chartContent);

			// 初期データを表示
			this.updateContent();
		} catch (error) {
			console.error(
				"Count Novels: Failed to render main interface:",
				error
			);
			this.renderErrorMessage();
		}
	}

	private createTabComponent(container: HTMLElement): void {
		console.log("Creating tab component with period:", this.currentPeriod);
		this.tabComponent = new TabComponent(
			container,
			(periodType: PeriodType) => this.onTabChange(periodType),
			this.currentPeriod
		);
	}

	private createStatsComponent(container: HTMLElement): void {
		this.statsComponent = new StatsComponent(container);
	}

	private createChartComponent(container: HTMLElement): void {
		this.chartComponent = new ChartComponent(container);
	}

	private onTabChange(periodType: PeriodType): void {
		try {
			this.currentPeriod = periodType;
			this.updateContent();
			// タブ変更時にもdata.jsonに保存
			this.saveViewStateToData();
		} catch (error) {
			console.error("Count Novels: Failed to change tab:", error);
		}
	}

	private updateContent(): void {
		if (
			!this.periodDataService ||
			!this.statsComponent ||
			!this.chartComponent
		) {
			return;
		}

		try {
			// 統計データを取得して表示
			const stats = this.periodDataService.getPeriodStats(
				this.currentPeriod
			);
			this.statsComponent.render(stats, this.currentPeriod);

			// チャートデータを取得して表示
			const chartData = this.periodDataService.getChartData(
				this.currentPeriod
			);
			this.chartComponent.render(chartData, this.currentPeriod);
		} catch (error) {
			console.error("Count Novels: Failed to update content:", error);
		}
	}

	public refreshView(): void {
		try {
			this.renderView();
		} catch (error) {
			console.error("Count Novels: Failed to refresh view:", error);
		}
	}

	public refreshSummary(): void {
		try {
			this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to refresh summary:", error);
		}
	}

	public refreshChart(): void {
		try {
			this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to refresh chart:", error);
		}
	}

	public refreshStats(): void {
		try {
			this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to refresh stats:", error);
		}
	}

	public getCurrentPeriod(): PeriodType {
		return this.currentPeriod;
	}

	public setPeriod(periodType: PeriodType): void {
		try {
			this.currentPeriod = periodType;
			if (this.tabComponent) {
				this.tabComponent.setActiveTab(periodType);
			}
			console.log("Period set to:", this.currentPeriod);
			this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to set period:", error);
		}
	}

	/**
	 * data.jsonから前回のビュー状態を読み込む
	 */
	private loadViewStateFromData(): void {
		try {
			const pluginData = this.plugin.dataStorage.getData();
			if (pluginData?.lastViewState?.period) {
				this.currentPeriod = pluginData.lastViewState.period;
				console.log("Loaded view state from data.json:", this.currentPeriod);
			}
		} catch (error) {
			console.error("Count Novels: Failed to load view state from data:", error);
		}
	}

	/**
	 * 現在のビュー状態をdata.jsonに保存する
	 */
	private async saveViewStateToData(): Promise<void> {
		try {
			this.plugin.dataStorage.updateViewState(this.currentPeriod);
			await this.plugin.dataStorage.saveData();
			console.log("Saved view state to data.json:", this.currentPeriod);
		} catch (error) {
			console.error("Count Novels: Failed to save view state to data:", error);
		}
	}
}
