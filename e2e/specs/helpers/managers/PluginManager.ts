// ===================================================================
// plugin-manager.mts - プラグイン管理
// ===================================================================

import { expect } from "@playwright/test";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	writeFileSync,
} from "fs";
import log from "loglevel";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import type { TestPlugin } from "./VaultManager";

const logger = log.getLogger("PluginManager");

export class PluginManager {
	async installPlugins(
		vaultPath: string,
		pluginPaths: TestPlugin[]
	): Promise<void> {
		const obsidianDir = path.join(vaultPath, ".obsidian");
		const pluginsDir = path.join(obsidianDir, "plugins");
		logger.debug("obsidianDir", obsidianDir);
		logger.debug("pluginPaths", pluginPaths);

		// .obsidian ディレクトリを作成
		if (!existsSync(obsidianDir)) {
			mkdirSync(obsidianDir, { recursive: true });
		}

		if (!existsSync(pluginsDir)) {
			mkdirSync(pluginsDir, { recursive: true });
		}

		const installedIds: string[] = [];

		for (const { path: pluginPath, pluginId } of pluginPaths) {
			if (!existsSync(pluginPath)) {
				console.warn(`Plugin path not found: ${pluginPath}`);
				continue;
			}

			if (!existsSync(path.join(pluginPath, "manifest.json"))) {
				console.warn(`manifest.json not found in: ${pluginPath}`);
				continue;
			}

			const destDir = path.join(pluginsDir, pluginId);

			if (!existsSync(destDir)) {
				mkdirSync(destDir, { recursive: true });
			}

			// プラグインファイルをコピー
			for (const file of readdirSync(pluginPath)) {
				const srcFile = path.join(pluginPath, file);
				const destFile = path.join(destDir, file);
				copyFileSync(srcFile, destFile);
				logger.debug(`Copied: ${file} to ${destDir}`);
			}

			installedIds.push(pluginId);
			logger.debug(`Installed plugin: ${pluginId}`);
		}

		// community-plugins.json を書き込み
		const pluginsJsonPath = path.join(
			obsidianDir,
			"community-plugins.json"
		);
		writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
		logger.debug(`Installed plugins: ${installedIds.join(", ")}`);
	}

	public async enablePlugins(
		app: ElectronApplication,
		page: Page,
		pluginIds: string[]
	): Promise<void> {
		const pluginManager = new PluginManager();

		// Restricted Mode を無効化
		await pluginManager.disableRestrictedMode(page, app);

		// const pluginIds = plugins.map((p) => {
		// 	const manifestPath = path.join(p, "manifest.json");
		// 	if (!existsSync(manifestPath)) {
		// 		throw new Error(`manifest.json not found in ${p}`);
		// 	}
		// 	const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		// 	return manifest.id;
		// });

		const enabledIds = await page.evaluate(async (ids) => {
			const app = (window as any).app;
			const enabled: string[] = [];

			for (const id of ids) {
				await app.plugins.enablePluginAndSave(id);
				enabled.push(id);
			}

			return enabled;
		}, pluginIds);

		logger.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
	}

	async disableRestrictedMode(
		page: Page,
		app: ElectronApplication
	): Promise<void> {
		if (await this.checkIsCommunityPluginEnabled(page)) {
			logger.debug("Community plugins are already enabled.");
			return;
		}

		logger.debug("Attempting to enable community plugins...");

		// 設定タブを開く
		await page.evaluate(() => {
			(window as any).app.setting.open();
			(window as any).app.setting.openTabById("community-plugins");
		});

		// ヘルパー関数: 現在表示されているボタンのテキストを取得
		const getButtonText = () =>
			page.evaluate(() => {
				const button = (
					window as any
				).app.setting.activeTab?.setting?.contentEl?.querySelector(
					"button.mod-cta" // より具体的なセレクタに変更
				) as HTMLElement | null;
				return button?.textContent?.trim() || null;
			});

		// ヘルパー関数: ボタンをクリック
		const clickButton = () =>
			page.evaluate(() => {
				const button = (
					window as any
				).app.setting.activeTab?.setting?.contentEl?.querySelector(
					"button.mod-cta"
				) as HTMLElement | null;
				button?.click();
			});

		let buttonText = await getButtonText();
		logger.debug(`Initial button text in settings: "${buttonText}"`);

		// [ステップ1] "Turn on and reload" ボタンがあればクリック
		if (buttonText === "Turn on and reload") {
			logger.debug("Clicking 'Turn on and reload'...");
			await clickButton();
			// UIが更新されるのを待機
			await page.waitForTimeout(1000);
			// ボタンのテキストを再取得
			buttonText = await getButtonText();
			logger.debug(`Button text after first click: "${buttonText}"`);
		}

		// [ステップ2] "Turn on community plugins" ボタンがあればクリック
		if (buttonText === "Turn on community plugins") {
			logger.debug("Clicking 'Turn on community plugins'...");
			await clickButton();
			await page.waitForTimeout(1000);
		}

		// 設定を閉じる
		await page.keyboard.press("Escape");
		logger.debug("Community plugins should now be enabled.");

		// 最終確認
		expect(
			await this.checkIsCommunityPluginEnabled(page),
			"Failed to enable community plugins."
		).toBe(true);
	}

	private async clickSettingsButton(page: Page): Promise<string | null> {
		return page.evaluate(() => {
			(window as any).app.setting.open();
			(window as any).app.setting.openTabById("community-plugins");
			const app = (window as any).app;
			const button =
				app.setting.activeTab?.setting?.contentEl?.querySelector(
					"button"
				) as HTMLElement | null;
			if (button) {
				const text = button.textContent as string;
				button.click();
				return text;
			}
			return null;
		});
	}

	// async enablePlugins(page: Page, pluginIds: string[]): Promise<void> {
	// 	const enabledIds = await page.evaluate(async (ids) => {
	// 		const app = (window as any).app;
	// 		const enabled: string[] = [];

	// 		for (const id of ids) {
	// 			await app.plugins.enablePluginAndSave(id);
	// 			enabled.push(id);
	// 		}

	// 		return enabled;
	// 	}, pluginIds);

	// 	logger.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
	// }

	async checkIsCommunityPluginEnabled(page: Page): Promise<boolean> {
		const isEnabled = await page.evaluate(() => app.plugins.isEnabled());
		logger.debug(
			`${isEnabled ? "✅️" : "❌️"} checkIsCommunityPluginEnabled`,
			page.url()
		);
		return isEnabled;
	}
}
