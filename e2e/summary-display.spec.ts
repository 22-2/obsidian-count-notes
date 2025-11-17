// ============================================================================
// E:\Desktop\coding\my-projects-02\obsidian-count-notes\e2e\summary-display.spec.ts
// ============================================================================
import type { ObsidianAPI } from "obsidian-e2e-toolkit";
import { expect, test } from "obsidian-e2e-toolkit";
import { PLUGIN_ID } from "./helpers/constants";
import { StreakCalculator } from "./helpers/steak-caluculator";
import { TEST_FILES } from "./helpers/test-files";
import { TestHelpers } from "./helpers/test-helpers";

test.describe("Summary Display Functionality", () => {
	test("should display summary with monthly total and streak", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		const plugin = await obsidian.plugin(PLUGIN_ID);
		expect(plugin).toBeTruthy();

		await obsidian.save(TEST_FILES.summaryTest.path, TEST_FILES.summaryTest.content);
		await obsidian.expectExists(TEST_FILES.summaryTest.path);
		await obsidian.page.waitForTimeout(500);

		const dataCollectionResult = await obsidian.page.evaluate(
			async (pluginId) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				await plugin.collectData();

				const dailyStats = await plugin.statsStorage.getDailyStats();
				const lastTotalCharacterCount = await plugin.statsStorage.getLastTotalCharacterCount();

				return {
					hasData: Object.keys(dailyStats).length > 0,
					dailyStatsCount: Object.keys(dailyStats).length,
					lastTotalCharacterCount: lastTotalCharacterCount || 0,
				};
			},
			PLUGIN_ID
		);

		expect(dataCollectionResult).toBeTruthy();
		expect(dataCollectionResult!.hasData).toBe(true);
		expect(dataCollectionResult!.lastTotalCharacterCount).toBeGreaterThan(0);

		await helpers.openCountNovelsView();
		const viewTestResult = await helpers.getViewElements();

		expect(viewTestResult.viewExists).toBe(true);
		expect(viewTestResult.hasSummarySection).toBe(true);
		expect(viewTestResult.summaryItemCount).toBe(3);
		expect(viewTestResult.hasMonthlyTotal).toBe(true);
		expect(viewTestResult.hasStreak).toBe(true);

		await obsidian.delete(TEST_FILES.summaryTest.path);
	});

	test("should handle zero streak when no writing data exists", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);
		await helpers.clearDailyStats();

		const emptyStreakResult = await StreakCalculator.calculate(obsidian);
		expect(emptyStreakResult).toBe(0);
	});

	test("should handle broken streak correctly", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);
		await helpers.clearDailyStats();

		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		const fourDaysAgo = new Date(today);
		fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

		await helpers.saveDailyStats(today.toISOString().split("T")[0], 100);
		await helpers.saveDailyStats(yesterday.toISOString().split("T")[0], 200);
		await helpers.saveDailyStats(fourDaysAgo.toISOString().split("T")[0], 300);

		const brokenStreakResult = await StreakCalculator.calculate(obsidian);
		expect(brokenStreakResult).toBe(2);
	});

	test("should display chart with monthly data", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		await obsidian.save(TEST_FILES.chartTest.path, TEST_FILES.chartTest.content);
		await obsidian.page.waitForTimeout(500);

		await obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (plugin) {
				await plugin.collectData();
			}
		}, PLUGIN_ID);

		await helpers.openCountNovelsView();
		const chartTestResult = await helpers.getViewElements();

		expect(chartTestResult.viewExists).toBe(true);
		expect(chartTestResult.hasChartSection).toBe(true);
		expect(chartTestResult.hasChartContent).toBe(true);

		const hasChart = chartTestResult.hasChartCanvas || chartTestResult.hasChartFallback;
		expect(hasChart).toBe(true);

		await obsidian.delete(TEST_FILES.chartTest.path);
	});
});
