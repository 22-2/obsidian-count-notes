// ===================================================================
// 1. Core Types (types.mts)
// ===================================================================

import type { Plugin } from "obsidian";
import type { ElectronApplication, JSHandle, Page } from "playwright";

export interface VaultConfig {
	name: string;
	path?: string;
	plugins?: string[];
	enablePlugins?: boolean;
}

export interface TestContext {
	electronApp: ElectronApplication;
	window: Page;
	vaultName?: string;
}

export interface VaultPageTextContext extends TestContext {
	pluginHandleMap: JSHandle<Map<string, Plugin>>;
}
