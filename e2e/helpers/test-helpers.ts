// ============================================================================
// E:\Desktop\coding\my-projects-02\obsidian-count-notes\e2e\helpers\test-helpers.ts
// ============================================================================
import type { ObsidianAPI } from "obsidian-e2e-toolkit";
import { splitMd } from "src/utils/markdwon";
import { PLUGIN_ID } from "./constants";

export const METADATA_CACHE_WAIT_MS = 500;

export interface TestFile {
	path: string;
	content: string;
}

export interface DataCollectionResult {
	lastTotalCharacterCount: number;
	dailyStats: Record<string, number>;
	trackingTag: string;
}

export interface ScanResult {
	fileCount: number;
	filePaths: string[];
}

export class TestHelpers {
	constructor(private obsidian: ObsidianAPI) {}

	// ========== File Operations ==========
	async createFiles(files: TestFile[]): Promise<void> {
		for (const file of files) {
			await this.obsidian.save(file.path, file.content);
			await this.obsidian.expectExists(file.path);
		}
		await this.waitForMetadataCache();
	}

	async deleteFiles(filePaths: string[]): Promise<void> {
		for (const path of filePaths) {
			await this.obsidian.delete(path);
		}
	}

	async getAllMarkdownFiles(): Promise<string[]> {
		return this.obsidian.page.evaluate(() =>
			app.vault.getMarkdownFiles().map((f: any) => f.path)
		);
	}

	// ========== Data Collection ==========
	async collectData(): Promise<DataCollectionResult | null> {
		const plugin = await this.obsidian.plugin(PLUGIN_ID);
		return plugin.evaluate(async (plugin) => {
			await plugin.collectData();

			const lastTotalCharacterCount = await plugin.statsStorage.getLastTotalCharacterCount();
			const dailyStats = await plugin.statsStorage.getDailyStats();

			return {
				lastTotalCharacterCount,
				dailyStats,
				trackingTag: plugin.settings.trackingTag,
			};
		}, PLUGIN_ID);
	}

	async getCharacterCount(): Promise<number> {
		return this.obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			await plugin.collectData();
			return await plugin.statsStorage.getLastTotalCharacterCount();
		}, PLUGIN_ID);
	}

	// ========== Tag Scanning ==========
	async scanFilesWithTag(tag: string): Promise<ScanResult | null> {
		return this.obsidian.page.evaluate(
			async ({ pluginId, tag }) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				const taggedFiles =
					await plugin.dataCollectionService.findFilesWithTag(tag);
				return {
					fileCount: taggedFiles.length,
					filePaths: taggedFiles.map((f: any) => f.path),
				};
			},
			{ pluginId: PLUGIN_ID, tag }
		);
	}

	// ========== Utility Functions ==========
	async waitForMetadataCache(): Promise<void> {
		await this.obsidian.page.waitForTimeout(METADATA_CACHE_WAIT_MS);
	}

	calculateExpectedCharacterCount(files: TestFile[]): number {
		return files.reduce(
			(sum, file) => sum + splitMd(file.content).content.length,
			0
		);
	}

	getTodayDateString(): string {
		return new Date().toISOString().split("T")[0];
	}

	// ========== IndexedDB Operations ==========
	async clearDailyStats(): Promise<void> {
		await this.obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (plugin) {
				await plugin.statsStorage.clearDailyStats();
			}
		}, PLUGIN_ID);
	}

	async saveDailyStats(date: string, count: number): Promise<void> {
		await this.obsidian.page.evaluate(
			async ({ pluginId, date, count }) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (plugin) {
					await plugin.statsStorage.saveDailyStats(date, count);
				}
			},
			{ pluginId: PLUGIN_ID, date, count }
		);
	}

	// ========== View Operations ==========
	async openCountNovelsView(): Promise<void> {
		await this.obsidian.page.evaluate(async () => {
			await app.workspace.getLeaf("tab")!.setViewState({
				type: "count-novels-home",
				active: true,
			});
		});
		await this.obsidian.page.waitForTimeout(200);
	}

	async getViewElements() {
		return this.obsidian.page.evaluate(() => {
			const leaves = app.workspace.getLeavesOfType("count-novels-home");
			if (leaves.length === 0) return { viewExists: false };

			const view = leaves[0].view as any;
			const summarySection = view.containerEl.querySelector(".count-novels-summary");
			const summaryItems = view.containerEl.querySelectorAll(".count-novels-summary-item");
			const chartSection = view.containerEl.querySelector(".count-novels-chart");
			const chartContent = view.containerEl.querySelector(".count-novels-chart-content");
			const chartCanvas = view.containerEl.querySelector(".count-novels-chart-canvas");
			const chartFallback = view.containerEl.querySelector(".count-novels-text-stats");

			return {
				viewExists: true,
				hasSummarySection: !!summarySection,
				summaryItemCount: summaryItems.length,
				hasMonthlyTotal: !!view.containerEl.querySelector(".count-novels-summary-item:first-child"),
				hasStreak: !!view.containerEl.querySelector(".count-novels-summary-item:last-child"),
				hasChartSection: !!chartSection,
				hasChartContent: !!chartContent,
				hasChartCanvas: !!chartCanvas,
				hasChartFallback: !!chartFallback,
				hasChartInstance: !!view.chartInstance,
			};
		});
	}
}
