import type { App } from "electron";
import type { FileManager, TFile } from "obsidian";

export function getFrontmatterAsync(app: App, file: TFile): any {
	return new Promise((resolve) => {
		return ((app as any).fileManager as FileManager).processFrontMatter(
			file,
			(frontmatter) => resolve(frontmatter)
		);
	});
}

export function parseDate(str: string) {
	// @ts-expect-error
	const date = moment(str, "YYYY-MM-DD ddd, HH:mm:ss");
	if (date.isValid()) {
		return date.toISOString();
	}
	// @ts-expect-error
	return moment(str).toISOString();
}

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
