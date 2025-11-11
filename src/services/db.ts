import Dexie, { type Table } from "dexie";

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

class CountNovelsDB extends Dexie {
	dailyStats!: Table<DailyStat>;
	hourlyStats!: Table<HourlyStat>;
	misc!: Table<Misc>;

	constructor() {
		super("obsidian-count-novels-db");
		this.version(1).stores({
			dailyStats: "&date", // 'date' is the primary key
			hourlyStats: "&datetime", // 'datetime' is the primary key
			misc: "&key", // 'key' is the primary key
		});
	}
}

export const db = new CountNovelsDB();
