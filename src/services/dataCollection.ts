import { TFile } from "obsidian";
import { splitMd } from "src/utils/markdwon";
import type CountNovelsPlugin from "../main";
import { VIEW_TYPE_COUNT_NOVEL } from "../utils/constants";

/**
 * データ収集サービス
 * ファイルスキャンと文字数集計機能を提供
 */
export class DataCollectionService {
	private plugin: CountNovelsPlugin;

	constructor(plugin: CountNovelsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * 指定タグを持つファイルを検索する機能
	 * 要件2.1: 指定タグを持つ全ファイルの合計文字数を計算する
	 */
	async findFilesWithTag(tag: string): Promise<TFile[]> {
		if (!tag || tag.trim() === "") {
			console.warn("Count Novels: Empty tag provided for file search");
			return [];
		}

		const files = this.plugin.app.vault.getMarkdownFiles();
		const taggedFiles: TFile[] = [];

		console.log(
			`Count Novels: Scanning ${files.length} markdown files for tag "${tag}"`
		);

		for (const file of files) {
			try {
				const cache = this.plugin.app.metadataCache.getFileCache(file);
				let hasTag = false;

				// ファイル内のタグをチェック (e.g., #novel)
				if (cache?.tags) {
					hasTag = cache.tags.some(
						(tagRef) => tagRef.tag === `#${tag}`
					);
					if (hasTag) {
						taggedFiles.push(file);
						console.log(
							`Count Novels: Found tag "${tag}" in file: ${file.path}`
						);
					}
				}

				// フロントマターのタグもチェック (e.g., tags: [novel])
				if (!hasTag && cache?.frontmatter?.tags) {
					const frontmatterTags = Array.isArray(
						cache.frontmatter.tags
					)
						? cache.frontmatter.tags
						: [cache.frontmatter.tags];

					hasTag = frontmatterTags.includes(tag);
					if (hasTag) {
						taggedFiles.push(file);
						console.log(
							`Count Novels: Found tag "${tag}" in frontmatter of file: ${file.path}`
						);
					}
				}
			} catch (error) {
				console.warn(
					`Count Novels: Error checking tags for file ${file.path}:`,
					error
				);
			}
		}

		console.log(
			`Count Novels: Found ${taggedFiles.length} files with tag "${tag}"`
		);
		return taggedFiles;
	}

	/**
	 * ファイル内容から文字数をカウントする機能
	 * 要件2.2: 文字数を計算する
	 */
	async countCharactersInFile(file: TFile): Promise<number> {
		try {
			const fileData = splitMd(
				await this.plugin.app.vault.cachedRead(file)
			);
			return this.countCharacters(fileData.content);
		} catch (error) {
			console.warn(
				`Count Novels: Error reading file ${file.path}:`,
				error
			);
			return 0;
		}
	}

	/**
	 * 文字列の文字数をカウントする（シンプル版）
	 * 設計書通りのシンプルな実装
	 */
	private countCharacters(content: string): number {
		// MVPでは単純な文字数カウント
		return content.length;
	}

	/**
	 * 合計文字数を計算する機能
	 * 要件2.1, 2.2: 指定タグを持つ全ファイルの合計文字数を計算する
	 */
	async calculateTotalCharacterCount(): Promise<number> {
		const tag = this.plugin.settings.trackingTag;

		try {
			const taggedFiles = await this.findFilesWithTag(tag);
			let totalCount = 0;

			for (const file of taggedFiles) {
				const characterCount = await this.countCharactersInFile(file);
				totalCount += characterCount;
			}

			console.log(
				`Count Novels: Total character count for tag "${tag}": ${totalCount}`
			);
			return totalCount;
		} catch (error) {
			console.error(
				"Count Novels: Error calculating total character count:",
				error
			);
			return 0;
		}
	}

	/**
	 * データ収集を実行する（メイン機能）
	 * 要件2.1, 2.2: システムは指定タグを持つ全ファイルの合計文字数を計算する
	 */
	async collectData(): Promise<void> {
		try {
			const currentTotal = await this.calculateTotalCharacterCount();

			// データストレージから現在のデータを取得
			const pluginData = this.plugin.dataStorage.getData();
			if (!pluginData) {
				console.error("Count Novels: Plugin data not initialized");
				return;
			}

			const previousTotal = pluginData.lastTotalCharacterCount;
			const difference = currentTotal - previousTotal;

			console.log(
				`Count Novels: Previous total: ${previousTotal}, Current total: ${currentTotal}, Difference: ${difference}`
			);

			// 今日の日付を取得（YYYY-MM-DD形式）
			const today = new Date().toISOString().split("T")[0];

			// 差分を記録（要件2.3, 2.4, 2.5に対応）
			this.plugin.dataStorage.updateDailyStats(today, difference);
			this.plugin.dataStorage.updateLastTotalCharacterCount(currentTotal);

			// データを保存
			await this.plugin.dataStorage.saveData();

			// データ更新時にビューを更新
			this.refreshViews();

			console.log(
				`Count Novels: Data collection completed. Recorded ${difference} characters for ${today}`
			);
		} catch (error) {
			console.error("Count Novels: Error during data collection:", error);
		}
	}

	/**
	 * データ更新時にビューを更新する機能
	 * 要件: データ更新時にサマリーを再描画する
	 */
	private refreshViews(): void {
		// アクティブなCount Novelsビューを探して更新
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === VIEW_TYPE_COUNT_NOVEL) {
				const view = leaf.view as any; // CountNovelHomeの型を使用
				if (
					view.refreshSummary &&
					typeof view.refreshSummary === "function"
				) {
					view.refreshSummary();
				}
			}
		});
	}
}
