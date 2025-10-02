import type { Plugin } from "obsidian";
import type { JSHandle, Page } from "playwright";

export function getPluginHandleMap(
	page: Page,
	plugins: { pluginId: string; path: string }[]
): Promise<JSHandle<Map<string, Plugin>>> {
	return page.evaluateHandle((plugins) => {
		const map = new Map<string, Plugin>();
		plugins.forEach((p) => {
			// @ts-expect-error
			map.set(p.pluginId, app?.plugins.getPlugin(p.pluginId)!);
		});
		return map;
	}, plugins);
}
