import { TFile } from "obsidian";
import { splitMd } from "src/utils/markdwon";
import type CountNovelsPlugin from "../main";
import { VIEW_TYPE_COUNT_NOVEL } from "../utils/constants";
import type { StatsStorage } from "./statsStorage";
import log from "loglevel";
import { isPathInExcludedFolders } from "src/utils/excludedFolders";

const logger = log.getLogger("DataCollectionService");

/**
 * データ収集サービス
 * ファイルスキャンと文字数集計機能を提供
 */
export class DataCollectionService {
	constructor(
		private readonly plugin: CountNovelsPlugin,
		private readonly statsStorage: StatsStorage
	) {}

	/**
	 * 指定タグを持つファイルを検索する機能
	 * 要件2.1: 指定タグを持つ全ファイルの合計文字数を計算する
	 */
	async findFilesWithTag(tag: string): Promise<TFile[]> {
		if (!this.isValidTag(tag)) {
			logger.warn("Count Novels: Empty tag provided for file search");
			return [];
		}

		const files = this.plugin.app.vault.getMarkdownFiles();
		const excludedFolders = this.plugin.settings.excludedFolders;
		logger.log(
			`Count Novels: Scanning ${files.length} markdown files for tag "${tag}"`
		);

		const taggedFiles = files.filter((file) => {
			if (this.shouldExclude(file, excludedFolders)) {
				return false;
			}
			return this.hasTag(file, tag);
		});

		logger.log(
			`Count Novels: Found ${taggedFiles.length} files with tag "${tag}"`
		);
		return taggedFiles;
	}

	/**
	 * タグの妥当性をチェック
	 */
	private isValidTag(tag: string): boolean {
		return tag?.trim() !== "";
	}

	/**
	 * ファイルが指定タグを持つかチェック
	 */
	private hasTag(file: TFile, tag: string): boolean {
		try {
			const cache = this.plugin.app.metadataCache.getFileCache(file);

			if (this.hasInlineTag(cache, tag)) {
				logger.log(
					`Count Novels: Found tag "${tag}" in file: ${file.path}`
				);
				return true;
			}

			if (this.hasFrontmatterTag(cache, tag)) {
				logger.log(
					`Count Novels: Found tag "${tag}" in frontmatter of file: ${file.path}`
				);
				return true;
			}

			return false;
		} catch (error) {
			logger.warn(
				`Count Novels: Error checking tags for file ${file.path}:`,
				error
			);
			return false;
		}
	}

	private shouldExclude(file: TFile, excludedFolders: string[]): boolean {
		if (!excludedFolders.length) {
			return false;
		}

		const inExcluded = isPathInExcludedFolders(file.path, excludedFolders);
		if (inExcluded) {
			logger.log(
				`Count Novels: Skipping file in excluded folder (${file.path})`
			);
		}
		return inExcluded;
	}

	/**
	 * インラインタグをチェック (#novel形式)
	 */
	private hasInlineTag(cache: any, tag: string): boolean {
		return (
			cache?.tags?.some((tagRef: any) => tagRef.tag === `#${tag}`) ??
			false
		);
	}

	/**
	 * フロントマタータグをチェック (tags: [novel]形式)
	 */
	private hasFrontmatterTag(cache: any, tag: string): boolean {
		const frontmatterTags = cache?.frontmatter?.tags;
		if (!frontmatterTags) return false;

		const tags = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];
		return tags.includes(tag);
	}

	/**
	 * ファイル内容から文字数をカウントする機能
	 * 要件2.2: 文字数を計算する
	 */
	async countCharactersInFile(file: TFile): Promise<number> {
		try {
			const content = await this.plugin.app.vault.cachedRead(file);
			const { content: markdownContent } = splitMd(content);
			return markdownContent.length;
		} catch (error) {
			logger.warn(
				`Count Novels: Error reading file ${file.path}:`,
				error
			);
			return 0;
		}
	}

	/**
	 * 合計文字数を計算する機能
	 * 要件2.1, 2.2: 指定タグを持つ全ファイルの合計文字数を計算する
	 */
	async calculateTotalCharacterCount(): Promise<number> {
		try {
			const tag = this.plugin.settings.trackingTag;
			const taggedFiles = await this.findFilesWithTag(tag);

			const counts = await Promise.all(
				taggedFiles.map((file) => this.countCharactersInFile(file))
			);

			const totalCount = counts.reduce((sum, count) => sum + count, 0);

			logger.log(
				`Count Novels: Total character count for tag "${tag}": ${totalCount}`
			);
			return totalCount;
		} catch (error) {
			logger.error(
				"Count Novels: Error calculating total character count:",
				error
			);
			return 0;
		}
	}

	/**
	 * データ収集を実行する(メイン機能)
	 * 要件2.1, 2.2: システムは指定タグを持つ全ファイルの合計文字数を計算する
	 */
	async collectData(): Promise<void> {
		try {
			const currentTotal = await this.calculateTotalCharacterCount();
			const previousTotal =
				await this.statsStorage.getLastTotalCharacterCount();
			const difference = currentTotal - previousTotal;

			logger.log(
				`Count Novels: Previous total: ${previousTotal}, Current total: ${currentTotal}, Difference: ${difference}`
			);

			// 差分が0でも currentTotal は保存する（初回データ収集の場合など）
			await this.statsStorage.saveLastTotalCharacterCount(currentTotal);

			// 差分が0の場合のみ統計を保存しない
			if (difference === 0) {
				logger.log("Count Novels: No change in character count.");
				return;
			}

			const today = this.getTodayString();
			await this.saveDailyAndHourlyStats(today, difference);
			this.refreshViews();

			if (difference > 0) {
				logger.log(
					`Count Novels: Data collection completed. Recorded ${difference} characters for ${today}`
				);
			} else {
				logger.log(
					`Count Novels: Character count decreased by ${Math.abs(difference)}. Adjusted stats for ${today}`
				);
			}
		} catch (error) {
			logger.error("Count Novels: Error during data collection:", error);
		}
	}

	/**
	 * 今日の日付を YYYY-MM-DD 形式で取得
	 */
	private getTodayString(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	/**
	 * 統計データを保存（日次・時間別のみ）
	 */
	private async saveDailyAndHourlyStats(
		date: string,
		difference: number
	): Promise<void> {
		await Promise.all([
			this.statsStorage.updateDailyStats(date, difference),
			this.statsStorage.updateHourlyStats(date, difference),
		]);
	}

	/**
	 * データ更新時にビューを更新する機能
	 * 要件: データ更新時にサマリーとグラフを再描画する
	 */
	private refreshViews(): void {
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === VIEW_TYPE_COUNT_NOVEL) {
				this.refreshView(leaf.view);
			}
		});
	}

	/**
	 * 個別のビューを更新
	 */
	private refreshView(view: any): void {
		if (typeof view.refreshStats === "function") {
			view.refreshStats();
		} else {
			// フォールバック: 個別メソッドを呼び出し
			this.callIfExists(view, "refreshSummary");
			this.callIfExists(view, "refreshChart");
		}
	}

	/**
	 * メソッドが存在する場合のみ呼び出す
	 */
	private callIfExists(obj: any, methodName: string): void {
		if (typeof obj[methodName] === "function") {
			obj[methodName]();
		}
	}
}
