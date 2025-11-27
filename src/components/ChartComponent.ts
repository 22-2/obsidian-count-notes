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
			// dateプロパティを活用して「現在」を特定
			const activeIndex = findActiveIndex(chartData, periodType);

			const chartConfig = createChartConfiguration(
				chartData,
				periodType,
				colors,
				activeIndex
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
// 以下、クラス外に切り出した関数群
// ---------------------------------------------------------

/**
 * チャートのデータに含まれる `date` プロパティと現在時刻を比較して
 * ハイライトすべきインデックスを特定する
 */
function findActiveIndex(data: ChartDataPoint[], period: PeriodType): number {
	const now = new Date();
	const currentHour = now.getHours();
	
	// 今日の日付文字列を作成 (YYYY-MM-DD) ※ローカルタイム基準
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	// 配列を後ろから走査（最新のものからチェックするため）
	for (let i = data.length - 1; i >= 0; i--) {
		const point = data[i] as any; 
		const pointDateStr = point.date; // "2025-11-27"
		
		// --- 24hours (時間別) ---
		if (period === "24hours") {
			// ★修正: 日付チェックを外し、純粋に「時間」だけでマッチングさせる
			// これにより、テストデータが未来/過去の日付でも、現在の時間位置が表示されます
			const labelHour = parseInt(point.label); // "4h" -> 4, "12h" -> 12
			
			// 現在の時間 (14時) >= ラベルの時間 (12時) なら、その区分が現在
			// データが 0, 4, 8, 12, 16... とある場合、14時は 12 の区画に含まれる
			if (!isNaN(labelHour) && currentHour >= labelHour) {
				return i;
			}
		}

		// --- day / week (日次・週次) ---
		else if (period === "day" || period === "week") {
			// 日付が完全に一致する場合のみハイライト
			// ※ label もチェック対象に含める（dateがない場合への備え）
			if (pointDateStr === todayStr || point.label === todayStr) {
				return i;
			}
		}

		// --- month (月間表示) ---
		else if (period === "month") {
			if (!pointDateStr) continue;
			const pDate = new Date(pointDateStr);
			// 同じ年・同じ月であり、かつ未来の日付でない
			if (pDate.getFullYear() === currentYear && (pDate.getMonth() + 1) === currentMonth) {
				if (pointDateStr <= todayStr) {
					return i;
				}
			}
		}

		// --- year (年間表示) ---
		else if (period === "year") {
			if (!pointDateStr) continue;
			const pDate = new Date(pointDateStr);
			// 同じ年であり、かつ未来の日付でない
			if (pDate.getFullYear() === currentYear) {
				if (pointDateStr <= todayStr) {
					return i;
				}
			}
		}
	}

	return -1; // 該当なし
}

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
	fadedNegativeBorder2: string; // 予備
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
		fadedNegativeBorder2: `rgba(${getVar("--color-red-rgb")}, 0.38)`,
	};
}

function createChartConfiguration(
	dataPoints: ChartDataPoint[],
	periodType: PeriodType,
	colors: ThemeColors,
	activeIndex: number
): ChartConfiguration<"bar"> {
	const chartData = convertToChartJsData(dataPoints, colors, activeIndex);
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
			scales: createChartScales(colors, chartData, periodType, activeIndex),
		},
		plugins: [createDataLabelsPlugin(colors)],
	};
}

function convertToChartJsData(
	chartData: ChartDataPoint[],
	colors: ThemeColors,
	activeIndex: number
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
						const isActive = ctx.dataIndex === activeIndex;
						
						if (val < 0) {
							return isActive ? colors.negativeColor : colors.fadedNegativeColor;
						}
						return isActive ? colors.positiveColor : colors.fadedColor;
					} catch (e) {
						return colors.fadedColor;
					}
				},
				borderColor: (ctx: any) => {
					try {
						const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : ctx.raw ?? 0;
						const isActive = ctx.dataIndex === activeIndex;

						if (val < 0) {
							return isActive ? colors.negativeBorder : colors.fadedNegativeBorder;
						}
						return isActive ? colors.positiveBorder : 'rgba(0,0,0,0)';
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
	activeIndex: number
) {
	return {
		x: createXAxisConfig(colors, periodType, activeIndex),
		y: createYAxisConfig(colors, chartData),
	};
}

function createXAxisConfig(colors: ThemeColors, periodType: PeriodType, activeIndex: number) {
	const config: any = {
		type: "category",
		ticks: {
			color: (ctx: any) => {
				const isActive = ctx.index === activeIndex;
				return isActive ? colors.positiveBorder : colors.textSecondary;
			},
			font: (ctx: any) => {
				const isActive = ctx.index === activeIndex;
				return { size: 13, weight: isActive ? "700" : "400" };
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
