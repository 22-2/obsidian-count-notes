import { ItemView, WorkspaceLeaf } from "obsidian";
import { ChartComponent } from "./components/ChartComponent";
import { StatsComponent } from "./components/StatsComponent";
import { TabComponent } from "./components/TabComponent";
import type CountNovelsPlugin from "./main";
import { PeriodDataService } from "./services/periodDataService";
import type { PeriodType } from "./types/period";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export class CountNovelHome extends ItemView {
	private plugin!: CountNovelsPlugin;
	private tabComponent?: TabComponent;
	private statsComponent?: StatsComponent;
	private chartComponent?: ChartComponent;
	private periodDataService?: PeriodDataService;
	private currentPeriod: PeriodType = "month";

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

	async onOpen() {
		try {
			this.renderView();
		} catch (error) {
			console.error("Count Novels: Failed to open view:", error);
			this.renderErrorMessage();
		}
	}

	async onClose() {
		try {
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
			if (this.tabComponent) {
				this.tabComponent.setActiveTab(periodType);
			} else {
				this.currentPeriod = periodType;
				this.updateContent();
			}
		} catch (error) {
			console.error("Count Novels: Failed to set period:", error);
		}
	}
}
