import type { ObsidianAPI } from "obsidian-e2e-toolkit";
import { expect, test } from "obsidian-e2e-toolkit";
import { splitMd } from "src/utils/markdwon";
import { DIST_DIR, PLUGIN_ID } from "./constants.ts";

// Constants
const METADATA_CACHE_WAIT_MS = 500;
const NOVEL_TAG = "novel";

// Types
interface TestFile {
	path: string;
	content: string;
}

interface DataCollectionResult {
	lastTotalCharacterCount: number;
	dailyStats: Record<string, number>;
	trackingTag: string;
}

interface ScanResult {
	fileCount: number;
	filePaths: string[];
}

// Helper Functions
class TestHelpers {
	constructor(private obsidian: ObsidianAPI) {}

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

	async waitForMetadataCache(): Promise<void> {
		await this.obsidian.page.waitForTimeout(METADATA_CACHE_WAIT_MS);
	}

	async collectData(): Promise<DataCollectionResult | null> {
		return this.obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (!plugin) return null;

			await plugin.collectData();
			const pluginData = plugin.dataStorage.getData();

			return {
				lastTotalCharacterCount:
					pluginData?.lastTotalCharacterCount || 0,
				dailyStats: pluginData?.dailyStats || {},
				trackingTag: plugin.settings.trackingTag,
			};
		}, PLUGIN_ID);
	}

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

	async getCharacterCount(): Promise<number> {
		return this.obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			await plugin.collectData();
			return plugin.dataStorage.getData()?.lastTotalCharacterCount || 0;
		}, PLUGIN_ID);
	}

	async getAllMarkdownFiles(): Promise<string[]> {
		return this.obsidian.page.evaluate(() =>
			app.vault.getMarkdownFiles().map((f: any) => f.path)
		);
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
}

// Test Data
const TEST_FILES = {
	novel1: {
		path: "novel1.md",
		content: `---
tags: [novel]
---

# Chapter 1
This is the first chapter of my novel. It has some content here.
The story begins with a character walking down the street.`,
	},
	novel2: {
		path: "novel2.md",
		content: `# Chapter 2 #novel

This is another chapter with inline tag.
More content for character counting.
The adventure continues...`,
	},
	notNovel: {
		path: "not-novel.md",
		content: `# Regular Note

This file doesn't have the novel tag.
It should not be counted.`,
	},
	shortChapter: {
		path: "test-novel.md",
		content: `---
tags: [novel]
---

# Short Chapter
Brief content.`,
	},
	extendedChapter: {
		path: "test-novel.md",
		content: `---
tags: [novel]
---

# Extended Chapter
This is now a much longer chapter with significantly more content.
The story has been expanded with additional paragraphs and details.
More characters means higher count in our tracking system.`,
	},
};

// Tests
test.describe("Data Collection Functionality", () => {
	test("should scan files with novel tag and calculate character count", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		// Verify plugin is loaded
		expect(await obsidian.plugin(PLUGIN_ID)).toBeTruthy();

		// Create test files
		const testFiles = [
			TEST_FILES.novel1,
			TEST_FILES.novel2,
			TEST_FILES.notNovel,
		];
		await helpers.createFiles(testFiles);

		// Collect data and verify results
		const result = await helpers.collectData();
		expect(result).toBeTruthy();
		expect(result!.trackingTag).toBe(NOVEL_TAG);

		// Verify character count
		const novelFiles = [TEST_FILES.novel1, TEST_FILES.novel2];
		const expectedCount =
			helpers.calculateExpectedCharacterCount(novelFiles);

		expect(result!.lastTotalCharacterCount).toBeGreaterThan(0);
		expect(result!.lastTotalCharacterCount).toBe(expectedCount);

		// Verify daily stats
		const today = helpers.getTodayDateString();
		expect(result!.dailyStats).toHaveProperty(today);
		expect(result!.dailyStats[today]).toBe(expectedCount);

		// Test file scanning functionality
		const scanResult = await helpers.scanFilesWithTag(NOVEL_TAG);
		expect(scanResult).toBeTruthy();
		expect(scanResult!.fileCount).toBe(2);
		expect(scanResult!.filePaths).toContain("novel1.md");
		expect(scanResult!.filePaths).toContain("novel2.md");
		expect(scanResult!.filePaths).not.toContain("not-novel.md");

		// Clean up
		await helpers.deleteFiles(testFiles.map((f) => f.path));
	});

	test("should handle empty vault gracefully", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		const helpers = new TestHelpers(obsidian);

		// Clean up existing files
		const existingFiles = await helpers.getAllMarkdownFiles();
		await helpers.deleteFiles(existingFiles);
		await helpers.waitForMetadataCache();

		// Collect data on empty vault
		const result = await helpers.collectData();
		expect(result).toBeTruthy();
		expect(result!.lastTotalCharacterCount).toBe(0);

		// Verify no files found
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

		// Create initial file
		await helpers.createFiles([TEST_FILES.shortChapter]);

		// Get initial count
		const initialCount = await helpers.getCharacterCount();
		const expectedInitialCount = helpers.calculateExpectedCharacterCount([
			TEST_FILES.shortChapter,
		]);
		expect(initialCount).toBe(expectedInitialCount);

		// Modify file with more content
		await obsidian.save(
			TEST_FILES.extendedChapter.path,
			TEST_FILES.extendedChapter.content
		);
		await helpers.waitForMetadataCache();

		// Get updated count
		const updatedCount = await helpers.getCharacterCount();
		const expectedUpdatedCount = helpers.calculateExpectedCharacterCount([
			TEST_FILES.extendedChapter,
		]);

		expect(updatedCount).toBe(expectedUpdatedCount);
		expect(updatedCount).toBeGreaterThan(initialCount);

		// Clean up
		await helpers.deleteFiles([TEST_FILES.extendedChapter.path]);
	});
});

// Custom settings for these tests
test.use({
	vaultOptions: {
		sandbox: true,
		plugins: [
			{
				path: DIST_DIR,
				pluginId: PLUGIN_ID,
			},
		],
	},
});
