import { get, set } from "idb-keyval";
import type { DailyStats, HourlyStats } from "../schemas";

const DAILY_STATS_KEY = "dailyStats";
const HOURLY_STATS_KEY = "hourlyStats";
const LAST_TOTAL_CHARACTER_COUNT_KEY = "lastTotalCharacterCount";

export class StatsStorage {
	async getDailyStats(): Promise<DailyStats> {
		return (await get(DAILY_STATS_KEY)) || {};
	}

	async saveDailyStats(stats: DailyStats): Promise<void> {
		await set(DAILY_STATS_KEY, stats);
	}

	async getHourlyStats(): Promise<HourlyStats> {
		return (await get(HOURLY_STATS_KEY)) || {};
	}

	async saveHourlyStats(stats: HourlyStats): Promise<void> {
		await set(HOURLY_STATS_KEY, stats);
	}

	async getLastTotalCharacterCount(): Promise<number> {
		return (await get(LAST_TOTAL_CHARACTER_COUNT_KEY)) || 0;
	}

	async saveLastTotalCharacterCount(count: number): Promise<void> {
		await set(LAST_TOTAL_CHARACTER_COUNT_KEY, count);
	}

	async updateDailyStats(date: string, characterDiff: number): Promise<void> {
		const stats = await this.getDailyStats();
		const existingValue = stats[date] || 0;
		stats[date] = existingValue + characterDiff;
		await this.saveDailyStats(stats);
	}

	async updateHourlyStats(date: string, characterDiff: number): Promise<void> {
		const stats = await this.getHourlyStats();
		const currentHour = new Date().getHours();
		const timeSlotKey = `${date}-${currentHour}`;
		const existingValue = stats[timeSlotKey] || 0;
		stats[timeSlotKey] = existingValue + characterDiff;
		await this.saveHourlyStats(stats);
	}
}
