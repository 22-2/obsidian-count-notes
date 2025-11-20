import { ItemView, Setting, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { ChartComponent } from "./components/ChartComponent";
import { StatsComponent } from "./components/StatsComponent";
import { TabComponent } from "./components/TabComponent";
import type CountNovelsPlugin from "./main";
import type { CountNovelViewState, DailyStats, PeriodType } from "./schemas";
import { PeriodDataService } from "./services/periodDataService";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export interface CountNovelViewStateCompat extends CountNovelViewState {
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
		this.periodDataService = new PeriodDataService(plugin.statsStorage);
	}

	getIcon() {
		return "chart-column-big";
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
		return super.setState(state, result);
	}

	getState(): CountNovelViewStateCompat {
		return {
			period: this.getCurrentPeriod(),
		};
	}

	async onOpen() {
		try {
			this.loadViewStateFromData();
			await this.renderView();
		} catch (error) {
			console.error("Count Novels: Failed to open view:", error);
			this.renderErrorMessage();
		}
	}

	async onClose() {
		try {
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

	public async renderView(): Promise<void> {
		if (!this.plugin || !this.periodDataService) {
			this.renderErrorMessage();
			return;
		}

		this.containerEl.empty();
		const mainContainer = this.containerEl.createDiv("count-novels-main");

		const hasData = await this.hasValidData();
		if (!hasData) {
			this.renderNoDataMessage(mainContainer);
		} else {
			await this.renderMainInterface(mainContainer);
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

	private async hasValidData(): Promise<boolean> {
		const dailyStats: DailyStats =
			await this.plugin.statsStorage.getDailyStats();
		const lastTotal =
			await this.plugin.statsStorage.getLastTotalCharacterCount();
		return (
			(dailyStats && Object.keys(dailyStats).length > 0) ||
			lastTotal !== null
		);
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
		new Setting(noDataContainer).addButton((btn) => {
			btn.setButtonText("ビューの更新");
			btn.setCta();
			btn.onClick(() => {
				this.plugin.handleManualDataCollection();
			});
		});
	}

	private async renderMainInterface(container: HTMLElement): Promise<void> {
		try {
			const tabSection = container.createDiv("count-novels-tabs-section");
			this.createTabComponent(tabSection);

			const summarySection = container.createDiv("count-novels-summary");
			this.createStatsComponent(summarySection);

			const chartSection = container.createDiv("count-novels-chart");
			const chartContent = chartSection.createDiv(
				"count-novels-chart-content"
			);
			this.createChartComponent(chartContent);

			await this.updateContent();
		} catch (error) {
			console.error(
				"Count Novels: Failed to render main interface:",
				error
			);
			this.renderErrorMessage();
		}
	}

	private createTabComponent(container: HTMLElement): void {
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

	private async onTabChange(periodType: PeriodType): Promise<void> {
		try {
			this.currentPeriod = periodType;
			await this.updateContent();
			await this.saveViewStateToData();
		} catch (error) {
			console.error("Count Novels: Failed to change tab:", error);
		}
	}

	private async updateContent(): Promise<void> {
		if (
			!this.periodDataService ||
			!this.statsComponent ||
			!this.chartComponent
		) {
			return;
		}

		try {
			const stats = await this.periodDataService.getPeriodStats(
				this.currentPeriod
			);
			this.statsComponent.render(stats, this.currentPeriod);

			const chartData = await this.periodDataService.getChartData(
				this.currentPeriod
			);
			this.chartComponent.render(chartData, this.currentPeriod);
		} catch (error) {
			console.error("Count Novels: Failed to update content:", error);
		}
	}

	public async refreshView(): Promise<void> {
		try {
			await this.renderView();
		} catch (error) {
			console.error("Count Novels: Failed to refresh view:", error);
		}
	}

	public async refreshSummary(): Promise<void> {
		try {
			await this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to refresh summary:", error);
		}
	}

	public async refreshChart(): Promise<void> {
		try {
			await this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to refresh chart:", error);
		}
	}

	public async refreshStats(): Promise<void> {
		try {
			await this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to refresh stats:", error);
		}
	}

	public getCurrentPeriod(): PeriodType {
		return this.currentPeriod;
	}

	public async setPeriod(periodType: PeriodType): Promise<void> {
		try {
			this.currentPeriod = periodType;
			if (this.tabComponent) {
				this.tabComponent.setActiveTab(periodType);
			}
			await this.updateContent();
		} catch (error) {
			console.error("Count Novels: Failed to set period:", error);
		}
	}

	private loadViewStateFromData(): void {
		try {
			const pluginData = this.plugin.dataStorage.getData();
			if (pluginData?.lastViewState?.period) {
				this.currentPeriod = pluginData.lastViewState.period;
			}
		} catch (error) {
			console.error(
				"Count Novels: Failed to load view state from data:",
				error
			);
		}
	}

	private async saveViewStateToData(): Promise<void> {
		try {
			this.plugin.dataStorage.updateViewState(this.currentPeriod);
			await this.plugin.dataStorage.saveData();
		} catch (error) {
			console.error(
				"Count Novels: Failed to save view state to data:",
				error
			);
		}
	}
}
