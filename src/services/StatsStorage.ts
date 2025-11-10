import { createStore, get, set } from "idb-keyval";
import type { DailyStats, HourlyStats } from "../schemas";

// Use a dedicated DB/store to avoid colliding with other plugins/apps.
const IDB_DB_NAME = "obsidian-count-novels-db";
const IDB_STORE_NAME = "stats";
const store = createStore(IDB_DB_NAME, IDB_STORE_NAME);

const DAILY_STATS_KEY = "dailyStats";
const HOURLY_STATS_KEY = "hourlyStats";
const LAST_TOTAL_CHARACTER_COUNT_KEY = "lastTotalCharacterCount";

export class StatsStorage {
	async getDailyStats(): Promise<DailyStats> {
		return (await get(DAILY_STATS_KEY, store)) || {};
	}

	async saveDailyStats(stats: DailyStats): Promise<void> {
		await set(DAILY_STATS_KEY, stats, store);
	}

	async getHourlyStats(): Promise<HourlyStats> {
		return (await get(HOURLY_STATS_KEY, store)) || {};
	}

	async saveHourlyStats(stats: HourlyStats): Promise<void> {
		await set(HOURLY_STATS_KEY, stats, store);
	}

	async getLastTotalCharacterCount(): Promise<number> {
		return (await get(LAST_TOTAL_CHARACTER_COUNT_KEY, store)) || 0;
	}

	async saveLastTotalCharacterCount(count: number): Promise<void> {
		await set(LAST_TOTAL_CHARACTER_COUNT_KEY, count, store);
	}

	async updateDailyStats(date: string, characterDiff: number): Promise<void> {
		const stats = await this.getDailyStats();
		const existingValue = stats[date] || 0;
		stats[date] = existingValue + characterDiff;
		await this.saveDailyStats(stats);
	}

	async updateHourlyStats(
		date: string,
		characterDiff: number
	): Promise<void> {
		const stats = await this.getHourlyStats();
		const currentHour = new Date().getHours();
		const timeSlotKey = `${date}-${currentHour}`;
		const existingValue = stats[timeSlotKey] || 0;
		stats[timeSlotKey] = existingValue + characterDiff;
		await this.saveHourlyStats(stats);
	}
}
