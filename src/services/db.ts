import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface DailyStat {
	date: string; // YYYY-MM-DD
	tag: string;
	count: number;
}

export interface HourlyStat {
	datetime: string; // YYYY-MM-DD-HH
	tag: string;
	count: number;
}

export interface FileStat {
	path: string;
	tag: string;
	count: number;
}

export interface Misc {
	key: string;
	value: any;
}

export interface CountNovelsDBSchema extends DBSchema {
	dailyStats: {
		key: [string, string];
		value: DailyStat;
	};
	hourlyStats: {
		key: [string, string];
		value: HourlyStat;
	};
	fileStats: {
		key: [string, string];
		value: FileStat;
	};
	misc: {
		key: string;
		value: Misc;
	};
}

const DB_NAME = "obsidian-count-novels-db";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<CountNovelsDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<CountNovelsDBSchema>> {
	if (!dbPromise) {
		dbPromise = openDB<CountNovelsDBSchema>(DB_NAME, DB_VERSION, {
			upgrade(db, oldVersion, newVersion, transaction) {
				// dailyStats
				if (!db.objectStoreNames.contains("dailyStats")) {
					db.createObjectStore("dailyStats", { keyPath: ["tag", "date"] });
				} else if (oldVersion < 2) {
					db.deleteObjectStore("dailyStats");
					db.createObjectStore("dailyStats", { keyPath: ["tag", "date"] });
				}

				// hourlyStats
				if (!db.objectStoreNames.contains("hourlyStats")) {
					db.createObjectStore("hourlyStats", { keyPath: ["tag", "datetime"] });
				} else if (oldVersion < 2) {
					db.deleteObjectStore("hourlyStats");
					db.createObjectStore("hourlyStats", { keyPath: ["tag", "datetime"] });
				}

				// fileStats
				if (!db.objectStoreNames.contains("fileStats")) {
					db.createObjectStore("fileStats", { keyPath: ["tag", "path"] });
				}

				// misc
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
