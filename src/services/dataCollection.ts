import { TFile, Notice } from "obsidian";
import { splitMd } from "src/utils/markdwon";
import type CountNovelsPlugin from "../main";
import { VIEW_TYPE_COUNT_NOVEL } from "../utils/constants";
import type { StatsStorage } from "./statsStorage";
import log from "loglevel";
// @ts-expect-error: inline worker import
import CountWorker from "../workers/count.worker.ts";
import { isPathInExcludedFolders } from "src/utils/excludedFolders";

const logger = log.getLogger("DataCollectionService");

export class DataCollectionService {
	private countWorker?: Worker;
	private pendingResponses: Map<string, (n: number) => void> = new Map();
	private idCounter = 0;

	constructor(
		private readonly plugin: CountNovelsPlugin,
		private readonly statsStorage: StatsStorage
	) {
		this.setupWorker();
	}

	private setupWorker(): void {
		try {
			const factory = CountWorker;
			this.countWorker = factory();
			
			if (this.countWorker) {
				this.countWorker.onmessage = (ev: MessageEvent) => {
					const data = ev.data;
					if (!data) return;

					if (data.results && Array.isArray(data.results)) {
						for (const r of data.results) {
							const resolver = this.pendingResponses.get(r.id);
							if (resolver) {
								resolver(r.count);
								this.pendingResponses.delete(r.id);
							}
						}
						return;
					}

					if (data.id && typeof data.count === "number") {
						const resolver = this.pendingResponses.get(data.id);
						if (resolver) {
							resolver(data.count);
							this.pendingResponses.delete(data.id);
						}
					}
				};
			}
		} catch (e) {
			const msg = "Count Novels: Worker initialization failed.";
			new Notice(msg);
			logger.error(msg, e);
			this.countWorker = undefined;
		}
	}

	async findFilesWithTag(tag: string): Promise<TFile[]> {
		if (!tag?.trim()) return [];

		const files = this.plugin.app.vault.getMarkdownFiles();
		const excluded = this.plugin.settings.excludedFolders;

		return files.filter((file) => {
			if (excluded.length && isPathInExcludedFolders(file.path, excluded)) {
				return false;
			}
			return this.hasTag(file, tag);
		});
	}

	private hasTag(file: TFile, tag: string): boolean {
		try {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!cache) return false;

			// Inline tags (#novel)
			if (cache.tags?.some((t) => t.tag === `#${tag}`)) return true;

			// Frontmatter tags (tags: [novel])
			const fmTags = cache.frontmatter?.tags;
			if (fmTags) {
				return (Array.isArray(fmTags) ? fmTags : [fmTags]).includes(tag);
			}

			return false;
		} catch (e) {
			logger.warn(`Error checking tags for ${file.path}`, e);
			return false;
		}
	}

	async countCharactersInFile(file: TFile): Promise<number> {
		// Worker必須: 存在しない場合はNoticeを出して停止
		if (!this.countWorker) {
			const msg = "Count Novels: Worker is not active. Processing stopped.";
			new Notice(msg);
			throw new Error(msg);
		}

		try {
			const content = await this.plugin.app.vault.cachedRead(file);
			const { content: markdownContent } = splitMd(content);
			const id = `c_${++this.idCounter}_${Date.now()}`;

			return new Promise<number>((resolve) => {
				this.pendingResponses.set(id, resolve);
				this.countWorker!.postMessage({ id, content: markdownContent });
			});
		} catch (error) {
			logger.error(`Error processing file ${file.path}:`, error);
			return 0;
		}
	}

	async calculateTotalCharacterCount(tag: string): Promise<number> {
		const files = await this.findFilesWithTag(tag);
		const concurrency = 6;
		let total = 0;

		for (let i = 0; i < files.length; i += concurrency) {
			const chunk = files.slice(i, i + concurrency);
			const counts = await Promise.all(chunk.map((f) => this.countCharactersInFile(f)));
			total += counts.reduce((sum, c) => sum + c, 0);
			await new Promise((r) => setTimeout(r, 0)); // UIブロック防止
		}
		
		logger.log(`Total for "${tag}": ${total}`);
		return total;
	}

	private async calculateCharacterCountsByFile(tag: string): Promise<Map<string, number>> {
		const files = await this.findFilesWithTag(tag);
		const concurrency = 6;
		const results = new Map<string, number>();

		for (let i = 0; i < files.length; i += concurrency) {
			const chunk = files.slice(i, i + concurrency);
			const counts = await Promise.all(chunk.map((f) => this.countCharactersInFile(f)));
			for (let j = 0; j < chunk.length; j++) {
				results.set(chunk[j].path, counts[j] ?? 0);
			}
			await new Promise((r) => setTimeout(r, 0)); // UIブロック防止
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
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
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
}
