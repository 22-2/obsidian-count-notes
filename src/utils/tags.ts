import { App } from "obsidian";

export function getAllVaultTags(app: App): string[] {
	// @ts-expect-error
	return Object.keys(app.metadataCache.getTags()).map(tag => tag.substring(1))
}
