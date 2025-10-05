import type { PeriodStats, PeriodType } from "../schemas";

export class StatsComponent {
	private container: HTMLElement;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	public render(stats: PeriodStats, periodType: PeriodType): void {
		this.container.empty();

		const summaryContent = this.container.createDiv(
			"count-novels-summary-content"
		);

		// 期間に応じて表示する統計を調整
		if (periodType === "day") {
			this.createSummaryItem(
				summaryContent,
				"今日の執筆",
				stats.total.toLocaleString(),
				"文字"
			);
			// 平均が0より大きい場合のみ表示
			if (stats.average > 0) {
				this.createSummaryItem(
					summaryContent,
					"4時間の平均",
					stats.average.toLocaleString(),
					"文字"
				);
			}
			this.createSummaryItem(
				summaryContent,
				"継続日数",
				stats.streak.toString(),
				"日"
			);
		} else if (periodType === "week") {
			this.createSummaryItem(
				summaryContent,
				"今週の合計",
				stats.total.toLocaleString(),
				"文字"
			);
			this.createSummaryItem(
				summaryContent,
				"1日の平均",
				stats.average.toLocaleString(),
				"文字"
			);
			this.createSummaryItem(
				summaryContent,
				"継続日数",
				stats.streak.toString(),
				"日"
			);
		} else if (periodType === "month") {
			this.createSummaryItem(
				summaryContent,
				"今月の合計",
				stats.total.toLocaleString(),
				"文字"
			);
			this.createSummaryItem(
				summaryContent,
				"1日の平均",
				stats.average.toLocaleString(),
				"文字"
			);
			this.createSummaryItem(
				summaryContent,
				"継続日数",
				stats.streak.toString(),
				"日"
			);
		} else if (periodType === "year") {
			this.createSummaryItem(
				summaryContent,
				"今年の合計",
				stats.total.toLocaleString(),
				"文字"
			);
			this.createSummaryItem(
				summaryContent,
				"1日の平均",
				stats.average.toLocaleString(),
				"文字"
			);
			this.createSummaryItem(
				summaryContent,
				"継続日数",
				stats.streak.toString(),
				"日"
			);
		}
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
}
