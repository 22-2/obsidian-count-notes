import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	Legend,
	LinearScale,
	Title,
	Tooltip,
	type ChartConfiguration,
	type ChartData,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { ItemView, WorkspaceLeaf } from "obsidian";
import type CountNovelsPlugin from "./main";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export class CountNovelHome extends ItemView {
	private plugin!: CountNovelsPlugin;
	private chartInstance?: Chart;
	private readonly CHART_HEIGHT = 400;
	private readonly COLLECTION_INTERVAL_MINUTES = 10;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.initializeChartJS();
	}

	setPlugin(plugin: CountNovelsPlugin): void {
		this.plugin = plugin;
	}

	private initializeChartJS(): void {
		Chart.register(
			BarController,
			CategoryScale,
			LinearScale,
			BarElement,
			Title,
			Tooltip,
			Legend,
			annotationPlugin
		);
	}

	private getThemeColors() {
		const isDarkTheme = document.body.classList.contains("theme-dark");

		const darkTheme = {
			textPrimary: "#ffffff",
			textSecondary: "#cccccc",
			gridColor: "#444444",
			tooltipBg: "rgba(0, 0, 0, 0.8)",
			tooltipBorder: "#666666",
			positiveColor: "rgba(100, 200, 100, 0.7)",
			positiveBorder: "rgba(100, 200, 100, 1)",
			negativeColor: "rgba(255, 140, 140, 0.7)",
			negativeBorder: "rgba(255, 140, 140, 1)",
		};

		const lightTheme = {
			textPrimary: "#222222",
			textSecondary: "#666666",
			gridColor: "#e0e0e0",
			tooltipBg: "rgba(255, 255, 255, 0.95)",
			tooltipBorder: "#cccccc",
			positiveColor: "rgba(40, 160, 40, 0.7)",
			positiveBorder: "rgba(40, 160, 40, 1)",
			negativeColor: "rgba(220, 60, 60, 0.7)",
			negativeBorder: "rgba(220, 60, 60, 1)",
		};

		return isDarkTheme ? darkTheme : lightTheme;
	}

	getViewType() {
		return VIEW_TYPE_COUNT_NOVEL;
	}

	getDisplayText() {
		return "Count Novels Home";
	}

	async onOpen() {
		this.renderView();
	}

	async onClose() {
		// Chart.jsインスタンスをクリーンアップ
		if (this.chartInstance) {
			this.chartInstance.destroy();
			this.chartInstance = undefined;
		}
	}

	private renderView(): void {
		this.containerEl.empty();
		const mainContainer = this.containerEl.createDiv("count-novels-main");

		const hasData = this.hasValidData();
		if (!hasData) {
			this.renderNoDataMessage(mainContainer);
		} else {
			this.renderStatsStructure(mainContainer);
		}
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

	private renderStatsStructure(container: HTMLElement): void {
		this.createSummarySection(container);
		this.createChartSection(container);
	}

	private createSummarySection(container: HTMLElement): void {
		const summarySection = container.createDiv("count-novels-summary");
		this.renderSummary(summarySection);
	}

	private createChartSection(container: HTMLElement): void {
		const chartSection = container.createDiv("count-novels-chart");
		const chartContent = chartSection.createDiv(
			"count-novels-chart-content"
		);
		this.renderChart(chartContent);
	}

	private renderSummary(container: HTMLElement): void {
		const summaryContent = container.createDiv(
			"count-novels-summary-content"
		);

		const stats = this.calculateAllStats();
		this.createSummaryItem(
			summaryContent,
			"1日の平均",
			stats.dailyAverage.toLocaleString(),
			"文字"
		);
		this.createSummaryItem(
			summaryContent,
			"月の合計",
			stats.monthlyTotal.toLocaleString(),
			"文字"
		);
		this.createSummaryItem(
			summaryContent,
			"継続日数",
			stats.streak.toString(),
			"日"
		);
	}

	private createSummaryItem(
		container: HTMLElement,
		label: string,
		number: string,
		unit: string
	): void {
		const item = container.createDiv("count-novels-summary-item");
		item.createEl("span", {
			text: label,
			cls: "count-novels-summary-label",
		});
		
		const valueContainer = item.createDiv("count-novels-summary-value");
		valueContainer.createEl("span", {
			text: number,
			cls: "count-novels-summary-number",
		});
		valueContainer.createEl("span", {
			text: unit,
			cls: "count-novels-summary-unit",
		});
	}

	private calculateAllStats() {
		return {
			monthlyTotal: this.calculateMonthlyTotal(),
			streak: this.calculateStreak(),
			dailyAverage: this.calculateDailyAverage(),
		};
	}

	private getCurrentMonthPrefix(): string {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		return `${currentYear}-${currentMonth.toString().padStart(2, "0")}`;
	}

	private getMonthlyData(): Array<[string, number]> {
		const pluginData = this.plugin.dataStorage.getData();
		if (!pluginData || !pluginData.dailyStats) {
			return [];
		}

		const monthPrefix = this.getCurrentMonthPrefix();
		return Object.entries(pluginData.dailyStats).filter(([date]) =>
			date.startsWith(monthPrefix)
		);
	}

	private calculateMonthlyTotal(): number {
		return this.getMonthlyData()
			.filter(([, characterDiff]) => characterDiff > 0)
			.reduce((total, [, characterDiff]) => total + characterDiff, 0);
	}

	/**
	 * 継続日数（ストリーク）を計算する機能
	 * 要件6.1: 1文字以上執筆した日を「執筆日」とカウント
	 * 要件6.2: 今日から遡って連続する執筆日数を計算
	 * 要件6.3: 執筆しなかった日がある場合は継続日数をリセット
	 * 要件6.4: 今日まだ執筆していない場合は昨日までの継続日数を表示
	 * 要件6.5: 執筆データが1日もない場合は継続日数を0として表示
	 */
	private calculateStreak(): number {
		const pluginData = this.plugin.dataStorage.getData();
		if (!pluginData || !pluginData.dailyStats) {
			// 要件6.5: 執筆データが1日もない場合は継続日数を0として表示
			return 0;
		}

		const today = new Date();
		let streak = 0;
		let currentDate = new Date(today);

		// 今日の執筆データがあるかチェック
		const todayString = this.formatDateString(today);
		const todayStats = pluginData.dailyStats[todayString];
		const hasTodayData = todayStats && todayStats > 0;

		// 要件6.4: 今日まだ執筆していない場合は昨日から開始
		if (!hasTodayData) {
			currentDate.setDate(currentDate.getDate() - 1);
		}

		// 遡って連続する執筆日数を計算
		while (true) {
			const dateString = this.formatDateString(currentDate);
			const dayStats = pluginData.dailyStats[dateString];

			// 要件6.1: 1文字以上執筆した日を「執筆日」とカウント
			if (dayStats && dayStats > 0) {
				streak++;
				currentDate.setDate(currentDate.getDate() - 1);
			} else {
				// 要件6.3: 執筆しなかった日がある場合は継続日数をリセット
				break;
			}

			// 無限ループ防止（1年以上遡らない）
			if (streak > 365) {
				break;
			}
		}

		return streak;
	}

	private calculateDailyAverage(): number {
		const monthlyData = this.getMonthlyData();
		const writingDays = monthlyData.filter(
			([, characterDiff]) => characterDiff > 0
		);

		if (writingDays.length === 0) {
			return 0;
		}

		const monthlyTotal = writingDays.reduce(
			(total, [, characterDiff]) => total + characterDiff,
			0
		);
		return Math.round(monthlyTotal / writingDays.length);
	}

	/**
	 * 日付をYYYY-MM-DD形式の文字列に変換するヘルパー関数
	 */
	private formatDateString(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private renderChart(container: HTMLElement): void {
		this.destroyExistingChart();

		const canvas = container.createEl("canvas", {
			cls: "count-novels-chart-canvas",
		});

		try {
			const chartData = this.generateChartData();
			const chartConfig = this.createChartConfiguration(chartData);
			this.chartInstance = new Chart(canvas, chartConfig);
		} catch (error) {
			console.error("Count Novels: Failed to create chart:", error);
			this.renderChartFallback(container);
		}
	}

	private destroyExistingChart(): void {
		if (this.chartInstance) {
			this.chartInstance.destroy();
			this.chartInstance = undefined;
		}
	}

	private createChartConfiguration(
		chartData: ChartData<"bar">
	): ChartConfiguration<"bar"> {
		const colors = this.getThemeColors();
		const averageValue = this.calculateAverageFromChartData(chartData);

		return {
			type: "bar",
			data: chartData,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: this.createChartPlugins(colors, averageValue),
				scales: this.createChartScales(colors, chartData),
			},
			plugins: [this.createDataLabelsPlugin(colors)],
		};
	}

	private createChartPlugins(colors: any, averageValue: number) {
		return {
			legend: {
				display: true,
				labels: {
					color: colors.textPrimary,
					font: { size: 12 },
					usePointStyle: true,
					padding: 20,
				},
			},
			tooltip: {
				backgroundColor: colors.tooltipBg,
				titleColor: colors.textPrimary,
				bodyColor: colors.textPrimary,
				borderColor: colors.tooltipBorder,
				borderWidth: 1,
				callbacks: {
					label: (context: any) => {
						const value = context.parsed.y;
						const label = context.dataset.label || "";
						return `${label}: ${value.toLocaleString()}文字`;
					},
				},
			},
			annotation: {
				annotations: {
					averageLine: {
						type: "line" as const,
						yMin: averageValue,
						yMax: averageValue,
						borderColor: "#FFD700",
						borderWidth: 2,
						borderDash: [5, 5],
						label: {
							content: "平均値",
							position: "end" as const,
							backgroundColor: "#FFD700",
							color: "#000",
							font: { size: 11 },
						},
					},
				},
			},
		};
	}

	private createChartScales(colors: any, chartData: ChartData<"bar">) {
		return {
			x: this.createXAxisConfig(colors),
			y: this.createYAxisConfig(colors, chartData),
		};
	}

	private createXAxisConfig(colors: any) {
		return {
			ticks: {
				color: colors.textSecondary,
				font: { size: 11 },
				callback: function (value: any, index: number) {
					const day = index + 1;
					if (day === 1 || (day - 1) % 5 === 0) {
						return `${day}日`;
					}
					return "";
				},
				maxTicksLimit: 7,
			},
			grid: {
				color: colors.gridColor,
				lineWidth: 1,
			},
		};
	}

	private createYAxisConfig(colors: any, chartData: ChartData<"bar">) {
		const maxValue = this.getMaxValueFromChartData(chartData);
		const stepSize = this.calculateStepSize(maxValue);

		return {
			ticks: {
				color: colors.textSecondary,
				font: { size: 11 },
				maxTicksLimit: 5,
				stepSize,
				callback: function (value: any) {
					if (typeof value === "number") {
						if (value === 0) return "0";
						if (value >= 1000) {
							return (value / 1000).toLocaleString() + "k";
						}
						return value.toLocaleString();
					}
					return value;
				},
			},
			grid: {
				color: colors.gridColor,
				lineWidth: 1,
			},
			beginAtZero: true,
		};
	}

	private calculateAverageFromChartData(chartData: ChartData<"bar">): number {
		let totalValue = 0;
		let count = 0;

		chartData.datasets.forEach((dataset) => {
			dataset.data.forEach((value) => {
				if (typeof value === "number" && value > 0) {
					totalValue += value;
					count++;
				}
			});
		});

		return count > 0 ? totalValue / count : 0;
	}

	private getMaxValueFromChartData(chartData: ChartData<"bar">): number {
		let maxValue = 0;

		chartData.datasets.forEach((dataset) => {
			dataset.data.forEach((value) => {
				if (typeof value === "number") {
					maxValue = Math.max(maxValue, Math.abs(value));
				}
			});
		});

		return maxValue;
	}

	private calculateStepSize(maxValue: number): number {
		if (maxValue === 0) return 1000;

		const rawStep = maxValue / 5;
		const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
		const normalized = rawStep / magnitude;

		let niceStep;
		if (normalized <= 1) niceStep = 1;
		else if (normalized <= 2) niceStep = 2;
		else if (normalized <= 5) niceStep = 5;
		else niceStep = 10;

		return niceStep * magnitude;
	}

	private createDataLabelsPlugin(colors: any) {
		return {
			id: "dataLabels",
			afterDatasetsDraw: (chart: any) => {
				const ctx = chart.ctx;
				chart.data.datasets.forEach(
					(dataset: any, datasetIndex: number) => {
						const meta = chart.getDatasetMeta(datasetIndex);
						if (!meta.hidden) {
							meta.data.forEach((bar: any, index: number) => {
								const value = dataset.data[index];
								if (value > 0) {
									ctx.fillStyle = colors.textPrimary;
									ctx.font = "bold 11px sans-serif";
									ctx.textAlign = "center";
									ctx.textBaseline = "bottom";
									ctx.fillText(
										value.toLocaleString(),
										bar.x,
										bar.y - 5
									);
								}
							});
						}
					}
				);
			},
		};
	}

	private generateChartData(): ChartData<"bar"> {
		const colors = this.getThemeColors();
		const pluginData = this.plugin.dataStorage.getData();

		if (!pluginData || !pluginData.dailyStats) {
			return { labels: [], datasets: [] };
		}

		const { labels, positiveData, negativeData } =
			this.processMonthlyChartData();

		return {
			labels,
			datasets: [
				{
					label: "執筆文字数",
					data: positiveData,
					backgroundColor: colors.positiveColor,
					borderColor: colors.positiveBorder,
					borderWidth: 2,
				},
				{
					label: "削除文字数",
					data: negativeData,
					backgroundColor: colors.negativeColor,
					borderColor: colors.negativeBorder,
					borderWidth: 2,
				},
			],
		};
	}

	private processMonthlyChartData() {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const monthPrefix = this.getCurrentMonthPrefix();
		const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

		const pluginData = this.plugin.dataStorage.getData();
		if (!pluginData) {
			return { labels: [], positiveData: [], negativeData: [] };
		}

		const labels: string[] = [];
		const positiveData: number[] = [];
		const negativeData: number[] = [];

		for (let day = 1; day <= daysInMonth; day++) {
			const dayString = day.toString();
			labels.push(`${dayString}日`);

			const dateKey = `${monthPrefix}-${dayString.padStart(2, "0")}`;
			const dayStats = pluginData.dailyStats[dateKey] || 0;

			if (dayStats >= 0) {
				positiveData.push(dayStats);
				negativeData.push(0);
			} else {
				positiveData.push(0);
				negativeData.push(Math.abs(dayStats));
			}
		}

		return { labels, positiveData, negativeData };
	}

	/**
	 * Chart.js読み込み失敗時のフォールバック表示
	 */
	private renderChartFallback(container: HTMLElement): void {
		container.empty();
		container.createEl("p", {
			text: "グラフの読み込みに失敗しました。テキスト形式で統計を表示します。",
			cls: "count-novels-placeholder",
		});

		// 簡単なテキストベースの統計表示
		const pluginData = this.plugin.dataStorage.getData();
		if (pluginData && pluginData.dailyStats) {
			const currentDate = new Date();
			const currentYear = currentDate.getFullYear();
			const currentMonth = currentDate.getMonth() + 1;
			const monthPrefix = `${currentYear}-${currentMonth
				.toString()
				.padStart(2, "0")}`;

			const monthlyStats = Object.entries(pluginData.dailyStats)
				.filter(([date]) => date.startsWith(monthPrefix))
				.sort(([a], [b]) => a.localeCompare(b));

			if (monthlyStats.length > 0) {
				const statsContainer = container.createDiv(
					"count-novels-text-stats"
				);
				statsContainer.createEl("h3", { text: "今月の執筆記録" });

				monthlyStats.forEach(([date, count]) => {
					const day = date.split("-")[2];
					const statItem = statsContainer.createDiv(
						"count-novels-stat-item"
					);
					statItem.createEl("span", { text: `${day}日: ` });
					statItem.createEl("span", {
						text: `${count.toLocaleString()}文字`,
						cls: count >= 0 ? "positive" : "negative",
					});
				});
			}
		}
	}

	public refreshView(): void {
		this.renderView();
	}

	public refreshSummary(): void {
		const summarySection = this.containerEl.querySelector(
			".count-novels-summary"
		);
		if (summarySection) {
			const summaryContent = summarySection.querySelector(
				".count-novels-summary-content"
			);
			summaryContent?.remove();
			this.renderSummary(summarySection as HTMLElement);
		}
	}

	public refreshChart(): void {
		const chartSection = this.containerEl.querySelector(
			".count-novels-chart-content"
		);
		if (chartSection && this.chartInstance) {
			const newChartData = this.generateChartData();
			this.chartInstance.data = newChartData;
			this.chartInstance.update();
		} else if (chartSection) {
			this.renderChart(chartSection as HTMLElement);
		}
	}

	public refreshStats(): void {
		this.refreshSummary();
		this.refreshChart();
	}
}
