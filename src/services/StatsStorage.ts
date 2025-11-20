import { getDB } from "./db";
import type { DailyStats, HourlyStats } from "../schemas";

const LAST_TOTAL_CHARACTER_COUNT_KEY = "lastTotalCharacterCount";

export class StatsStorage {
	/**
	 * Gets all daily stats.
	 * For performance reasons, prefer `getDailyStatsByDateRange` when possible.
	 * @returns A promise that resolves to the daily stats.
	 */
	async getDailyStats(): Promise<DailyStats> {
		const db = await getDB();
		const statsArray = await db.getAll("dailyStats");
		const stats: DailyStats = {};
		for (const item of statsArray) {
			stats[item.date] = item.count;
		}
		return stats;
	}

	/**
	 * Gets daily stats for a specific date range.
	 * @param startDate - The start date in YYYY-MM-DD format.
	 * @param endDate - The end date in YYYY-MM-DD format.
	 * @returns A promise that resolves to the daily stats for the given range.
	 */
	async getDailyStatsByDateRange(
		startDate: string, // YYYY-MM-DD
		endDate: string // YYYY-MM-DD
	): Promise<DailyStats> {
		const db = await getDB();
		const range = IDBKeyRange.bound(startDate, endDate);
		const statsArray = await db.getAll("dailyStats", range);
		const stats: DailyStats = {};
		for (const item of statsArray) {
			stats[item.date] = item.count;
		}
		return stats;
	}

	/**
	 * Gets all hourly stats.
	 * For performance reasons, prefer `getHourlyStatsByDateRange` when possible.
	 * @returns A promise that resolves to the hourly stats.
	 */
	async getHourlyStats(): Promise<HourlyStats> {
		const db = await getDB();
		const statsArray = await db.getAll("hourlyStats");
		const stats: HourlyStats = {};
		for (const item of statsArray) {
			stats[item.datetime] = item.count;
		}
		return stats;
	}

	/**
	 * Gets hourly stats for a specific date range.
	 * @param startDate - The start date in YYYY-MM-DD format.
	 * @param endDate - The end date in YYYY-MM-DD format.
	 * @returns A promise that resolves to the hourly stats for the given range.
	 */
	async getHourlyStatsByDateRange(
		startDate: string, // YYYY-MM-DD
		endDate: string, // YYYY-MM-DD
		startHour?: number, // Optional start hour for testing
		endHour?: number // Optional end hour for testing
	): Promise<HourlyStats> {
		const formattedStartHour = startHour !== undefined ? String(startHour).padStart(2, '0') : '00';
		const formattedEndHour = endHour !== undefined ? String(endHour).padStart(2, '0') : '23';

		const startDatetime = `${startDate}-${formattedStartHour}`;
		const endDatetime = `${endDate}-${formattedEndHour}`;
		
		const db = await getDB();
		const range = IDBKeyRange.bound(startDatetime, endDatetime);
		const statsArray = await db.getAll("hourlyStats", range);
		
		const stats: HourlyStats = {};
		for (const item of statsArray) {
			stats[item.datetime] = item.count;
		}
		return stats;
	}

	/**
	 * Gets the last total character count.
	 * @returns A promise that resolves to the last total character count, or null if not set.
	 */
	async getLastTotalCharacterCount(): Promise<number | null> {
		const db = await getDB();
		const result = await db.get("misc", LAST_TOTAL_CHARACTER_COUNT_KEY);
		return result ? (result.value as number) : null;
	}

	/**
	 * Saves the last total character count.
	 * @param count - The last total character count.
	 */
	async saveLastTotalCharacterCount(count: number): Promise<void> {
		const db = await getDB();
		await db.put("misc", {
			key: LAST_TOTAL_CHARACTER_COUNT_KEY,
			value: count,
		});
	}

	/**
	 * Updates the daily stats for a given date.
	 * @param date - The date in YYYY-MM-DD format.
	 * @param characterDiff - The character difference to add.
	 */
	async updateDailyStats(date: string, characterDiff: number): Promise<void> {
		const db = await getDB();
		const tx = db.transaction("dailyStats", "readwrite");
		const store = tx.objectStore("dailyStats");
		const existing = await store.get(date);
		const newCount = (existing?.count || 0) + characterDiff;
		await store.put({ date, count: newCount });
		await tx.done;
	}

	/**
	 * Updates the hourly stats for a given date.
	 * @param date - The date in YYYY-MM-DD format.
	 * @param characterDiff - The character difference to add.
	 */
	async updateHourlyStats(
		date: string, // YYYY-MM-DD
		characterDiff: number,
		hour?: number // Optional hour for testing
	): Promise<void> {
		const hourToUse = hour !== undefined ? hour : new Date().getHours();
		const timeSlotKey = `${date}-${String(hourToUse).padStart(2, '0')}`;

		const db = await getDB();
		const tx = db.transaction("hourlyStats", "readwrite");
		const store = tx.objectStore("hourlyStats");
		const existing = await store.get(timeSlotKey);
		const newCount = (existing?.count || 0) + characterDiff;
		await store.put({ datetime: timeSlotKey, count: newCount });
		await tx.done;
	}

	/**
	 * Clears all daily stats (for testing).
	 */
	async clearDailyStats(): Promise<void> {
		const db = await getDB();
		await db.clear("dailyStats");
	}

	/**
	 * Saves daily stats for a specific date (for testing).
	 * @param date - The date in YYYY-MM-DD format.
	 * @param count - The character count.
	 */
	async saveDailyStats(date: string, count: number): Promise<void> {
		const db = await getDB();
		await db.put("dailyStats", { date, count });
	}
}
