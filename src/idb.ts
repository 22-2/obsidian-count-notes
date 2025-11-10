import { get, set } from "idb-keyval";
import { PluginStatsData } from "./schemas";

export class Idb {
	async loadData(): Promise<PluginStatsData | null> {
		const data = await get("count-novels-stats-data");
		return data ?? null;
	}

	async saveData(data: PluginStatsData): Promise<void> {
		await set("count-novels-stats-data", data);
	}
}
