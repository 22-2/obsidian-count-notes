import type { ObsidianAPI } from "obsidian-e2e-toolkit";
import { expect, test } from "obsidian-e2e-toolkit";
import { splitMd } from "src/utils/markdwon";
import { DIST_DIR, PLUGIN_ID } from "./constants.ts";

test.describe("Data Collection Functionality", () => {
	test("should scan files with novel tag and calculate character count", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		// 1. Verify plugin is loaded
		expect(await obsidian.plugin(PLUGIN_ID)).toBeTruthy();

		// 2. Create test files with novel tag
		const testFiles = [
			{
				path: "novel1.md",
				content: `---
tags: [novel]
---

# Chapter 1
This is the first chapter of my novel. It has some content here.
The story begins with a character walking down the street.`,
			},
			{
				path: "novel2.md",
				content: `# Chapter 2 #novel

This is another chapter with inline tag.
More content for character counting.
The adventure continues...`,
			},
			{
				path: "not-novel.md",
				content: `# Regular Note

This file doesn't have the novel tag.
It should not be counted.`,
			},
		];

		// Create test files
		for (const file of testFiles) {
			await obsidian.save(file.path, file.content);
			await obsidian.expectExists(file.path);
		}

		// Wait for Obsidian's metadata cache to update
		await obsidian.page.waitForTimeout(500);

		// 3. Get plugin instance and trigger data collection
		const dataCollectionResult = await obsidian.page.evaluate(
			async (pluginId) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return null;

				// Trigger manual data collection
				await plugin.collectData();

				// Get the collected data
				const pluginData = plugin.dataStorage.getData();
				return {
					lastTotalCharacterCount:
						pluginData?.lastTotalCharacterCount || 0,
					dailyStats: pluginData?.dailyStats || {},
					trackingTag: plugin.settings.trackingTag,
				};
			},
			PLUGIN_ID
		);

		expect(dataCollectionResult).toBeTruthy();
		expect(dataCollectionResult!.trackingTag).toBe("novel");

		// 4. Verify character count is greater than 0 (should count novel1.md and novel2.md)
		expect(dataCollectionResult!.lastTotalCharacterCount).toBeGreaterThan(
			0
		);

		// Calculate expected character count manually
		const expectedCount = testFiles
			.filter(
				(file) => file.path === "novel1.md" || file.path === "novel2.md"
			)
			.reduce(
				(sum, file) => sum + splitMd(file.content).content.length,
				0
			);

		expect(dataCollectionResult!.lastTotalCharacterCount).toBe(
			expectedCount
		);

		// 5. Verify daily stats were recorded
		const today = new Date().toISOString().split("T")[0];
		expect(dataCollectionResult!.dailyStats).toHaveProperty(today);
		// The value should be the total count, as it's the first collection after startup (where count was 0)
		expect(dataCollectionResult!.dailyStats[today]).toBe(expectedCount);

		// 6. Test file scanning functionality directly
		const scanResult = await obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (!plugin) return null;

			const taggedFiles =
				await plugin.dataCollectionService.findFilesWithTag("novel");
			return {
				fileCount: taggedFiles.length,
				filePaths: taggedFiles.map((f: any) => f.path),
			};
		}, PLUGIN_ID);

		expect(scanResult).toBeTruthy();
		expect(scanResult!.fileCount).toBe(2); // novel1.md and novel2.md
		expect(scanResult!.filePaths).toContain("novel1.md");
		expect(scanResult!.filePaths).toContain("novel2.md");
		expect(scanResult!.filePaths).not.toContain("not-novel.md");

		// 7. Clean up test files
		for (const file of testFiles) {
			await obsidian.delete(file.path);
		}
	});

	test("should handle empty vault gracefully", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		// Ensure vault is empty of novel files
		const existingFiles = await obsidian.page.evaluate(() =>
			app.vault.getMarkdownFiles().map((f: any) => f.path)
		);

		// Delete any existing files that might have novel tag
		for (const filePath of existingFiles) {
			await obsidian.delete(filePath);
		}

		// Wait for metadata cache to process deletions
		await obsidian.page.waitForTimeout(500);

		// Trigger data collection on empty vault
		const result = await obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (!plugin) return null;

			await plugin.collectData();
			const pluginData = plugin.dataStorage.getData();

			return {
				lastTotalCharacterCount:
					pluginData?.lastTotalCharacterCount || 0,
				fileCount: await plugin.dataCollectionService
					.findFilesWithTag("novel")
					.then((files: any[]) => files.length),
			};
		}, PLUGIN_ID);

		expect(result).toBeTruthy();
		expect(result!.lastTotalCharacterCount).toBe(0);
		expect(result!.fileCount).toBe(0);
	});

	test("should update character count when files are modified", async ({
		obsidian,
	}: {
		obsidian: ObsidianAPI;
	}) => {
		// 1. Create initial file
		const initialContent = `---
tags: [novel]
---

# Short Chapter
Brief content.`;

		await obsidian.save("test-novel.md", initialContent);

		// Wait for metadata cache to update
		await obsidian.page.waitForTimeout(500);

		// 2. Get initial count
		const initialResult = await obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			await plugin.collectData();
			return plugin.dataStorage.getData()?.lastTotalCharacterCount || 0;
		}, PLUGIN_ID);

		expect(initialResult).toBe(splitMd(initialContent).content.length);

		// 3. Modify file with more content
		const expandedContent = `---
tags: [novel]
---

# Extended Chapter
This is now a much longer chapter with significantly more content.
The story has been expanded with additional paragraphs and details.
More characters means higher count in our tracking system.`;

		await obsidian.save("test-novel.md", expandedContent);

		// Wait for metadata cache to update
		await obsidian.page.waitForTimeout(500);

		// 4. Get updated count
		const updatedResult = await obsidian.page.evaluate(async (pluginId) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			await plugin.collectData();
			return plugin.dataStorage.getData()?.lastTotalCharacterCount || 0;
		}, PLUGIN_ID);

		expect(updatedResult).toBe(splitMd(expandedContent).content.length);
		expect(updatedResult).toBeGreaterThan(initialResult);

		// Clean up
		await obsidian.delete("test-novel.md");
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
