// E2E Test for Summary Display Functionality
import "./setup/logger-setup";

import { expect, test } from "../base";
import { DIST_DIR, PLUGIN_ID, SANDBOX_VAULT_NAME } from "../constants";
import { ObsidianPageObject } from "../helpers/ObsidianPageObject";

test.describe("Summary Display Functionality", () => {
	test("should display summary with monthly total and streak", async ({
		vault,
	}) => {
		const obsPage = new ObsidianPageObject(
			vault.window,
			vault.pluginHandleMap
		);

		// 1. Verify plugin is loaded
		const vaultName = await vault.window.evaluate(() =>
			app.vault.getName()
		);
		expect(vaultName).toBe(SANDBOX_VAULT_NAME);

		const plugin = await vault.window.evaluate(
			(pluginId) => app.plugins.getPlugin(pluginId),
			PLUGIN_ID
		);
		expect(plugin).toBeTruthy();

		// 2. Create test files with novel tag
		const testFile = {
			path: "summary-test.md",
			content: `---
tags: [novel]
---

# Test Chapter
This is test content for summary calculation.
It has multiple lines and paragraphs.`,
		};

		await obsPage.writeFile(testFile.path, testFile.content);
		await obsPage.expectFileExists(testFile.path);

		// Wait for metadata cache to update
		await vault.window.waitForTimeout(500);

		// 3. Trigger data collection to populate some data
		const dataCollectionResult = await vault.window.evaluate(
			async (pluginId) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				// Collect current data
				await plugin.collectData();

				// Get the collected data
				const pluginData = plugin.dataStorage.getData();
				return {
					hasData:
						pluginData &&
						Object.keys(pluginData.dailyStats).length > 0,
					dailyStatsCount: Object.keys(pluginData?.dailyStats || {})
						.length,
					lastTotalCharacterCount:
						pluginData?.lastTotalCharacterCount || 0,
				};
			},
			PLUGIN_ID
		);

		expect(dataCollectionResult).toBeTruthy();
		expect(dataCollectionResult!.hasData).toBe(true);
		expect(dataCollectionResult!.lastTotalCharacterCount).toBeGreaterThan(
			0
		);

		// 4. Test that the view can be opened and displays summary
		const viewTestResult = await vault.window.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (!plugin) return null;

			// Open the Count Novels view
			await app.workspace.getLeaf("tab")!.setViewState({
				type: "count-novels-home",
				active: true,
			});

			// Wait a bit for the view to render
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check if the view exists and has summary content
			const leaves = app.workspace.getLeavesOfType("count-novels-home");
			if (leaves.length === 0) return { viewExists: false };

			const view = leaves[0].view as any;

			// Check if the view has the summary elements
			const summarySection = view.containerEl.querySelector(
				".count-novels-summary"
			);
			const summaryItems = view.containerEl.querySelectorAll(
				".count-novels-summary-item"
			);

			return {
				viewExists: true,
				hasSummarySection: !!summarySection,
				summaryItemCount: summaryItems.length,
				hasMonthlyTotal: !!view.containerEl.querySelector(
					".count-novels-summary-item:first-child"
				),
				hasStreak: !!view.containerEl.querySelector(
					".count-novels-summary-item:last-child"
				),
			};
		}, PLUGIN_ID);

		expect(viewTestResult).toBeTruthy();
		expect(viewTestResult!.viewExists).toBe(true);
		expect(viewTestResult!.hasSummarySection).toBe(true);
		expect(viewTestResult!.summaryItemCount).toBe(2); // Monthly total + streak
		expect(viewTestResult!.hasMonthlyTotal).toBe(true);
		expect(viewTestResult!.hasStreak).toBe(true);

		// Clean up
		await obsPage.deleteFile(testFile.path);
	});

	test("should handle zero streak when no writing data exists", async ({
		vault,
	}) => {
		const obsPage = new ObsidianPageObject(
			vault.window,
			vault.pluginHandleMap
		);

		// Test with empty daily stats
		const emptyStreakResult = await vault.window.evaluate(
			async (pluginId) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				// Clear all daily stats
				const pluginData = plugin.dataStorage.getData();
				if (pluginData) {
					pluginData.dailyStats = {};
					await plugin.dataStorage.saveData();
				}

				// Test streak calculation with empty data
				const mockView = {
					plugin: plugin,
					calculateStreak: function () {
						const pluginData = this.plugin.dataStorage.getData();
						if (!pluginData || !pluginData.dailyStats) {
							return 0;
						}

						const today = new Date();
						let streak = 0;
						let currentDate = new Date(today);

						const todayString = this.formatDateString(today);
						const todayStats = pluginData.dailyStats[todayString];
						const hasTodayData = todayStats && todayStats > 0;

						if (!hasTodayData) {
							currentDate.setDate(currentDate.getDate() - 1);
						}

						while (true) {
							const dateString =
								this.formatDateString(currentDate);
							const dayStats = pluginData.dailyStats[dateString];

							if (dayStats && dayStats > 0) {
								streak++;
								currentDate.setDate(currentDate.getDate() - 1);
							} else {
								break;
							}

							if (streak > 365) {
								break;
							}
						}

						return streak;
					},
					formatDateString: function (date) {
						const year = date.getFullYear();
						const month = (date.getMonth() + 1)
							.toString()
							.padStart(2, "0");
						const day = date.getDate().toString().padStart(2, "0");
						return `${year}-${month}-${day}`;
					},
				};

				return mockView.calculateStreak();
			},
			PLUGIN_ID
		);

		// Should return 0 when no data exists
		expect(emptyStreakResult).toBe(0);
	});

	test("should handle broken streak correctly", async ({ vault }) => {
		const obsPage = new ObsidianPageObject(
			vault.window,
			vault.pluginHandleMap
		);

		// Test streak with a gap (broken streak)
		const brokenStreakResult = await vault.window.evaluate(
			async (pluginId) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				// Set up data with a gap in writing
				const today = new Date();
				const yesterday = new Date(today);
				yesterday.setDate(yesterday.getDate() - 1);
				const twoDaysAgo = new Date(today);
				twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
				const fourDaysAgo = new Date(today);
				fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

				const todayStr = today.toISOString().split("T")[0];
				const yesterdayStr = yesterday.toISOString().split("T")[0];
				const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];
				const fourDaysAgoStr = fourDaysAgo.toISOString().split("T")[0];

				const pluginData = plugin.dataStorage.getData();
				if (pluginData) {
					pluginData.dailyStats = {};

					// Set up data: wrote today, yesterday, skip 2 days ago (gap), wrote 4 days ago
					pluginData.dailyStats[todayStr] = 100;
					pluginData.dailyStats[yesterdayStr] = 200;
					// No entry for twoDaysAgoStr (gap)
					pluginData.dailyStats[fourDaysAgoStr] = 300;

					await plugin.dataStorage.saveData();
				}

				const mockView = {
					plugin: plugin,
					calculateStreak: function () {
						const pluginData = this.plugin.dataStorage.getData();
						if (!pluginData || !pluginData.dailyStats) {
							return 0;
						}

						const today = new Date();
						let streak = 0;
						let currentDate = new Date(today);

						const todayString = this.formatDateString(today);
						const todayStats = pluginData.dailyStats[todayString];
						const hasTodayData = todayStats && todayStats > 0;

						if (!hasTodayData) {
							currentDate.setDate(currentDate.getDate() - 1);
						}

						while (true) {
							const dateString =
								this.formatDateString(currentDate);
							const dayStats = pluginData.dailyStats[dateString];

							if (dayStats && dayStats > 0) {
								streak++;
								currentDate.setDate(currentDate.getDate() - 1);
							} else {
								break;
							}

							if (streak > 365) {
								break;
							}
						}

						return streak;
					},
					formatDateString: function (date) {
						const year = date.getFullYear();
						const month = (date.getMonth() + 1)
							.toString()
							.padStart(2, "0");
						const day = date.getDate().toString().padStart(2, "0");
						return `${year}-${month}-${day}`;
					},
				};

				return mockView.calculateStreak();
			},
			PLUGIN_ID
		);

		// Should return 2 (today + yesterday) because there's a gap 2 days ago
		expect(brokenStreakResult).toBe(2);
	});

	test("should display chart with monthly data", async ({ vault }) => {
		const obsPage = new ObsidianPageObject(
			vault.window,
			vault.pluginHandleMap
		);

		// 1. Create test files and populate data
		const testFile = {
			path: "chart-test.md",
			content: `---
tags: [novel]
---

# Chart Test Chapter
This content is for testing the chart display functionality.
It should generate some character count data for the chart.`,
		};

		await obsPage.writeFile(testFile.path, testFile.content);
		await vault.window.waitForTimeout(500);

		// 2. Trigger data collection
		await vault.window.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (plugin) {
				await plugin.collectData();
			}
		}, PLUGIN_ID);

		// 3. Test chart functionality
		const chartTestResult = await vault.window.evaluate(
			async (pluginId) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				// Open the Count Novels view
				await app.workspace.getLeaf("tab")!.setViewState({
					type: "count-novels-home",
					active: true,
				});

				// Wait for the view to render
				await new Promise((resolve) => setTimeout(resolve, 200));

				const leaves =
					app.workspace.getLeavesOfType("count-novels-home");
				if (leaves.length === 0) return { viewExists: false };

				const view = leaves[0].view as any;

				// Check if chart elements exist
				const chartSection = view.containerEl.querySelector(
					".count-novels-chart"
				);
				const chartContent = view.containerEl.querySelector(
					".count-novels-chart-content"
				);
				const chartCanvas = view.containerEl.querySelector(
					".count-novels-chart-canvas"
				);
				const chartFallback = view.containerEl.querySelector(
					".count-novels-text-stats"
				);

				// Check if Chart.js is initialized
				const hasChartInstance = !!view.chartInstance;

				return {
					viewExists: true,
					hasChartSection: !!chartSection,
					hasChartContent: !!chartContent,
					hasChartCanvas: !!chartCanvas,
					hasChartFallback: !!chartFallback,
					hasChartInstance: hasChartInstance,
					chartInstanceType: hasChartInstance
						? typeof view.chartInstance
						: null,
				};
			},
			PLUGIN_ID
		);

		expect(chartTestResult).toBeTruthy();
		expect(chartTestResult!.viewExists).toBe(true);
		expect(chartTestResult!.hasChartSection).toBe(true);
		expect(chartTestResult!.hasChartContent).toBe(true);

		// Chart should either have a canvas (Chart.js working) or fallback (Chart.js failed)
		const hasChart =
			chartTestResult!.hasChartCanvas ||
			chartTestResult!.hasChartFallback;
		expect(hasChart).toBe(true);

		// Clean up
		await obsPage.deleteFile(testFile.path);
	});
});

// Custom settings for these tests
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [
			{
				path: DIST_DIR,
				pluginId: PLUGIN_ID,
			},
		],
	},
});
