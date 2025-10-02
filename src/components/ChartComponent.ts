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
import type { ChartDataPoint, PeriodType } from "../types/period";

export class ChartComponent {
	private container: HTMLElement;
	private chartInstance?: Chart;
	private isInitialized = false;

	constructor(container: HTMLElement) {
		this.container = container;
		this.initializeChartJS();
	}

	private initializeChartJS(): void {
		if (this.isInitialized) return;

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
		this.isInitialized = true;
	}

	public render(chartData: ChartDataPoint[], periodType: PeriodType): void {
		this.destroyExistingChart();
		this.container.empty();

		if (chartData.length === 0) {
			this.renderNoDataMessage();
			return;
		}

		const canvas = this.container.createEl("canvas", {
			cls: "count-novels-chart-canvas",
		});

		try {
			const chartJsData = this.convertToChartJsData(chartData);
			const chartConfig = this.createChartConfiguration(
				chartJsData,
				periodType
			);
			this.chartInstance = new Chart(canvas, chartConfig);
		} catch (error) {
			console.error("Count Novels: Failed to create chart:", error);
			this.renderChartFallback(chartData);
		}
	}

	private renderNoDataMessage(): void {
		this.container.createEl("p", {
			text: "データがありません",
			cls: "count-novels-no-chart-data",
		});
	}

	private convertToChartJsData(
		chartData: ChartDataPoint[]
	): ChartData<"bar"> {
		const colors = this.getThemeColors();

		return {
			labels: chartData.map((point) => point.label),
			datasets: [
				{
					label: "執筆文字数",
					data: chartData.map((point) => point.value),
					backgroundColor: colors.positiveColor,
					borderColor: colors.positiveBorder,
					borderWidth: 2,
				},
			],
		};
	}

	private createChartConfiguration(
		chartData: ChartData<"bar">,
		periodType: PeriodType
	): ChartConfiguration<"bar"> {
		const colors = this.getThemeColors();
		const averageValue = this.calculateAverageFromChartData(chartData);

		return {
			type: "bar",
			data: chartData,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: "index",
				},
				plugins: this.createChartPlugins(colors, averageValue),
				scales: this.createChartScales(colors, chartData, periodType),
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

	private createChartScales(
		colors: any,
		chartData: ChartData<"bar">,
		periodType: PeriodType
	) {
		return {
			x: this.createXAxisConfig(colors, periodType),
			y: this.createYAxisConfig(colors, chartData),
		};
	}

	private createXAxisConfig(colors: any, periodType: PeriodType) {
		const config: any = {
			type: "category",
			ticks: {
				color: colors.textSecondary,
				font: { size: 11 },
				maxRotation: 0,
				minRotation: 0,
			},
			grid: {
				color: colors.gridColor,
				lineWidth: 1,
			},
		};

		// 期間タイプに応じてティック数を制限
		const maxTicks = this.getMaxTicksLimit(periodType);
		if (maxTicks) {
			config.ticks.maxTicksLimit = maxTicks;
		}

		return config;
	}

	private getMaxTicksLimit(periodType: PeriodType): number | undefined {
		switch (periodType) {
			case "day":
				return 6; // 4時間単位で6つ
			case "week":
				return 7; // 7日
			case "month":
				return undefined; // 5日単位のグループ数は月によって変わる
			case "year":
				return 4; // 4四半期
			default:
				return undefined;
		}
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
		};

		const lightTheme = {
			textPrimary: "#222222",
			textSecondary: "#666666",
			gridColor: "#e0e0e0",
			tooltipBg: "rgba(255, 255, 255, 0.95)",
			tooltipBorder: "#cccccc",
			positiveColor: "rgba(40, 160, 40, 0.7)",
			positiveBorder: "rgba(40, 160, 40, 1)",
		};

		return isDarkTheme ? darkTheme : lightTheme;
	}

	private renderChartFallback(chartData: ChartDataPoint[]): void {
		this.container.empty();
		this.container.createEl("p", {
			text: "グラフの読み込みに失敗しました。テキスト形式で統計を表示します。",
			cls: "count-novels-placeholder",
		});

		const statsContainer = this.container.createDiv(
			"count-novels-text-stats"
		);
		statsContainer.createEl("h3", { text: "執筆記録" });

		chartData.forEach((point) => {
			const statItem = statsContainer.createDiv("count-novels-stat-item");
			statItem.createEl("span", { text: `${point.label}: ` });
			statItem.createEl("span", {
				text: `${point.value.toLocaleString()}文字`,
				cls: "positive",
			});
		});
	}

	public destroy(): void {
		this.destroyExistingChart();
	}

	private destroyExistingChart(): void {
		if (this.chartInstance) {
			this.chartInstance.destroy();
			this.chartInstance = undefined;
		}
	}
}
