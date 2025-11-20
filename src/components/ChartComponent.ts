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

/**
 * クラス: DOMの管理とChartインスタンスのライフサイクルのみを担当
 */
export class ChartComponent {
	private container: HTMLElement;
	private chartInstance?: Chart;
	private static isChartJsRegistered = false;

	constructor(container: HTMLElement) {
		this.container = container;
		this.initializeChartJS();
	}

	private initializeChartJS(): void {
		if (ChartComponent.isChartJsRegistered) return;

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
		ChartComponent.isChartJsRegistered = true;
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
			// テーマカラーを取得して設定生成関数に渡す
			const colors = getThemeColors();
			const chartConfig = createChartConfiguration(
				chartData,
				periodType,
				colors
			);
			this.chartInstance = new Chart(canvas, chartConfig);
		} catch (error) {
			console.error("Count Novels: Failed to create chart:", error);
			this.renderChartFallback(chartData);
		}
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

	private renderNoDataMessage(): void {
		this.container.createEl("p", {
			text: "データがありません",
			cls: "count-novels-no-chart-data",
		});
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
}

// ---------------------------------------------------------
// 以下、クラス外に切り出した関数群 (ステートレスなロジック)
// ---------------------------------------------------------

interface ThemeColors {
	textPrimary: string;
	textSecondary: string;
	gridColor: string;
	zeroLineColor: string;
	tooltipBg: string;
	tooltipBorder: string;
	positiveColor: string;
	positiveBorder: string;
}

function getThemeColors(): ThemeColors {
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

function createChartConfiguration(
	dataPoints: ChartDataPoint[],
	periodType: PeriodType,
	colors: ThemeColors
): ChartConfiguration<"bar"> {
	const chartData = convertToChartJsData(dataPoints, colors);
	const averageValue = calculateAverageFromChartData(chartData);

	return {
		type: "bar",
		data: chartData,
		options: {
			animation: false,
			responsive: true,
			maintainAspectRatio: false,
			layout: {
				padding: { top: 30, left: 10, right: 10, bottom: 10 },
			},
			interaction: {
				intersect: false,
				mode: "index",
			},
			plugins: createChartPlugins(colors, averageValue),
			scales: createChartScales(colors, chartData, periodType),
		},
		plugins: [createDataLabelsPlugin(colors)],
	};
}

function convertToChartJsData(
	chartData: ChartDataPoint[],
	colors: ThemeColors
): ChartData<"bar"> {
	return {
		labels: chartData.map((point) => point.label),
		datasets: [
			{
				label: "",
				data: chartData.map((point) => point.value),
				backgroundColor: colors.positiveColor,
				borderColor: colors.positiveBorder,
				borderWidth: 2,
				categoryPercentage: 0.9,
				barPercentage: 0.8,
			},
		],
	};
}

function createChartPlugins(colors: ThemeColors, averageValue: number | null) {
	const plugins: any = {
		legend: { display: false },
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

function createChartScales(
	colors: ThemeColors,
	chartData: ChartData<"bar">,
	periodType: PeriodType
) {
	return {
		x: createXAxisConfig(colors, periodType),
		y: createYAxisConfig(colors, chartData),
	};
}

function createXAxisConfig(colors: ThemeColors, periodType: PeriodType) {
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
		categoryPercentage: 0.9,
		barPercentage: 0.8,
	};

	const maxTicks = getMaxTicksLimit(periodType);
	if (maxTicks) {
		config.ticks.maxTicksLimit = maxTicks;
	}

	return config;
}

function createYAxisConfig(colors: ThemeColors, chartData: ChartData<"bar">) {
	const { minValue } = getValueRangeFromChartData(chartData);

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
				isZeroTick(ctx) ? colors.zeroLineColor : colors.gridColor,
			lineWidth: (ctx: ScriptableScaleContext) => (isZeroTick(ctx) ? 2 : 1),
		},
		beginAtZero: minValue >= 0,
		grace: "5%",
	};
}

function getMaxTicksLimit(periodType: PeriodType): number | undefined {
	switch (periodType) {
		case "day":
			return 6;
		case "week":
			return 7;
		case "year":
			return 4;
		case "month":
		default:
			return undefined;
	}
}

function createDataLabelsPlugin(colors: ThemeColors) {
	return {
		id: "dataLabels",
		afterDatasetsDraw: (chart: any) => {
			const ctx = chart.ctx;
			chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
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

							ctx.fillText(value.toLocaleString(), bar.x, clampedY);
						}
					});
				}
			});
		},
	};
}

function calculateAverageFromChartData(
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

function getValueRangeFromChartData(chartData: ChartData<"bar">) {
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

function isZeroTick(ctx: ScriptableScaleContext): boolean {
	const value = ctx.tick?.value;
	return typeof value === "number" && value === 0;
}
