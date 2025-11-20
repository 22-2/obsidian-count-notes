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
	type ScriptableScaleContext,
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
				animation: false,
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

	private createChartPlugins(colors: any, averageValue: number | null) {
		const plugins: any = {
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
		};

		if (averageValue !== null) {
			plugins.annotation = {
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
			};
		}

		return plugins;
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
		const { minValue } = this.getValueRangeFromChartData(chartData);

		return {
			ticks: {
				color: colors.textSecondary,
				font: { size: 11 },
				maxTicksLimit: 5,
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
				color: (ctx: ScriptableScaleContext) =>
					this.isZeroTick(ctx) ? colors.zeroLineColor : colors.gridColor,
				lineWidth: (ctx: ScriptableScaleContext) =>
					this.isZeroTick(ctx) ? 2 : 1,
			},
			beginAtZero: minValue >= 0,
			grace: "5%",
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

	private calculateAverageFromChartData(
		chartData: ChartData<"bar">
	): number | null {
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

		return count > 0 ? totalValue / count : null;
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

		return { minValue, maxValue };
	}

	private getThemeColors() {
		const style = getComputedStyle(document.body);
		const getVar = (name: string) => style.getPropertyValue(name).trim();

		return {
			textPrimary: getVar("--text-normal"),
			textSecondary: getVar("--text-muted"),
			gridColor: getVar("--background-modifier-border"),
			zeroLineColor: getVar("--text-muted"),
			tooltipBg: `rgba(${getVar("--mono-rgb-0")}, 0.9)`,
			tooltipBorder: getVar("--background-modifier-border"),
			positiveColor: `rgba(${getVar("--color-green-rgb")}, 0.7)`,
			positiveBorder: `rgb(${getVar("--color-green-rgb")})`,
		};
	}

	private isZeroTick(ctx: ScriptableScaleContext): boolean {
		const value = ctx.tick?.value;
		return typeof value === "number" && value === 0;
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
