import { TFile } from "obsidian";
import { splitMd } from "src/utils/markdwon";
import type CountNovelsPlugin from "../main";
import { VIEW_TYPE_COUNT_NOVEL } from "../utils/constants";
import type { StatsStorage } from "./statsStorage";
import log from "loglevel";
import { isPathInExcludedFolders } from "src/utils/excludedFolders";

const logger = log.getLogger("DataCollectionService");

const COUNT_CONCURRENCY = 6;

export class DataCollectionService {
	constructor(
		private readonly plugin: CountNovelsPlugin,
		private readonly statsStorage: StatsStorage
	) {}

	async findFilesWithTag(tag: string): Promise<TFile[]> {
		const normalizedTag = tag?.trim();
		if (!normalizedTag) return [];

		const files = this.plugin.app.vault.getMarkdownFiles();
		const excluded = this.plugin.settings.excludedFolders;

		return files.filter((file) => {
			if (excluded.length && isPathInExcludedFolders(file.path, excluded)) {
				return false;
			}
			return hasTag(this.plugin, file, normalizedTag);
		});
	}

	async countCharactersInFile(file: TFile): Promise<number> {
		try {
			const content = await this.plugin.app.vault.cachedRead(file);
			const { content: markdownContent } = splitMd(content);
			// 空白(半角/全角/改行/タブ等)はカウントしない
			return markdownContent.replace(/(?:[\s\u3000]|\-\s1)+/g, "").length;
		} catch (error) {
			logger.error(`Error processing file ${file.path}:`, error);
			return 0;
		}
	}

	async calculateTotalCharacterCount(tag: string): Promise<number> {
		const files = await this.findFilesWithTag(tag);
		const counts = await mapWithConcurrency(files, (f) => this.countCharactersInFile(f));
		const total = counts.reduce((sum, count) => sum + count, 0);

		logger.log(`Total for "${tag}": ${total}`);
		return total;
	}

	private async calculateCharacterCountsByFile(tag: string): Promise<Map<string, number>> {
		const files = await this.findFilesWithTag(tag);
		const results = new Map<string, number>();
		const counts = await mapWithConcurrency(files, (f) => this.countCharactersInFile(f));
		for (let i = 0; i < files.length; i++) {
			results.set(files[i].path, counts[i] ?? 0);
		}

		return results;
	}

	async collectData(): Promise<void> {
		const tags = this.plugin.settings.trackingTags;
		if (!tags?.length) return;

		try {
			for (const tagConfig of tags) {
				if (tagConfig.isActive) {
					await this.collectDataForTag(tagConfig.tag);
				}
			}
			this.refreshViews();
		} catch (error) {
			logger.error("Data collection stopped due to error:", error);
		}
	}

	private async collectDataForTag(tag: string): Promise<void> {
		const currentCounts = await this.calculateCharacterCountsByFile(tag);
		const currentTotal = Array.from(currentCounts.values()).reduce((s, n) => s + n, 0);

		const previousFileCounts = await this.statsStorage.getFileCharacterCounts(tag);
		const previousTotal = await this.statsStorage.getLastTotalCharacterCount(tag);

		// 初回実行、または旧方式(lastTotalのみ)からの移行: まずはベースライン保存してスパイクを防ぐ
		if (previousTotal === null || previousFileCounts.size === 0) {
			await Promise.all([
				...Array.from(currentCounts.entries()).map(([path, count]) =>
					this.statsStorage.saveFileCharacterCount(tag, path, count)
				),
				this.statsStorage.saveLastTotalCharacterCount(currentTotal, tag),
			]);
			logger.log(`Initialized file baselines for "${tag}" at ${currentTotal}`);
			return;
		}

		let diffSum = 0;
		const currentPaths = new Set<string>(currentCounts.keys());
		const writes: Promise<void>[] = [];

		for (const [path, count] of currentCounts.entries()) {
			const prev = previousFileCounts.get(path);
			// 新規捕捉ファイル: 初回は差分0としてベースラインだけ保存
			if (prev === undefined) {
				writes.push(this.statsStorage.saveFileCharacterCount(tag, path, count));
				continue;
			}
			if (count !== prev) {
				diffSum += count - prev;
				writes.push(this.statsStorage.saveFileCharacterCount(tag, path, count));
			}
		}

		// 追跡対象から外れたファイルはベースラインも掃除（削除自体は差分として扱わない）
		for (const prevPath of previousFileCounts.keys()) {
			if (!currentPaths.has(prevPath)) {
				writes.push(this.statsStorage.deleteFileCharacterCount(tag, prevPath));
			}
		}

		writes.push(this.statsStorage.saveLastTotalCharacterCount(currentTotal, tag));
		await Promise.all(writes);

		if (diffSum !== 0) {
			const now = window.moment();
			const today = now.format("YYYY-MM-DD");
			const hour = now.hour();
			await Promise.all([
				this.statsStorage.updateDailyStats(today, diffSum, tag),
				this.statsStorage.updateHourlyStats(today, diffSum, tag, hour),
			]);
			logger.log(`Tag "${tag}": Updated stats. Diff: ${diffSum}`);
		}
	}

	private refreshViews(): void {
		refreshCountNovelViews(this.plugin);
	}
}

async function yieldToEventLoop(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mapWithConcurrency<TItem, TResult>(
	items: TItem[],
	mapper: (item: TItem) => Promise<TResult>,
	concurrency: number = COUNT_CONCURRENCY
): Promise<TResult[]> {
	const results: TResult[] = [];

	for (let i = 0; i < items.length; i += concurrency) {
		const chunk = items.slice(i, i + concurrency);
		results.push(...(await Promise.all(chunk.map(mapper))));
		await yieldToEventLoop();
	}

	return results;
}

function hasTag(plugin: CountNovelsPlugin, file: TFile, tag: string): boolean {
	try {
		const cache = plugin.app.metadataCache.getFileCache(file);
		if (!cache) return false;
		const inlineTag = `#${tag}`;

		// Inline tags (#novel)
		if (cache.tags?.some((t) => t.tag === inlineTag)) return true;

		// Frontmatter tags (tags: [novel])
		const fmTags = cache.frontmatter?.tags;
		if (!fmTags) return false;
		const fmTagList = Array.isArray(fmTags) ? fmTags : [fmTags];
		return fmTagList.includes(tag);
	} catch (e) {
		logger.warn(`Error checking tags for ${file.path}`, e);
		return false;
	}
}

function refreshCountNovelViews(plugin: CountNovelsPlugin): void {
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view.getViewType() === VIEW_TYPE_COUNT_NOVEL) {
			const view = leaf.view as any;
			if (typeof view.refreshStats === "function") {
				view.refreshStats();
			} else {
				view.refreshSummary?.();
				view.refreshChart?.();
			}
		}
	});
}
