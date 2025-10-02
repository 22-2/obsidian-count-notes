// E:\Desktop\coding\pub\obsidian-sandbox-note\src\e2e\obsidian-setup\vault-manager.mts
// ===================================================================
// vault-manager.mts - Vault操作の管理
// ===================================================================

import chalk from "chalk";
import type { WebContents } from "electron";
import { existsSync, rmSync } from "fs";
import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { SANDBOX_VAULT_NAME } from "../../constants";
import { IPCBridge } from "../IPCBridge";
import { PageManager } from "./PageManager";
import { PluginManager } from "./PluginManager";

export interface TestPlugin {
	path: string;
	pluginId: string;
}

export interface VaultOptions {
	name?: string;
	vaultPath?: string;
	forceNewVault?: boolean;
	useSandbox?: boolean;
	plugins?: TestPlugin[];
}

const logger = log.getLogger("VaultManager");

export class VaultManager {
	private ipc: IPCBridge;
	private pluginManager: PluginManager;

	constructor(
		private app: ElectronApplication,
		private pageManager: PageManager
	) {
		this.ipc = new IPCBridge(this.pageManager);
		this.pluginManager = new PluginManager();
	}

	async openVault(options: VaultOptions = {}): Promise<Page> {
		logger.debug("open vault", options);

		let vaultPath: string;
		let newPage: Page;
		let shouldReload = false;

		// --- Step 1: Open Vault (Sandbox or Normal) ---
		if (options.useSandbox) {
			logger.debug(chalk.green("Opening sandbox vault..."));
			newPage = await this.pageManager.executeActionAndWaitForNewWindow(
				() => this.ipc.openSandbox(),
				this.pageManager.waitForVaultReady
			);
			vaultPath = await this.ipc.getSandboxPath();
			logger.debug(chalk.green("Sandbox vault opened at:", vaultPath));
		} else {
			logger.debug("Opening normal vault...");
			if (options.vaultPath) {
				vaultPath = options.vaultPath;
			} else if (options.name) {
				vaultPath = await this.getVaultPath(options.name);
			} else {
				logger.debug(
					"options.name and options.path not specified, create temp dir"
				);
				vaultPath = await fs.mkdtemp(
					path.join(os.tmpdir(), "obsidian-e2e-")
				);
				logger.debug("temp dir created:", vaultPath);
			}

			if (options.forceNewVault && existsSync(vaultPath)) {
				rmSync(vaultPath, { recursive: true });
			}

			newPage = await this.pageManager.executeActionAndWaitForNewWindow(
				async () => {
					const result = await this.ipc.openVault(
						vaultPath,
						options.forceNewVault
					);
					if (result !== true) {
						throw new Error(`Failed to open vault: ${result}`);
					}
				},
				this.pageManager.waitForVaultReady
			);
			logger.debug("Normal vault opened:", vaultPath);
		}

		// --- Step 2: Install Plugins (if specified) ---
		if (options.plugins && options.plugins.length > 0) {
			logger.debug("Installing plugins...");
			await this.pluginManager.installPlugins(vaultPath, options.plugins);
			shouldReload = true; // Reload is needed after installing
			logger.debug("Plugins installed.");
		}

		// --- Step 3: Enable Plugins (if specified) ---
		if (options.plugins) {
			logger.debug("Enabling plugins...");
			await this.pluginManager.enablePlugins(
				this.app,
				newPage,
				options.plugins.map((p) => p.pluginId)
			);
			shouldReload = true; // Reload is needed after enabling
			logger.debug("Plugins enabled.");
		}

		// --- Step 4: Reload Vault if plugins were modified ---
		if (shouldReload) {
			logger.debug(
				chalk.blue("Reloading vault to apply plugin changes...")
			);
			await newPage.reload();
			await this.pageManager.waitForVaultReady(newPage);
			logger.debug(chalk.blue("Vault reloaded."));
		}

		return newPage;
	}

	static async clearData(
		electronApp: ElectronApplication,
		page?: Page
	): Promise<void> {
		const userDataDir = await electronApp.evaluate(({ app }) =>
			app.getPath("userData")
		);
		[
			path.join(userDataDir, "obsidian.json"),
			path.join(userDataDir, SANDBOX_VAULT_NAME),
		].forEach((path) => {
			logger.debug("delete", path);
			rmSync(path, { force: true, recursive: true });
		});

		const [win] = [page ?? electronApp.windows()[0]];
		if (win) {
			logger.log(chalk.magenta("clearing..."));
			const success = await win.evaluate(async () => {
				const webContents =
					// @ts-expect-error
					window.electron.remote.BrowserWindow.getFocusedWindow()
						?.webContents as WebContents;
				if (!webContents) {
					return false;
				}
				webContents.session.flushStorageData();
				await webContents.session.clearStorageData({
					storages: ["indexdb", "localstorage", "websql"],
				});
				await webContents.session.clearCache();
				return true;
			});
			if (success) {
				logger.log(chalk.magenta("localStorage cleared."));
			} else {
				logger.log(chalk.red("failed to clear localStorage"));
			}
		} else {
			logger.log(chalk.red("window not found"));
		}
	}

	async openStarter(): Promise<Page> {
		const newPage = await this.pageManager.executeActionAndWaitForNewWindow(
			async () => {
				await this.ipc.openStarter();
			},
			this.pageManager.waitForStarterReady
		);

		await this.pageManager.waitForStarterReady(newPage);
		return newPage;
	}

	private async getUserDataPath() {
		const page = await this.pageManager.ensureSingleWindow();
		const userDataDir = await page.evaluate(() => {
			const app = (window as any).app;
			if (app?.vault?.adapter?.basePath) {
				const currentPath = app.vault.adapter.basePath;
				return currentPath;
			}
			throw new Error("failed to get user data path");
		});
		return path.dirname(userDataDir);
	}

	private async getVaultPath(name: string): Promise<string> {
		const userDataDir = await this.getUserDataPath();
		logger.debug("userDataDir", userDataDir);

		if (userDataDir) {
			return path.join(userDataDir, name);
		}

		return path.join(
			process.env.USERPROFILE || process.env.HOME || "",
			"ObsidianVaults",
			name
		);
	}
}
