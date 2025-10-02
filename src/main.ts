import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	Legend,
	LinearScale,
	Title,
	Tooltip,
	type ChartConfiguration,
	type ChartData,
} from "chart.js";
import log from "loglevel";
import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { DataStorage } from "./data";
import { DataCollectionService } from "./services/dataCollection";
import {
	CountNovelsSettingTab,
	DEFAULT_SETTINGS,
	type CountNovelsSettings,
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
		this.registerView(VIEW_TYPE_COUNT_NOVEL, (leaf) => {
			const view = new CountNovelHome(leaf);
			view.setPlugin(this);
			return view;
		});
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
	private chartInstance?: Chart;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		// プラグインインスタンスは後で設定される
		this.plugin = null as any;

		// Chart.jsライブラリを初期化
		this.initializeChartJS();
	}

	/**
	 * プラグインインスタンスを設定する
	 */
	setPlugin(plugin: CountNovelsPlugin): void {
		this.plugin = plugin;
	}

	/**
	 * Chart.jsライブラリを初期化する機能を実装
	 * 要件4.1: Chart.jsを使用してバーグラフを描画する
	 */
	private initializeChartJS(): void {
		// Chart.jsに必要なコンポーネントを登録
		Chart.register(
			BarController,
			CategoryScale,
			LinearScale,
			BarElement,
			Title,
			Tooltip,
			Legend
		);
	}

	/**
	 * 現在のテーマに応じた色を取得する
	 */
	private getThemeColors() {
		// Obsidianのテーマを判定（ダークテーマかライトテーマか）
		const isDarkTheme = document.body.classList.contains("theme-dark");

		if (isDarkTheme) {
			// ダークテーマの色（現在の設定）
			return {
				textPrimary: "#ffffff",
				textSecondary: "#cccccc",
				gridColor: "#444444",
				tooltipBg: "rgba(0, 0, 0, 0.8)",
				tooltipBorder: "#666666",
				positiveColor: "rgba(100, 200, 100, 0.7)",
				positiveBorder: "rgba(100, 200, 100, 1)",
				negativeColor: "rgba(255, 140, 140, 0.7)",
				negativeBorder: "rgba(255, 140, 140, 1)",
			};
		} else {
			// ライトテーマの色
			return {
				textPrimary: "#222222",
				textSecondary: "#666666",
				gridColor: "#e0e0e0",
				tooltipBg: "rgba(255, 255, 255, 0.95)",
				tooltipBorder: "#cccccc",
				positiveColor: "rgba(40, 160, 40, 0.7)",
				positiveBorder: "rgba(40, 160, 40, 1)",
				negativeColor: "rgba(220, 60, 60, 0.7)",
				negativeBorder: "rgba(220, 60, 60, 1)",
			};
		}
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

	async onClose() {
		// Chart.jsインスタンスをクリーンアップ
		if (this.chartInstance) {
			this.chartInstance.destroy();
			this.chartInstance = undefined;
		}
	}

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
			cls: "count-novels-header",
		});

		// データの存在確認
		const pluginData = this.plugin.dataStorage.getData();
		const hasData =
			pluginData && Object.keys(pluginData.dailyStats).length > 0;

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
			cls: "count-novels-no-data-message",
		});

		noDataContainer.createEl("p", {
			text: "執筆を開始すると、ここに進捗が表示されます。",
			cls: "count-novels-no-data-subtitle",
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
			cls: "count-novels-section-title",
		});

		// サマリー表示機能を実装
		this.renderSummary(summarySection);

		// グラフセクション
		const chartSection = container.createDiv("count-novels-chart");
		chartSection.createEl("h2", {
			text: "月間グラフ",
			cls: "count-novels-section-title",
		});

		const chartContent = chartSection.createDiv(
			"count-novels-chart-content"
		);

		// Chart.jsグラフ表示機能を実装
		this.renderChart(chartContent);
	}

	/**
	 * サマリー表示機能の実装
	 * 要件3.2: 今月の合計執筆文字数を表示
	 * 要件3.3: 継続日数（ストリーク）を表示
	 */
	private renderSummary(container: HTMLElement): void {
		const summaryContent = container.createDiv(
			"count-novels-summary-content"
		);

		// 今月の合計執筆文字数を計算・表示
		const monthlyTotal = this.calculateMonthlyTotal();
		const monthlyTotalEl = summaryContent.createDiv(
			"count-novels-summary-item"
		);
		monthlyTotalEl.createEl("span", {
			text: "今月の執筆文字数: ",
			cls: "count-novels-summary-label",
		});
		monthlyTotalEl.createEl("span", {
			text: `${monthlyTotal.toLocaleString()}文字`,
			cls: "count-novels-summary-value",
		});

		// 継続日数（ストリーク）を計算・表示
		const streak = this.calculateStreak();
		const streakEl = summaryContent.createDiv("count-novels-summary-item");
		streakEl.createEl("span", {
			text: "継続日数: ",
			cls: "count-novels-summary-label",
		});
		streakEl.createEl("span", {
			text: `${streak}日`,
			cls: "count-novels-summary-value count-novels-streak",
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
		const monthPrefix = `${currentYear}-${currentMonth
			.toString()
			.padStart(2, "0")}`;

		let monthlyTotal = 0;
		for (const [date, characterDiff] of Object.entries(
			pluginData.dailyStats
		)) {
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
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	/**
	 * Chart.jsグラフを描画・更新する機能を実装
	 * 要件3.4: 月間バーグラフを表示する
	 * 要件4.1: Chart.jsを使用してバーグラフを描画する
	 */
	private renderChart(container: HTMLElement): void {
		// 既存のチャートを破棄
		if (this.chartInstance) {
			this.chartInstance.destroy();
			this.chartInstance = undefined;
		}

		// キャンバス要素を作成
		const canvas = container.createEl("canvas", {
			cls: "count-novels-chart-canvas",
		});

		// グラフデータを生成
		const chartData = this.generateChartData();

		// 月間バーグラフの設定を作成
		const chartConfig = this.createChartConfiguration(chartData);

		// グラフを描画
		try {
			this.chartInstance = new Chart(canvas, chartConfig);
		} catch (error) {
			console.error("Count Novels: Failed to create chart:", error);
			// Chart.js読み込み失敗時のフォールバック
			this.renderChartFallback(container);
		}
	}

	/**
	 * 月間バーグラフの設定を作成
	 * 要件4.2: X軸には日付（1日、2日、3日...）を表示
	 * 要件4.3: Y軸には文字数を表示
	 * 要件4.4: 各日の執筆文字数をバーで表示
	 * 要件4.5: マイナス値がある場合は削除された文字数として異なる色で表示
	 */
	private createChartConfiguration(
		chartData: ChartData<"bar">
	): ChartConfiguration<"bar"> {
		// テーマに応じた色を取得
		const colors = this.getThemeColors();
		return {
			type: "bar",
			data: chartData,
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: "今月の執筆進捗",
						color: colors.textPrimary,
						font: {
							size: 16,
							weight: "bold",
						},
					},
					legend: {
						display: true,
						labels: {
							color: colors.textPrimary,
							font: {
								size: 12,
							},
							usePointStyle: true,
							padding: 20,
						},
					},
					tooltip: {
						backgroundColor: colors.tooltipBg,
						titleColor: colors.textPrimary,
						bodyColor: colors.textPrimary,
						borderColor: colors.tooltipBorder,
						borderWidth: 1,
						callbacks: {
							label: (context) => {
								const value = context.parsed.y;
								const label = context.dataset.label || "";
								return `${label}: ${value.toLocaleString()}文字`;
							},
						},
					},
				},
				scales: {
					x: {
						// 要件4.2: X軸には日付（1日、2日、3日...）を表示
						title: {
							display: true,
							text: "日付",
							color: colors.textPrimary,
							font: {
								size: 12,
								weight: "bold",
							},
						},
						ticks: {
							color: colors.textSecondary,
							font: {
								size: 11,
							},
							// X軸を5日間隔で表示（1日, 6日, 11日...）
							callback: function (value, index) {
								const day = index + 1; // インデックスは0ベースなので+1
								// 1日目、または5の倍数+1の日（6日、11日、16日...）を表示
								if (day === 1 || (day - 1) % 5 === 0) {
									return `${day}日`;
								}
								return "";
							},
							maxTicksLimit: 7, // 最大7個の目盛りに制限
						},
						grid: {
							color: colors.gridColor,
							lineWidth: 1,
						},
					},
					y: {
						// 要件4.3: Y軸には文字数を表示
						title: {
							display: true,
							text: "文字数",
							color: colors.textPrimary,
							font: {
								size: 12,
								weight: "bold",
							},
						},
						ticks: {
							color: colors.textSecondary,
							font: {
								size: 11,
							},
							// Y軸を動的に5分割で表示
							maxTicksLimit: 5, // 0を含めて5個の目盛り（5分割）
							stepSize: (() => {
								// chartDataから全データセットの最大値を取得
								let maxValue = 0;
								chartData.datasets.forEach((dataset) => {
									dataset.data.forEach((value) => {
										if (typeof value === "number") {
											maxValue = Math.max(
												maxValue,
												Math.abs(value)
											);
										}
									});
								});

								if (maxValue === 0) return 1000; // デフォルト値

								// 5分割するための適切なstepSizeを計算
								const rawStep = maxValue / 5;
								// きれいな数値に丸める（100, 200, 500, 1000, 2000, 5000など）
								const magnitude = Math.pow(
									10,
									Math.floor(Math.log10(rawStep))
								);
								const normalized = rawStep / magnitude;
								let niceStep;
								if (normalized <= 1) niceStep = 1;
								else if (normalized <= 2) niceStep = 2;
								else if (normalized <= 5) niceStep = 5;
								else niceStep = 10;
								return niceStep * magnitude;
							})(),
							callback: function (value) {
								if (typeof value === "number") {
									if (value === 0) return "0";
									if (value >= 1000) {
										return (
											(value / 1000).toLocaleString() +
											"k"
										);
									}
									return value.toLocaleString();
								}
								return value;
							},
						},
						grid: {
							color: colors.gridColor,
							lineWidth: 1,
						},
						beginAtZero: true,
					},
				},
			},
			// カスタムプラグインで棒グラフの頂点に数値を表示
			plugins: [
				{
					id: "dataLabels",
					afterDatasetsDraw: (chart: any) => {
						const ctx = chart.ctx;
						chart.data.datasets.forEach(
							(dataset: any, datasetIndex: number) => {
								const meta = chart.getDatasetMeta(datasetIndex);
								if (!meta.hidden) {
									meta.data.forEach(
										(bar: any, index: number) => {
											const value = dataset.data[index];
											if (value > 0) {
												// 0より大きい値のみ表示
												ctx.fillStyle =
													colors.textPrimary;
												ctx.font =
													"bold 11px sans-serif";
												ctx.textAlign = "center";
												ctx.textBaseline = "bottom";

												const x = bar.x;
												const y = bar.y - 5; // バーの上に少し余白を空けて表示

												ctx.fillText(
													value.toLocaleString(),
													x,
													y
												);
											}
										}
									);
								}
							}
						);
					},
				},
			],
		};
	}

	/**
	 * dailyStatsからグラフデータを生成する機能を実装
	 * 要件4.4: 各日の執筆文字数をバーで表示
	 * 要件4.5: マイナス値がある場合は削除された文字数として異なる色で表示
	 * 要件4.6: 月が変わる場合は新しい月のデータでグラフを更新
	 */
	private generateChartData(): ChartData<"bar"> {
		// テーマに応じた色を取得
		const colors = this.getThemeColors();
		const pluginData = this.plugin.dataStorage.getData();

		if (!pluginData || !pluginData.dailyStats) {
			return {
				labels: [],
				datasets: [],
			};
		}

		// 現在の月のデータを取得
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const monthPrefix = `${currentYear}-${currentMonth
			.toString()
			.padStart(2, "0")}`;

		// 月の日数を取得
		const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

		// 日付ラベルを生成（1日、2日、3日...）
		const labels: string[] = [];
		const positiveData: number[] = [];
		const negativeData: number[] = [];

		for (let day = 1; day <= daysInMonth; day++) {
			const dayString = day.toString();
			labels.push(`${dayString}日`);

			const dateKey = `${monthPrefix}-${dayString.padStart(2, "0")}`;
			const dayStats = pluginData.dailyStats[dateKey] || 0;

			// 要件4.4, 4.5: 正の値と負の値を分けて表示
			if (dayStats >= 0) {
				positiveData.push(dayStats);
				negativeData.push(0);
			} else {
				positiveData.push(0);
				negativeData.push(Math.abs(dayStats)); // 負の値を正の値として表示
			}
		}

		return {
			labels,
			datasets: [
				{
					label: "執筆文字数",
					data: positiveData,
					backgroundColor: colors.positiveColor,
					borderColor: colors.positiveBorder,
					borderWidth: 2,
				},
				{
					label: "削除文字数",
					data: negativeData,
					backgroundColor: colors.negativeColor,
					borderColor: colors.negativeBorder,
					borderWidth: 2,
				},
			],
		};
	}

	/**
	 * Chart.js読み込み失敗時のフォールバック表示
	 */
	private renderChartFallback(container: HTMLElement): void {
		container.empty();
		container.createEl("p", {
			text: "グラフの読み込みに失敗しました。テキスト形式で統計を表示します。",
			cls: "count-novels-placeholder",
		});

		// 簡単なテキストベースの統計表示
		const pluginData = this.plugin.dataStorage.getData();
		if (pluginData && pluginData.dailyStats) {
			const currentDate = new Date();
			const currentYear = currentDate.getFullYear();
			const currentMonth = currentDate.getMonth() + 1;
			const monthPrefix = `${currentYear}-${currentMonth
				.toString()
				.padStart(2, "0")}`;

			const monthlyStats = Object.entries(pluginData.dailyStats)
				.filter(([date]) => date.startsWith(monthPrefix))
				.sort(([a], [b]) => a.localeCompare(b));

			if (monthlyStats.length > 0) {
				const statsContainer = container.createDiv(
					"count-novels-text-stats"
				);
				statsContainer.createEl("h3", { text: "今月の執筆記録" });

				monthlyStats.forEach(([date, count]) => {
					const day = date.split("-")[2];
					const statItem = statsContainer.createDiv(
						"count-novels-stat-item"
					);
					statItem.createEl("span", { text: `${day}日: ` });
					statItem.createEl("span", {
						text: `${count.toLocaleString()}文字`,
						cls: count >= 0 ? "positive" : "negative",
					});
				});
			}
		}
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
		const summarySection = this.containerEl.querySelector(
			".count-novels-summary"
		);
		if (summarySection) {
			// 既存のサマリーコンテンツをクリア
			const summaryContent = summarySection.querySelector(
				".count-novels-summary-content"
			);
			if (summaryContent) {
				summaryContent.remove();
			}

			// サマリーを再描画
			this.renderSummary(summarySection as HTMLElement);
		}
	}

	/**
	 * グラフを更新する（効率的な更新用）
	 * データ更新時にグラフを再描画する機能を実装
	 */
	public refreshChart(): void {
		const chartSection = this.containerEl.querySelector(
			".count-novels-chart-content"
		);
		if (chartSection && this.chartInstance) {
			// 新しいデータを生成
			const newChartData = this.generateChartData();

			// チャートデータを更新
			this.chartInstance.data = newChartData;
			this.chartInstance.update();
		} else if (chartSection) {
			// チャートが存在しない場合は再作成
			this.renderChart(chartSection as HTMLElement);
		}
	}

	/**
	 * サマリーとグラフの両方を更新する（統合更新メソッド）
	 */
	public refreshStats(): void {
		this.refreshSummary();
		this.refreshChart();
	}
}
