import uPlot from "uplot";
import type { ChartDataPoint, PeriodType } from "../schemas";

export class ChartComponent {
	private container: HTMLElement;
	private uplotInstance?: uPlot;
	private resizeObserver?: ResizeObserver;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	public render(chartData: ChartDataPoint[], periodType: PeriodType): void {
		this.destroy();
		this.container.empty();

		if (chartData.length === 0) {
			this.renderNoDataMessage();
			return;
		}

		const plotDiv = this.container.createDiv({ cls: "count-novels-uplot" });

		try {
			// Data preparation
			const xs = chartData.map((_, i) => i);
			const ys = chartData.map((d) => d.value);
			const data = [xs, ys];

			const colors = this.getThemeColors();
			const averageValue = this.calculateAverage(ys);
			const hasNonZeroData = ys.some((v) => typeof v === "number" && v !== 0);

			const opts: uPlot.Options = {
				width: this.container.clientWidth || 800,
				height: 300,
				title: "",
				series: [
					{}, // X
					{
						label: "文字数",
						stroke: colors.positiveBorder,
						fill: colors.positiveColor,
						paths: this.bars(),
						value: (u, v) => (v == null ? "-" : v.toLocaleString() + "文字"),
					},
				],
				axes: [
					{
						stroke: colors.textSecondary,
						grid: { show: false },
						values: (u, vals) => vals.map((v) => chartData[v]?.label ?? ""),
						gap: 5,
					},
					{
						stroke: colors.textSecondary,
						grid: { stroke: colors.gridColor, width: 1 },
						values: (u, vals) =>
							vals.map((v) => {
								if (v === 0) return "0";
								if (Math.abs(v) >= 1000) return v / 1000 + "k";
								return v.toLocaleString();
							}),
					},
				],
				scales: {
					x: { time: false, range: [-0.5, xs.length - 0.5] },
					y: {
						range: (u, min, max) => [0, Math.max(max * 1.1, 100)],
					},
				},
				legend: { show: false },
				hooks: {
					draw: [
						(u) => {
							if (!hasNonZeroData) return;
							const ctx = u.ctx;
							const y = u.valToPos(averageValue, "y", true);
							const x0 = u.valToPos(u.scales.x.min!, "x", true);
							const x1 = u.valToPos(u.scales.x.max!, "x", true);

							ctx.save();
							ctx.beginPath();
							ctx.strokeStyle = "#FFD700";
							ctx.lineWidth = 2;
							ctx.setLineDash([5, 5]);
							ctx.moveTo(x0, y);
							ctx.lineTo(x1, y);
							ctx.stroke();

							ctx.fillStyle = "#FFD700";
							ctx.font = "11px sans-serif";
							ctx.fillText("平均値", x1 - 40, y - 5);
							ctx.restore();
						},
					],
				},
			};

			this.uplotInstance = new uPlot(opts, data as any, plotDiv);

			this.resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const { width } = entry.contentRect;
					this.uplotInstance?.setSize({ width, height: 300 });
				}
			});
			this.resizeObserver.observe(this.container);
		} catch (error) {
			console.error("Count Novels: Failed to create chart:", error);
			this.renderChartFallback(chartData);
		}
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

	private bars() {
		return (u: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
			const xdata = u.data[0];
			const ydata = u.data[seriesIdx];
			const scaleX = "x";
			const scaleY = u.series[seriesIdx].scale!;

			const count = u.scales.x.max! - u.scales.x.min!;
			const plotWid = u.bbox.width;
			const colWid = plotWid / (count || 1);
			const gap = colWid * 0.2;
			const barWid = colWid - gap;
			const halfWid = barWid / 2;

			const toPosX = (val: number) => u.valToPos(val, scaleX, true);
			const toPosY = (val: number) => u.valToPos(val, scaleY, true);
			const zeroY = toPosY(0);

			const path = new Path2D();

			for (let i = idx0; i <= idx1; i++) {
				const xVal = xdata[i];
				const yVal = ydata[i];
				if (yVal == null) continue;

				const cx = toPosX(xVal);
				const cy = toPosY(yVal);

				path.rect(cx - halfWid, cy, barWid, zeroY - cy);
			}

			return {
				stroke: path,
				fill: path,
			};
		};
	}

	private calculateAverage(values: (number | null)[]): number {
		const nums = values.filter((v) => typeof v === "number") as number[];
		if (nums.length === 0) return 0;
		return nums.reduce((a, b) => a + b, 0) / nums.length;
	}

	private renderNoDataMessage(): void {
		this.container.createEl("p", {
			text: "データがありません",
			cls: "count-novels-no-chart-data",
		});
	}

	private getThemeColors() {
		const style = getComputedStyle(document.body);
		const getVar = (name: string) => style.getPropertyValue(name).trim();

		return {
			textPrimary: getVar("--text-normal"),
			textSecondary: getVar("--text-muted"),
			gridColor: getVar("--background-modifier-border"),
			positiveColor: `rgba(${getVar("--color-green-rgb")}, 0.7)`,
			positiveBorder: `rgb(${getVar("--color-green-rgb")})`,
		};
	}

	public destroy(): void {
		if (this.uplotInstance) {
			this.uplotInstance.destroy();
			this.uplotInstance = undefined;
		}
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = undefined;
		}
	}
}
