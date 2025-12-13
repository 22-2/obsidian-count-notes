import { getDB } from "./db";
import type { DailyStats, HourlyStats } from "../schemas";

const LAST_TOTAL_CHARACTER_COUNT_KEY_PREFIX = "lastTotalCharacterCount";

export class StatsStorage {
	/**
	 * Gets all stored file character counts for a tag.
	 * @returns A promise that resolves to a map of file path -> last known character count.
	 */
	async getFileCharacterCounts(tag: string): Promise<Map<string, number>> {
		const db = await getDB();
		const range = IDBKeyRange.bound([tag, ""], [tag, "\uffff"]);
		const items = await db.getAll("fileStats", range);
		const map = new Map<string, number>();
		for (const item of items) {
			map.set(item.path, item.count);
		}
		return map;
	}

	/**
	 * Saves last known character count for a file under a tag.
	 */
	async saveFileCharacterCount(tag: string, path: string, count: number): Promise<void> {
		const db = await getDB();
		await db.put("fileStats", { tag, path, count });
	}

	/**
	 * Deletes stored character count for a file under a tag.
	 */
	async deleteFileCharacterCount(tag: string, path: string): Promise<void> {
		const db = await getDB();
		await db.delete("fileStats", [tag, path]);
	}

	/**
	 * Gets all daily stats for a specific tag.
	 * For performance reasons, prefer `getDailyStatsByDateRange` when possible.
	 * @returns A promise that resolves to the daily stats.
	 */
	async getDailyStats(tag: string): Promise<DailyStats> {
		const db = await getDB();
		const range = IDBKeyRange.bound([tag, ""], [tag, "\uffff"]);
		const statsArray = await db.getAll("dailyStats", range);
		const stats: DailyStats = {};
		for (const item of statsArray) {
			stats[item.date] = item.count;
		}
		return stats;
	}

	/**
	 * Gets daily stats for a specific date range and tag.
	 * @param startDate - The start date in YYYY-MM-DD format.
	 * @param endDate - The end date in YYYY-MM-DD format.
	 * @param tag - The tag to filter by.
	 * @returns A promise that resolves to the daily stats for the given range.
	 */
	async getDailyStatsByDateRange(
		startDate: string, // YYYY-MM-DD
		endDate: string, // YYYY-MM-DD
		tag: string
	): Promise<DailyStats> {
		const db = await getDB();
		const range = IDBKeyRange.bound([tag, startDate], [tag, endDate]);
		const statsArray = await db.getAll("dailyStats", range);
		const stats: DailyStats = {};
		for (const item of statsArray) {
			stats[item.date] = item.count;
		}
		return stats;
	}

	/**
	 * Gets all hourly stats for a specific tag.
	 * For performance reasons, prefer `getHourlyStatsByDateRange` when possible.
	 * @returns A promise that resolves to the hourly stats.
	 */
	async getHourlyStats(tag: string): Promise<HourlyStats> {
		const db = await getDB();
		const range = IDBKeyRange.bound([tag, ""], [tag, "\uffff"]);
		const statsArray = await db.getAll("hourlyStats", range);
		const stats: HourlyStats = {};
		for (const item of statsArray) {
			stats[item.datetime] = item.count;
		}
		return stats;
	}

	/**
	 * Gets hourly stats for a specific date range and tag.
	 * @param startDate - The start date in YYYY-MM-DD format.
	 * @param endDate - The end date in YYYY-MM-DD format.
	 * @param tag - The tag to filter by.
	 * @returns A promise that resolves to the hourly stats for the given range.
	 */
	async getHourlyStatsByDateRange(
		startDate: string, // YYYY-MM-DD
		endDate: string, // YYYY-MM-DD
		tag: string,
		startHour?: number, // Optional start hour for testing
		endHour?: number // Optional end hour for testing
	): Promise<HourlyStats> {
		const formattedStartHour =
			startHour !== undefined ? String(startHour).padStart(2, "0") : "00";
		const formattedEndHour =
			endHour !== undefined ? String(endHour).padStart(2, "0") : "23";

		const startDatetime = `${startDate}-${formattedStartHour}`;
		const endDatetime = `${endDate}-${formattedEndHour}`;

		const db = await getDB();
		const range = IDBKeyRange.bound([tag, startDatetime], [tag, endDatetime]);
		const statsArray = await db.getAll("hourlyStats", range);

		const stats: HourlyStats = {};
		for (const item of statsArray) {
			stats[item.datetime] = item.count;
		}
		return stats;
	}

	/**
	 * Gets the last total character count for a tag.
	 * @returns A promise that resolves to the last total character count, or null if not set.
	 */
	async getLastTotalCharacterCount(tag: string): Promise<number | null> {
		const db = await getDB();
		const key = `${LAST_TOTAL_CHARACTER_COUNT_KEY_PREFIX}:${tag}`;
		const result = await db.get("misc", key);
		return result ? (result.value as number) : null;
	}

	/**
	 * Saves the last total character count for a tag.
	 * @param count - The last total character count.
	 * @param tag - The tag.
	 */
	async saveLastTotalCharacterCount(count: number, tag: string): Promise<void> {
		const db = await getDB();
		const key = `${LAST_TOTAL_CHARACTER_COUNT_KEY_PREFIX}:${tag}`;
		await db.put("misc", {
			key: key,
			value: count,
		});
	}

	/**
	 * Updates the daily stats for a given date and tag.
	 * @param date - The date in YYYY-MM-DD format.
	 * @param characterDiff - The character difference to add.
	 * @param tag - The tag.
	 */
	async updateDailyStats(
		date: string,
		characterDiff: number,
		tag: string
	): Promise<void> {
		const db = await getDB();
		const tx = db.transaction("dailyStats", "readwrite");
		const store = tx.objectStore("dailyStats");
		const existing = await store.get([tag, date]);
		const newCount = (existing?.count || 0) + characterDiff;
		await store.put({ date, tag, count: newCount });
		await tx.done;
	}

	/**
	 * Updates the hourly stats for a given date and tag.
	 * @param date - The date in YYYY-MM-DD format.
	 * @param characterDiff - The character difference to add.
	 * @param tag - The tag.
	 */
	async updateHourlyStats(
		date: string, // YYYY-MM-DD
		characterDiff: number,
		tag: string,
		hour?: number // Optional hour for testing
	): Promise<void> {
		const hourToUse = hour !== undefined ? hour : new Date().getHours();
		const timeSlotKey = `${date}-${String(hourToUse).padStart(2, "0")}`;

		const db = await getDB();
		const tx = db.transaction("hourlyStats", "readwrite");
		const store = tx.objectStore("hourlyStats");
		const existing = await store.get([tag, timeSlotKey]);
		const newCount = (existing?.count || 0) + characterDiff;
		await store.put({ datetime: timeSlotKey, tag, count: newCount });
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
	 * Saves daily stats for a specific date and tag (for testing).
	 * @param date - The date in YYYY-MM-DD format.
	 * @param count - The character count.
	 * @param tag - The tag.
	 */
	async saveDailyStats(
		date: string,
		count: number,
		tag: string
	): Promise<void> {
		const db = await getDB();
		await db.put("dailyStats", { date, tag, count });
	}
}
