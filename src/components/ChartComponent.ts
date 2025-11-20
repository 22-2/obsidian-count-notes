import uPlot from "uplot";
import type { ChartDataPoint, PeriodType } from "../schemas";

// Obsidian等の拡張されたHTMLElement型定義を想定
interface ExtendedHTMLElement extends HTMLElement {
    createDiv(options?: { cls?: string } | string): HTMLDivElement;
    createEl(tag: string, options?: { text?: string; cls?: string }): HTMLElement;
    empty(): void;
}

export class ChartComponent {
    private container: ExtendedHTMLElement;
    private uplotInstance?: uPlot;
    private resizeObserver?: ResizeObserver;

    // 平均線のスタイル定義
    private static readonly AVG_LINE_COLOR = "#FFD700";
    private static readonly AVG_LINE_width = 2;
    private static readonly AVG_LINE_DASH = [5, 5];

    constructor(container: HTMLElement) {
        this.container = container as ExtendedHTMLElement;
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
            const { xs, ys, data } = this.prepareData(chartData);
            const averageValue = this.calculateAverage(ys);
            const colors = this.getThemeColors();
            
            const options = this.createChartOptions({
                width: this.container.clientWidth || 800,
                chartData,
                xs,
                ys,
                colors,
                averageValue,
            });

            this.uplotInstance = new uPlot(options, data, plotDiv);
            this.setupResizeObserver();

        } catch (error) {
            console.error("Count Novels: Failed to create chart:", error);
            this.renderChartFallback(chartData);
        }
    }

    /**
     * チャート用データの整形
     */
    private prepareData(chartData: ChartDataPoint[]) {
        const xs = chartData.map((_, i) => i);
        const ys = chartData.map((d) => d.value);
        // uPlotは [xValues, yValues] の形式を期待する
        const data: uPlot.AlignedData = [xs, ys as (number | null)[]];
        return { xs, ys, data };
    }

    /**
     * uPlotのオプション生成
     */
    private createChartOptions(params: {
        width: number;
        chartData: ChartDataPoint[];
        xs: number[];
        ys: (number | null)[];
        colors: ReturnType<typeof ChartComponent.prototype.getThemeColors>;
        averageValue: number;
    }): uPlot.Options {
        const { width, chartData, xs, ys, colors, averageValue } = params;
        const hasNonZeroData = ys.some((v) => typeof v === "number" && v !== 0);

        return {
            width: width,
            height: 300,
            title: "",
            series: [
                {}, // X軸 (Index)
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
                    values: (u, vals) => vals.map(this.formatYAxisTick),
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
                        if (hasNonZeroData) {
                            this.drawAverageLine(u, averageValue);
                        }
                    },
                ],
            },
        };
    }

    /**
     * 平均線の描画処理
     */
    private drawAverageLine(u: uPlot, averageValue: number): void {
        const ctx = u.ctx;
        const y = u.valToPos(averageValue, "y", true);
        const x0 = u.valToPos(u.scales.x.min!, "x", true);
        const x1 = u.valToPos(u.scales.x.max!, "x", true);

        ctx.save();
        
        // 線の描画
        ctx.beginPath();
        ctx.strokeStyle = ChartComponent.AVG_LINE_COLOR;
        ctx.lineWidth = ChartComponent.AVG_LINE_width;
        ctx.setLineDash(ChartComponent.AVG_LINE_DASH);
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();

        // テキストの描画
        ctx.fillStyle = ChartComponent.AVG_LINE_COLOR;
        ctx.font = "11px sans-serif";
        ctx.fillText("平均値", x1 - 40, y - 5);
        
        ctx.restore();
    }

    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width } = entry.contentRect;
                this.uplotInstance?.setSize({ width, height: 300 });
            }
        });
        this.resizeObserver.observe(this.container);
    }

    private formatYAxisTick(v: number): string {
        if (v === 0) return "0";
        if (Math.abs(v) >= 1000) return v / 1000 + "k";
        return v.toLocaleString();
    }

    private bars() {
        // uPlotのカスタムパス描画関数（変更なし）
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
        const nums = values.filter((v): v is number => typeof v === "number");
        if (nums.length === 0) return 0;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
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

        const statsContainer = this.container.createDiv({ cls: "count-novels-text-stats" });
        statsContainer.createEl("h3", { text: "執筆記録" });

        chartData.forEach((point) => {
            const statItem = statsContainer.createDiv({ cls: "count-novels-stat-item" });
            statItem.createEl("span", { text: `${point.label}: ` });
            statItem.createEl("span", {
                text: `${point.value.toLocaleString()}文字`,
                cls: "positive",
            });
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
        this.uplotInstance?.destroy();
        this.uplotInstance = undefined;
        
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
    }
}
