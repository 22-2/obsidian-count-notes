
// ============================================================================
// E:\Desktop\coding\my-projects-02\obsidian-count-notes\e2e\fixtures\test-files.ts
// ============================================================================
export const TEST_FILES = {
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
	summaryTest: {
		path: "summary-test.md",
		content: `---
tags: [novel]
---

# Test Chapter
This is test content for summary calculation.
It has multiple lines and paragraphs.`,
	},
	chartTest: {
		path: "chart-test.md",
		content: `---
tags: [novel]
---

# Chart Test Chapter
This content is for testing the chart display functionality.
It should generate some character count data for the chart.`,
	},
};
