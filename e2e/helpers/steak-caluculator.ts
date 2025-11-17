
// ============================================================================
// E:\Desktop\coding\my-projects-02\obsidian-count-notes\e2e\helpers\streak-calculator.ts
// ============================================================================
export class StreakCalculator {
	static async calculate(obsidian: any): Promise<number> {
		return obsidian.page.evaluate(
			async (pluginId: string) => {
				const plugin = app.plugins.getPlugin(pluginId) as any;
				if (!plugin) return 0;

				const dailyStats = await plugin.statsStorage.getDailyStats();
				if (!dailyStats || Object.keys(dailyStats).length === 0) {
					return 0;
				}

				const formatDateString = (date: Date) => {
					const year = date.getFullYear();
					const month = (date.getMonth() + 1).toString().padStart(2, "0");
					const day = date.getDate().toString().padStart(2, "0");
					return `${year}-${month}-${day}`;
				};

				const today = new Date();
				let streak = 0;
				let currentDate = new Date(today);

				const todayString = formatDateString(today);
				const todayStats = dailyStats[todayString];
				const hasTodayData = todayStats && todayStats > 0;

				if (!hasTodayData) {
					currentDate.setDate(currentDate.getDate() - 1);
				}

				while (true) {
					const dateString = formatDateString(currentDate);
					const dayStats = dailyStats[dateString];

					if (dayStats && dayStats > 0) {
						streak++;
						currentDate.setDate(currentDate.getDate() - 1);
					} else {
						break;
					}

					if (streak > 365) break;
				}

				return streak;
			},
			"obsidian-count-notes"
		);
	}
}
