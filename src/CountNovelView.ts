import { ItemView, Setting, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { ChartComponent } from "./components/ChartComponent";
import { ClockComponent } from "./components/ClockComponent";
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
	private clockComponent?: ClockComponent;
	private currentPeriod: PeriodType = "month";
	private currentTag: string = "novel";

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
			const tags = this.plugin.settings.trackingTags;
			if (tags.length > 0) {
				// If currentTag is not in tags, reset to first tag
				if (!tags.includes(this.currentTag)) {
					this.currentTag = tags[0];
				}
			}
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
		if (this.clockComponent) {
			this.clockComponent.destroy();
			this.clockComponent = undefined;
		}
	}

	public async renderView(): Promise<void> {
		if (!this.plugin || !this.periodDataService) {
			this.renderErrorMessage();
			return;
		}

		// If a clock is mounted, destroy it before we clear the container.
		// renderView() empties DOM and recreates components; leaving the
		// old ClockComponent around would remove its element from the DOM
		// but keep its interval running, causing the clock to disappear.
		if (this.clockComponent) {
			this.clockComponent.destroy();
			this.clockComponent = undefined;
		}

		this.containerEl.empty();
		const mainContainer = this.containerEl.createDiv("count-novels-main");

		const hasData = await this.hasValidData();
		
		// Always render tag selector if multiple tags exist, even if no data yet
		this.renderTagSelector(mainContainer);

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
			await this.plugin.statsStorage.getDailyStats(this.currentTag);
		const lastTotal =
			await this.plugin.statsStorage.getLastTotalCharacterCount(this.currentTag);
		return (
			(dailyStats && Object.keys(dailyStats).length > 0) ||
			lastTotal !== null
		);
	}

	private renderNoDataMessage(container: HTMLElement): void {
		const noDataContainer = container.createDiv("count-novels-no-data");
		noDataContainer.createEl("p", {
			text: `タグ "${this.currentTag}" のデータがありません`,
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

	private renderTagSelector(container: HTMLElement): void {
		const tags = this.plugin.settings.trackingTags;
		if (tags.length <= 1) return;

		const wrapper = container.createDiv("count-novels-tag-selector");
		// Simple dropdown without label to save space, or with label
		new Setting(wrapper)
			.setName("Tag")
			.addDropdown((dropdown) => {
				tags.forEach((tag) => dropdown.addOption(tag, tag));
				dropdown.setValue(this.currentTag);
				dropdown.onChange(async (value) => {
					this.currentTag = value;
					await this.renderView();
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

			// --- 修正箇所ここから ---
			// 修正前:
			// if (!this.clockComponent) {
			//     this.clockComponent = new ClockComponent(container);
			//     this.clockComponent.mount();
			// }

			// 修正後:
			// 競合状態で古いClockが残っている可能性があるため、存在すれば確実に破棄する
			if (this.clockComponent) {
				this.clockComponent.destroy();
			}
			
			// 条件分岐(if)を外し、常に新しいコンテナ(container)に対して時計を作成する
			// If a scheduler worker exists, prefer external ticks; otherwise allow worker/interval fallback inside component
			const useWorkerFallback = !this.plugin.schedulerWorker;
			this.clockComponent = new ClockComponent(container, useWorkerFallback);
			this.clockComponent.mount();
			// --- 修正箇所ここまで ---

			await this.updateContent();
		} catch (error) {
			console.error(
				"Count Novels: Failed to render main interface:",
				error
			);
			this.renderErrorMessage();
		}
	}

	public handleTick(now?: number): void {
		if (this.clockComponent) {
			this.clockComponent.handleTick(now);
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
				this.currentPeriod,
				this.currentTag
			);
			this.statsComponent.render(stats, this.currentPeriod);

			const chartData = await this.periodDataService.getChartData(
				this.currentPeriod,
				this.currentTag
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
