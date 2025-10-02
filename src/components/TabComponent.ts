import type { PeriodType } from "../types/period";
import { PERIOD_CONFIGS } from "../types/period";

export class TabComponent {
	private container: HTMLElement;
	private activeTab: PeriodType = "month";
	private onTabChange: (periodType: PeriodType) => void;

	constructor(
		container: HTMLElement,
		onTabChange: (periodType: PeriodType) => void,
		initialTab: PeriodType = "month"
	) {
		this.container = container;
		this.onTabChange = onTabChange;
		this.activeTab = initialTab;
		this.render();
	}

	private render(): void {
		this.container.empty();

		const tabContainer = this.container.createDiv("count-novels-tabs");

		// タブボタンを作成
		Object.values(PERIOD_CONFIGS).forEach((config) => {
			const tabButton = tabContainer.createEl("button", {
				text: config.shortLabel,
				cls: "count-novels-tab-button",
			});

			if (config.type === this.activeTab) {
				tabButton.addClass("active");
			}

			tabButton.addEventListener("click", () => {
				this.setActiveTab(config.type);
			});
		});
	}

	public setActiveTab(periodType: PeriodType): void {
		if (this.activeTab === periodType) return;

		this.activeTab = periodType;
		this.updateTabStyles();
		this.onTabChange(periodType);
	}

	private updateTabStyles(): void {
		const tabButtons = this.container.querySelectorAll(
			".count-novels-tab-button"
		);

		tabButtons.forEach((button, index) => {
			const periodTypes: PeriodType[] = ["day", "week", "month", "year"];
			const periodType = periodTypes[index];

			if (periodType === this.activeTab) {
				button.addClass("active");
			} else {
				button.removeClass("active");
			}
		});
	}

	public getActiveTab(): PeriodType {
		return this.activeTab;
	}
}
