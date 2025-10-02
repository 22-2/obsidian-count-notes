// ===================================================================
// setup.mts - メインのセットアップクラス
// ===================================================================

import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { ElectronApplication } from "playwright";
import { _electron as electron } from "playwright/test";
import { LAUNCH_OPTIONS } from "../constants";
import { PageManager } from "../helpers/managers/PageManager";
import {
	VaultManager,
	type VaultOptions,
} from "../helpers/managers/VaultManager";
import type { TestContext, VaultPageTextContext } from "../helpers/types";
import { getPluginHandleMap } from "../helpers/utils";

const logger = log.getLogger("ObsidianTestSetup");

export class ObsidianTestSetup {
	private electronApp?: ElectronApplication;
	// private currentPage?: Page;
	private vaultManager?: VaultManager;
	private pageManager?: PageManager;
	private tempUserDataDir?: string;

	async launch(): Promise<void> {
		this.tempUserDataDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "obsidian-e2e-")
		);
		logger.debug(`Using temporary user data dir: ${this.tempUserDataDir}`);
		const launchOptions = {
			...LAUNCH_OPTIONS,
			// Electronアプリの起動引数に --user-data-dir を追加
			args: [
				...LAUNCH_OPTIONS.args,
				`--user-data-dir=${this.tempUserDataDir}`,
			],
		};
		this.electronApp = await electron.launch(launchOptions);
		let page = await this.electronApp.waitForEvent("window");
		this.pageManager = new PageManager(this.electronApp);
		logger.debug("enable obsidian debug mode");
		await this.pageManager.waitForPage(page);
		logger.debug("starter ready");
		await VaultManager.clearData(this.electronApp);
		await page.reload({ waitUntil: "domcontentloaded" });

		const currentPage = await this.pageManager.ensureSingleWindow();

		await this.pageManager.waitForStarterReady(currentPage);
		logger.debug("init start page");

		this.vaultManager = new VaultManager(
			this.electronApp,
			this.pageManager
		);
	}

	async openVault(options: VaultOptions = {}): Promise<VaultPageTextContext> {
		if (!this.electronApp || !this.vaultManager) {
			throw new Error("Setup not initialized. Call launch() first.");
		}

		let page = await this.vaultManager.openVault(options);

		const vaultName = await page.evaluate(() => app?.vault?.getName());

		const pluginHandleMap = await getPluginHandleMap(
			page,
			options.plugins || []
		);

		// const pluginHandleMap = await page.evaluateHandle((plugins) => {
		// 	const map = new Map<string, Plugin>();
		// 	plugins.forEach((p) => {
		// 		map.set(p.pluginId, app?.plugins.getPlugin(p.pluginId)!);
		// 	});
		// 	return map;
		// }, options.plugins || []);

		// page = await this.pageManager!.executeActionAndWaitForNewWindow(
		// 	async () => {
		// 		const page = await this.pageManager!.ensureSingleWindow();
		// 		await page?.evaluate(() => app.debugMode(true));
		// 	}
		// );

		return {
			electronApp: this.electronApp,
			window: page,
			pluginHandleMap,
			vaultName,
		};
	}

	async openSandbox(
		options: VaultOptions = {}
	): Promise<VaultPageTextContext> {
		return this.openVault({
			...options,
			useSandbox: true,
		});
	}

	async openStarter(): Promise<TestContext> {
		if (!this.electronApp || !this.vaultManager) {
			throw new Error("Setup not initialized. Call launch() first.");
		}

		const page = await this.vaultManager.openStarter();

		return {
			electronApp: this.electronApp,
			window: page,
		};
	}

	async cleanup(): Promise<void> {
		if (this.electronApp) {
			await Promise.all(
				this.electronApp.windows().map((win) => win.close())
			);
			await this.electronApp.close();
		}
		if (this.tempUserDataDir) {
			logger.debug(
				`Removing temp user data dir: ${this.tempUserDataDir}`
			);
			// recursive: true (再帰的削除), force: true (ロックされていても強制削除)
			await fs.rm(this.tempUserDataDir, { recursive: true, force: true });
		}
		logger.debug("[ObsidianTestSetup] cleaned All");
	}

	getCurrentPage() {
		return this.electronApp?.windows()[0];
	}
}
