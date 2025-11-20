import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface DailyStat {
	date: string; // YYYY-MM-DD
	count: number;
}

export interface HourlyStat {
	datetime: string; // YYYY-MM-DD-HH
	count: number;
}

export interface Misc {
	key: string;
	value: any;
}

export interface CountNovelsDBSchema extends DBSchema {
	dailyStats: {
		key: string;
		value: DailyStat;
	};
	hourlyStats: {
		key: string;
		value: HourlyStat;
	};
	misc: {
		key: string;
		value: Misc;
	};
}

const DB_NAME = "obsidian-count-novels-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CountNovelsDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<CountNovelsDBSchema>> {
	if (!dbPromise) {
		dbPromise = openDB<CountNovelsDBSchema>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("dailyStats")) {
					db.createObjectStore("dailyStats", { keyPath: "date" });
				}
				if (!db.objectStoreNames.contains("hourlyStats")) {
					db.createObjectStore("hourlyStats", { keyPath: "datetime" });
				}
				if (!db.objectStoreNames.contains("misc")) {
					db.createObjectStore("misc", { keyPath: "key" });
				}
			},
		});
	}
	return dbPromise;
}

export async function closeDB() {
	if (dbPromise) {
		const db = await dbPromise;
		db.close();
		dbPromise = null;
	}
}
