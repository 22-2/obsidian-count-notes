import { db } from "./db";
import type { DailyStats, HourlyStats } from "../schemas";

const LAST_TOTAL_CHARACTER_COUNT_KEY = "lastTotalCharacterCount";

export class StatsStorage {
	/**
	 * Gets all daily stats.
	 * For performance reasons, prefer `getDailyStatsByDateRange` when possible.
	 * @returns A promise that resolves to the daily stats.
	 */
	async getDailyStats(): Promise<DailyStats> {
		const statsArray = await db.dailyStats.toArray();
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
		const statsArray = await db.dailyStats
			.where("date")
			.between(startDate, endDate, true, true)
			.toArray();
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
		const statsArray = await db.hourlyStats.toArray();
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
		const statsArray = await db.hourlyStats
			.where("datetime")
			.between(startDatetime, endDatetime, true, true)
			.toArray();
		const stats: HourlyStats = {};
		for (const item of statsArray) {
			stats[item.datetime] = item.count;
		}
		return stats;
	}

	/**
	 * Gets the last total character count.
	 * @returns A promise that resolves to the last total character count.
	 */
	async getLastTotalCharacterCount(): Promise<number> {
		const result = await db.misc.get(LAST_TOTAL_CHARACTER_COUNT_KEY);
		return result ? (result.value as number) : 0;
	}

	/**
	 * Saves the last total character count.
	 * @param count - The last total character count.
	 */
	async saveLastTotalCharacterCount(count: number): Promise<void> {
		await db.misc.put({
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
		await db.transaction("rw", db.dailyStats, async () => {
			const existing = await db.dailyStats.get(date);
			const newCount = (existing?.count || 0) + characterDiff;
			await db.dailyStats.put({ date, count: newCount });
		});
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

		await db.transaction("rw", db.hourlyStats, async () => {
			const existing = await db.hourlyStats.get(timeSlotKey);
			const newCount = (existing?.count || 0) + characterDiff;
			await db.hourlyStats.put({ datetime: timeSlotKey, count: newCount });
		});
	}
}
