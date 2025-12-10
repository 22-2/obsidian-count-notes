import type { App } from "obsidian";

export function splitMd(markdownText: string): {
	content: string;
	frontmatter: string;
} {
	const frontmatterPattern = /^---\n(.*?)\n---\n(.*)/s;
	const match = markdownText.match(frontmatterPattern);
	if (!match) {
		return { content: markdownText, frontmatter: "" };
	}
	const [, frontmatter, content] = match as unknown as [null, string, string];

	return {
		content,
		frontmatter,
	};
}

export function getAllTags(path: string, app: App): string[] {
	const cache = app.metadataCache.getCache(path);
	if (!cache) {
		return [];
	}

	// YAML frontmatter tags
	if (cache?.frontmatter?.tags) {
		const frontmatterTags = cache.frontmatter.tags as string | string[];
		return Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];
	}
	return [];
}
