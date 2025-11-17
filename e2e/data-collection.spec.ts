

// ============================================================================
// E:\Desktop\coding\my-projects-02\obsidian-count-notes\e2e\data-collection.spec.ts
// ============================================================================
import type { ObsidianAPI } from "obsidian-e2e-toolkit";
import { expect, test } from "obsidian-e2e-toolkit";
import { PLUGIN_ID } from "./helpers/constants";
import { TEST_FILES } from "./helpers/test-files";
import { TestHelpers } from "./helpers/test-helpers";

const NOVEL_TAG = "novel";

test.describe("Data Collection Functionality", () => {
	test("should scan files with novel tag and calculate character count", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		expect(await obsidian.isPluginEnabled(PLUGIN_ID)).toBeTruthy();

		const testFiles = [TEST_FILES.novel1, TEST_FILES.novel2, TEST_FILES.notNovel];
		await helpers.createFiles(testFiles);

		const result = await helpers.collectData();
		expect(result).toBeTruthy();
		expect(result!.trackingTag).toBe(NOVEL_TAG);

		const novelFiles = [TEST_FILES.novel1, TEST_FILES.novel2];
		const expectedCount = helpers.calculateExpectedCharacterCount(novelFiles);

		expect(result!.lastTotalCharacterCount).toBeGreaterThan(0);
		expect(result!.lastTotalCharacterCount).toBe(expectedCount);

		const today = helpers.getTodayDateString();
		expect(result!.dailyStats).toHaveProperty(today);
		expect(result!.dailyStats[today]).toBe(expectedCount);

		const scanResult = await helpers.scanFilesWithTag(NOVEL_TAG);
		expect(scanResult).toBeTruthy();
		expect(scanResult!.fileCount).toBe(2);
		expect(scanResult!.filePaths).toContain("novel1.md");
		expect(scanResult!.filePaths).toContain("novel2.md");
		expect(scanResult!.filePaths).not.toContain("not-novel.md");

		await helpers.deleteFiles(testFiles.map((f) => f.path));
	});

	test("should handle empty vault gracefully", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		const existingFiles = await helpers.getAllMarkdownFiles();
		await helpers.deleteFiles(existingFiles);

		const result = await helpers.collectData();
		expect(result).toBeTruthy();
		expect(result!.lastTotalCharacterCount).toBe(0);

		const scanResult = await helpers.scanFilesWithTag(NOVEL_TAG);
		expect(scanResult).toBeTruthy();
		expect(scanResult!.fileCount).toBe(0);
	});

	test("should update character count when files are modified", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		await helpers.createFiles([TEST_FILES.shortChapter]);

		const initialCount = await helpers.getCharacterCount();
		const expectedInitialCount = helpers.calculateExpectedCharacterCount([
			TEST_FILES.shortChapter,
		]);
		expect(initialCount).toBe(expectedInitialCount);

		await obsidian.save(
			TEST_FILES.extendedChapter.path,
			TEST_FILES.extendedChapter.content
		);
		await helpers.waitForMetadataCache();

		const updatedCount = await helpers.getCharacterCount();
		const expectedUpdatedCount = helpers.calculateExpectedCharacterCount([
			TEST_FILES.extendedChapter,
		]);

		expect(updatedCount).toBe(expectedUpdatedCount);
		expect(updatedCount).toBeGreaterThan(initialCount);

		await helpers.deleteFiles([TEST_FILES.extendedChapter.path]);
	});
});

test.use({
	vaultOptions: {
		enableBrowserConsoleLogging: true,
		logLevel: "DEBUG",
	},
})
