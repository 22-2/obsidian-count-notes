import log from "loglevel";
import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { DataStorage } from "./data";
import { DataCollectionService } from "./services/dataCollection";
import {
	CountNovelsSettingTab,
	type CountNovelsSettings,
	DEFAULT_SETTINGS,
} from "./settings";
import { VIEW_TYPE_COUNT_NOVEL } from "./utils/constants";

export default class CountNovelsPlugin extends Plugin {
	settings: CountNovelsSettings = DEFAULT_SETTINGS;
	dataStorage!: DataStorage;
	dataCollectionService!: DataCollectionService;
	intervalId?: number; // 定期実行用のタイマーID

	async onload() {
		// データストレージを初期化
		this.dataStorage = new DataStorage(this);

		// データ収集サービスを初期化
		this.dataCollectionService = new DataCollectionService(this);

		await this.loadSettings();
		this.addSettingTab(new CountNovelsSettingTab(this));
		this.togglLoggersBy(this.settings.logLevel);
		this.registerView(
			VIEW_TYPE_COUNT_NOVEL,
			(leaf) => {
				const view = new CountNovelHome(leaf);
				view.setPlugin(this);
				return view;
			}
		);
		this.addCommand({
			id: "open-count-novels-home",
			name: "Open Count Novels Home",
			callback: () => {
				this.app.workspace.getLeaf("tab")!.setViewState({
					type: VIEW_TYPE_COUNT_NOVEL,
					active: true,
				});
			},
		});

		// デバッグ用コマンド：手動でデータ収集を実行
		this.addCommand({
			id: "collect-data-manually",
			name: "Collect Data Manually (Debug)",
			callback: async () => {
				console.log("Count Novels: Manual data collection triggered");
				await this.collectData();
				console.log("Count Novels: Manual data collection completed");
			},
		});

		// プラグインデータを読み込み
		await this.dataStorage.loadData();

		// 要件2.1: Obsidian起動時にデータ収集を実行
		await this.dataCollectionService.collectData();

		// 要件2.2: 10分間隔でデータ収集を実行する定期実行機能を実装
		this.startPeriodicDataCollection();
	}

	onunload() {
		// プラグイン無効化時に定期実行を停止する機能を実装
		this.stopPeriodicDataCollection();
	}

	togglLoggersBy(
		level: log.LogLevelDesc,
		filter: (name: string) => boolean = () => true
	): void {
		Object.values(log.getLoggers())
			// @ts-expect-error
			.filter((logger) => filter(logger.name))
			.forEach((logger) => {
				logger.setLevel(level);
			});
	}

	async loadSettings() {
		// データストレージから設定を読み込み
		const pluginData = await this.dataStorage.loadData();
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			pluginData.settings
		);
	}

	async saveSettings() {
		// 設定をデータストレージに保存
		this.dataStorage.updateData({ settings: this.settings });
		await this.dataStorage.saveData();
	}

	/**
	 * データ収集を実行する（公開メソッド）
	 * 要件2.1, 2.2: 指定タグを持つ全ファイルの合計文字数を計算し、差分を記録
	 */
	async collectData(): Promise<void> {
		await this.dataCollectionService.collectData();
	}

	/**
	 * 10分間隔でデータ収集を実行する定期実行機能を開始
	 * 要件2.2: 10分経過する THEN システムは再度合計文字数を計算し、前回との差分を記録する
	 */
	private startPeriodicDataCollection(): void {
		// 既存のタイマーがあれば停止
		this.stopPeriodicDataCollection();

		// 10分間隔（600,000ミリ秒）でデータ収集を実行
		this.registerInterval(
			(this.intervalId = window.setInterval(async () => {
				console.log("Count Novels: Periodic data collection triggered");
				try {
					await this.collectData();
					console.log(
						"Count Novels: Periodic data collection completed"
					);
				} catch (error) {
					console.error(
						"Count Novels: Error during periodic data collection:",
						error
					);
				}
			}, 10 * 60 * 1000))
		); // 10分間隔

		console.log(
			"Count Novels: Periodic data collection started (10-minute interval)"
		);
	}

	/**
	 * 定期実行を停止する機能
	 * プラグイン無効化時に定期実行を停止する
	 */
	private stopPeriodicDataCollection(): void {
		if (this.intervalId) {
			window.clearInterval(this.intervalId);
			this.intervalId = undefined;
			console.log("Count Novels: Periodic data collection stopped");
		}
	}
}

class CountNovelHome extends ItemView {
	private plugin: CountNovelsPlugin;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		// プラグインインスタンスは後で設定される
		this.plugin = null as any;
	}

	/**
	 * プラグインインスタンスを設定する
	 */
	setPlugin(plugin: CountNovelsPlugin): void {
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_COUNT_NOVEL;
	}

	getDisplayText() {
		return "Count Novels Home";
	}

	async onOpen() {
		this.renderView();
	}

	async onClose() {}

	/**
	 * 統計ビューの基本構造を描画
	 * 要件3.1: システムは統計ビューを開く
	 * 要件3.5: データが存在しない場合は「データがありません」メッセージを表示
	 */
	private renderView(): void {
		this.containerEl.empty();
		
		// メインコンテナ
		const mainContainer = this.containerEl.createDiv("count-novels-main");
		
		// ヘッダー
		const header = mainContainer.createEl("h1", { 
			text: "執筆進捗", 
			cls: "count-novels-header" 
		});

		// データの存在確認
		const pluginData = this.plugin.dataStorage.getData();
		const hasData = pluginData && Object.keys(pluginData.dailyStats).length > 0;

		if (!hasData) {
			// 要件3.5: データが存在しない場合のメッセージ表示
			this.renderNoDataMessage(mainContainer);
		} else {
			// データが存在する場合の基本構造を作成
			this.renderStatsStructure(mainContainer);
		}
	}

	/**
	 * データが存在しない場合のメッセージを表示
	 * 要件3.5: IF データが存在しない場合 THEN システムは「データがありません」メッセージを表示する
	 */
	private renderNoDataMessage(container: HTMLElement): void {
		const noDataContainer = container.createDiv("count-novels-no-data");
		
		noDataContainer.createEl("p", {
			text: "データがありません",
			cls: "count-novels-no-data-message"
		});
		
		noDataContainer.createEl("p", {
			text: "執筆を開始すると、ここに進捗が表示されます。",
			cls: "count-novels-no-data-subtitle"
		});
	}

	/**
	 * 統計データが存在する場合の基本HTML構造を作成
	 * サマリー表示機能を実装
	 */
	private renderStatsStructure(container: HTMLElement): void {
		// サマリーセクション
		const summarySection = container.createDiv("count-novels-summary");
		summarySection.createEl("h2", { 
			text: "サマリー", 
			cls: "count-novels-section-title" 
		});
		
		// サマリー表示機能を実装
		this.renderSummary(summarySection);

		// グラフセクション（タスク8で実装予定）
		const chartSection = container.createDiv("count-novels-chart");
		chartSection.createEl("h2", { 
			text: "月間グラフ", 
			cls: "count-novels-section-title" 
		});
		
		const chartContent = chartSection.createDiv("count-novels-chart-content");
		chartContent.createEl("p", {
			text: "グラフ機能は次のタスクで実装されます",
			cls: "count-novels-placeholder"
		});
	}

	/**
	 * サマリー表示機能の実装
	 * 要件3.2: 今月の合計執筆文字数を表示
	 * 要件3.3: 継続日数（ストリーク）を表示
	 */
	private renderSummary(container: HTMLElement): void {
		const summaryContent = container.createDiv("count-novels-summary-content");
		
		// 今月の合計執筆文字数を計算・表示
		const monthlyTotal = this.calculateMonthlyTotal();
		const monthlyTotalEl = summaryContent.createDiv("count-novels-summary-item");
		monthlyTotalEl.createEl("span", {
			text: "今月の執筆文字数: ",
			cls: "count-novels-summary-label"
		});
		monthlyTotalEl.createEl("span", {
			text: `${monthlyTotal.toLocaleString()}文字`,
			cls: "count-novels-summary-value"
		});

		// 継続日数（ストリーク）を計算・表示
		const streak = this.calculateStreak();
		const streakEl = summaryContent.createDiv("count-novels-summary-item");
		streakEl.createEl("span", {
			text: "継続日数: ",
			cls: "count-novels-summary-label"
		});
		streakEl.createEl("span", {
			text: `${streak}日`,
			cls: "count-novels-summary-value count-novels-streak"
		});
	}

	/**
	 * 今月の合計執筆文字数を計算する機能
	 * 要件3.2: WHEN 統計ビューが開かれる THEN システムは今月の合計執筆文字数を表示する
	 */
	private calculateMonthlyTotal(): number {
		const pluginData = this.plugin.dataStorage.getData();
		if (!pluginData || !pluginData.dailyStats) {
			return 0;
		}

		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1; // getMonth()は0ベースなので+1
		const monthPrefix = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

		let monthlyTotal = 0;
		for (const [date, characterDiff] of Object.entries(pluginData.dailyStats)) {
			if (date.startsWith(monthPrefix)) {
				// 正の値のみを合計（執筆文字数のみ、削除は除外）
				if (characterDiff > 0) {
					monthlyTotal += characterDiff;
				}
			}
		}

		return monthlyTotal;
	}

	/**
	 * 継続日数（ストリーク）を計算する機能
	 * 要件6.1: 1文字以上執筆した日を「執筆日」とカウント
	 * 要件6.2: 今日から遡って連続する執筆日数を計算
	 * 要件6.3: 執筆しなかった日がある場合は継続日数をリセット
	 * 要件6.4: 今日まだ執筆していない場合は昨日までの継続日数を表示
	 * 要件6.5: 執筆データが1日もない場合は継続日数を0として表示
	 */
	private calculateStreak(): number {
		const pluginData = this.plugin.dataStorage.getData();
		if (!pluginData || !pluginData.dailyStats) {
			// 要件6.5: 執筆データが1日もない場合は継続日数を0として表示
			return 0;
		}

		const today = new Date();
		let streak = 0;
		let currentDate = new Date(today);

		// 今日の執筆データがあるかチェック
		const todayString = this.formatDateString(today);
		const todayStats = pluginData.dailyStats[todayString];
		const hasTodayData = todayStats && todayStats > 0;

		// 要件6.4: 今日まだ執筆していない場合は昨日から開始
		if (!hasTodayData) {
			currentDate.setDate(currentDate.getDate() - 1);
		}

		// 遡って連続する執筆日数を計算
		while (true) {
			const dateString = this.formatDateString(currentDate);
			const dayStats = pluginData.dailyStats[dateString];

			// 要件6.1: 1文字以上執筆した日を「執筆日」とカウント
			if (dayStats && dayStats > 0) {
				streak++;
				currentDate.setDate(currentDate.getDate() - 1);
			} else {
				// 要件6.3: 執筆しなかった日がある場合は継続日数をリセット
				break;
			}

			// 無限ループ防止（1年以上遡らない）
			if (streak > 365) {
				break;
			}
		}

		return streak;
	}

	/**
	 * 日付をYYYY-MM-DD形式の文字列に変換するヘルパー関数
	 */
	private formatDateString(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * ビューを再描画する（データ更新時に使用）
	 * データ更新時にサマリーを再描画する機能を実装
	 */
	public refreshView(): void {
		this.renderView();
	}

	/**
	 * サマリーのみを再描画する（効率的な更新用）
	 * データ更新時にサマリーを再描画する機能
	 */
	public refreshSummary(): void {
		const summarySection = this.containerEl.querySelector('.count-novels-summary');
		if (summarySection) {
			// 既存のサマリーコンテンツをクリア
			const summaryContent = summarySection.querySelector('.count-novels-summary-content');
			if (summaryContent) {
				summaryContent.remove();
			}
			
			// サマリーを再描画
			this.renderSummary(summarySection as HTMLElement);
		}
	}
}
