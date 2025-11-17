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
import type { ChartDataPoint, PeriodType } from "../schemas";

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
					label: "",
					data: chartData.map((point) => point.value),
					backgroundColor: colors.positiveColor,
					borderColor: colors.positiveBorder,
					borderWidth: 2,
					// バーの幅を最大限活用
					categoryPercentage: 0.9,
					barPercentage: 0.8,
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
				layout: {
					padding: {
						top: 30, // 上部のデータラベル用のスペースを確保
						left: 10,
						right: 10,
						bottom: 10,
					},
				},
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
				display: false,
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
			// 横幅を最大限活用するための設定
			categoryPercentage: 0.9, // カテゴリ全体の幅の90%を使用
			barPercentage: 0.8, // バー自体の幅の80%を使用
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
		const { minValue, maxValue, maxAbsValue } =
			this.getValueRangeFromChartData(chartData);
		const stepSize = this.calculateStepSize(maxAbsValue);
		const suggestedMin = minValue < 0 ? minValue - stepSize : 0;
		const suggestedMax = maxValue > 0 ? maxValue + stepSize : stepSize;

		return {
			ticks: {
				color: colors.textSecondary,
				font: { size: 11 },
				maxTicksLimit: 5,
				stepSize,
				callback: function (value: any) {
					if (typeof value === "number") {
						if (value === 0) return "0";
						if (Math.abs(value) >= 1000) {
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
			beginAtZero: minValue >= 0,
			suggestedMin,
			suggestedMax,
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
								if (typeof value === "number" && value !== 0) {
									ctx.fillStyle = colors.textPrimary;
									ctx.font = "bold 11px sans-serif";
									ctx.textAlign = "center";
									ctx.textBaseline = value > 0 ? "bottom" : "top";

									const offset = 8;
									const clampedY =
										value > 0
											? Math.max(bar.y - offset, chart.chartArea.top + 15)
											: Math.min(bar.y + offset, chart.chartArea.bottom - 15);

									ctx.fillText(
										value.toLocaleString(),
										bar.x,
										clampedY
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
				if (typeof value === "number" && value !== 0) {
					totalValue += value;
					count++;
				}
			});
		});

		return count > 0 ? totalValue / count : 0;
	}

	private getValueRangeFromChartData(chartData: ChartData<"bar">) {
		let minValue = Infinity;
		let maxValue = -Infinity;

		chartData.datasets.forEach((dataset) => {
			dataset.data.forEach((value) => {
				if (typeof value === "number") {
					minValue = Math.min(minValue, value);
					maxValue = Math.max(maxValue, value);
				}
			});
		});

		if (minValue === Infinity || maxValue === -Infinity) {
			minValue = 0;
			maxValue = 0;
		}

		const maxAbsValue = Math.max(Math.abs(minValue), Math.abs(maxValue));
		return { minValue, maxValue, maxAbsValue };
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
