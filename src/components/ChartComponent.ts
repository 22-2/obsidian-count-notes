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
	type ChartEvent,     // 追加
	type ActiveElement,  // 追加
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
		initializeChartJS();
	}

	public render(chartData: ChartDataPoint[], periodType: PeriodType): void {
		this.destroyExistingChart();
		this.container.empty();

		if (chartData.length === 0) {
			renderNoDataMessage(this.container);
			return;
		}

		const canvas = this.container.createEl("canvas", {
			cls: "count-novels-chart-canvas",
		});

		try {
			const colors = getThemeColors();
			const chartConfig = createChartConfiguration(
				chartData,
				periodType,
				colors
			);
			this.chartInstance = new Chart(canvas, chartConfig);
		} catch (error) {
			console.error("Count Novels: Failed to create chart:", error);
			renderChartFallback(this.container, chartData);
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
}

// ---------------------------------------------------------
// 以下、クラス外に切り出した関数群 (ステートレスなロジック)
// ---------------------------------------------------------

function initializeChartJS(): void {
	if (ChartComponent['isChartJsRegistered']) return;

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
	ChartComponent['isChartJsRegistered'] = true;
}

function renderNoDataMessage(container: HTMLElement): void {
	container.createEl("p", {
		text: "データがありません",
		cls: "count-novels-no-chart-data",
	});
}

function renderChartFallback(container: HTMLElement, chartData: ChartDataPoint[]): void {
	container.empty();
	container.createEl("p", {
		text: "グラフの読み込みに失敗しました。テキスト形式で統計を表示します。",
		cls: "count-novels-placeholder",
	});

	const statsContainer = container.createDiv("count-novels-text-stats");
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

interface ThemeColors {
	textPrimary: string;
	textSecondary: string;
	gridColor: string;
	zeroLineColor: string;
	tooltipBg: string;
	tooltipBorder: string;
	positiveColor: string;
	positiveBorder: string;
	negativeColor: string;
	negativeBorder: string;
	fadedColor: string;
	fadedNegativeColor: string;
	fadedNegativeBorder: string;
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
		negativeColor: `rgba(${getVar("--color-red-rgb")}, 0.85)`,
		negativeBorder: `rgb(${getVar("--color-red-rgb")})`,
		fadedColor: `rgba(${getVar("--color-green-rgb")}, 0.25)`,
		fadedNegativeColor: `rgba(${getVar("--color-red-rgb")}, 0.28)`,
		fadedNegativeBorder: `rgba(${getVar("--color-red-rgb")}, 0.38)`,
	};
}

function createChartConfiguration(
	dataPoints: ChartDataPoint[],
	periodType: PeriodType,
	colors: ThemeColors
): ChartConfiguration<"bar"> {
	
	// ★変更点1: アクティブなインデックスをクロージャで管理
	let activeIndex: number | null = null;

	// アクティブインデックスを取得するゲッター（各コールバックに渡す）
	const getActiveIndex = () => activeIndex;

	const chartData = convertToChartJsData(dataPoints, colors, getActiveIndex);
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
			// ★変更点2: onHoverでアクティブインデックスを更新して再描画
			onHover: (event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
				const newIndex = elements.length > 0 ? elements[0].index : null;
				
				// 状態が変わった時だけ更新（無限ループ防止）
				if (activeIndex !== newIndex) {
					activeIndex = newIndex;
					// アニメーションなしで更新してパフォーマンス確保
					chart.update('none'); 
				}
			},
			plugins: createChartPlugins(colors, averageValue),
			// ゲッターを渡す
			scales: createChartScales(colors, chartData, periodType, getActiveIndex),
		},
		plugins: [createDataLabelsPlugin(colors)],
	};
}

function convertToChartJsData(
	chartData: ChartDataPoint[],
	colors: ThemeColors,
	getActiveIndex: () => number | null // 追加
): ChartData<"bar"> {
	return {
		labels: chartData.map((point) => point.label),
		datasets: [
			{
				label: "",
				data: chartData.map((point) => point.value),
				backgroundColor: (ctx: any) => {
					try {
						const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw ?? 0;
						const labels = ctx.chart?.data?.labels || [];
						
						// ★変更点3: ctx.active または getActiveIndex() で判定
						// ctx.active はバー自体のホバー判定、getActiveIndexは軸と同期させるため
						const isActive = ctx.active || (ctx.dataIndex === getActiveIndex());
						
						// 最後尾のデータかどうか
						const isLast = typeof ctx.dataIndex === "number" && ctx.dataIndex === labels.length - 1;

						// ネガティブ値の場合
						if (val < 0) {
							// アクティブなら濃く、それ以外は薄く
							return isActive ? colors.negativeColor : colors.fadedNegativeColor;
						}
						
						// アクティブなら濃く、それ以外は薄く
						// (最後尾を目立たせたい場合は isLast の条件もここに加える)
						if (isActive) return colors.positiveColor;
						return colors.fadedColor;

					} catch (e) {
						return colors.fadedColor;
					}
				},
				borderColor: (ctx: any) => {
					try {
						const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw ?? 0;
						
						const isActive = ctx.active || (ctx.dataIndex === getActiveIndex());

						if (val < 0) {
							return isActive ? colors.negativeBorder : colors.fadedNegativeBorder;
						}
						
						if (isActive) return colors.positiveBorder;
						return 'rgba(0,0,0,0)'; // 非アクティブ時はボーダーなし

					} catch (e) {
						return 'rgba(0,0,0,0)';
					}
				},
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
	periodType: PeriodType,
	getActiveIndex: () => number | null // 追加
) {
	return {
		x: createXAxisConfig(colors, periodType, getActiveIndex),
		y: createYAxisConfig(colors, chartData),
	};
}

function createXAxisConfig(
	colors: ThemeColors, 
	periodType: PeriodType,
	getActiveIndex: () => number | null // 追加
) {
	const config: any = {
		type: "category",
		ticks: {
			color: (ctx: any) => {
				// ★変更点4: 渡されたゲッター関数を使って判定
				const activeIdx = getActiveIndex();
				const isHighlighted = (typeof ctx.index === "number") && (activeIdx !== null && ctx.index === activeIdx);
				return isHighlighted ? colors.positiveBorder : colors.textSecondary;
			},
			font: (ctx: any) => {
				const activeIdx = getActiveIndex();
				const isHighlighted = (typeof ctx.index === "number") && (activeIdx !== null && ctx.index === activeIdx);
				return { size: 13, weight: isHighlighted ? "700" : "400" };
			},
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
			return undefined;
		case "24hours":
			return 24;
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

// ヘルパー: getActiveIndexFromChart は不安定なため削除し、onHoverで管理する方式に変更
