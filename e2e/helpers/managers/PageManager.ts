// ===================================================================
// page-manager.mts - ページ遷移の管理
// ===================================================================

import chalk from "chalk";
import log from "loglevel";
import type { ElectronApplication, Page } from "playwright";
import invariant from "tiny-invariant";
const logger = log.getLogger("PageManager");

export class PageManager {
	constructor(private app: ElectronApplication) {}

	async ensureSingleWindow() {
		logger.debug("ensureSingleWindow");
		const windows = this.app.windows();
		logger.debug(`${windows.length} opend`);
		if (windows.length === 0) {
			const page = await this.app.firstWindow();
			await page.waitForLoadState("domcontentloaded");
			logger.debug("first window");
			return page;
		}

		// const page = windows.find(
		// 	async (win) => await win.evaluate(() => document.body.isShown())
		// );
		logger.debug(windows.map((el) => el.url()));
		const page = windows.at(-1)!;
		if (page?.url().includes("starter")) {
			await this.waitForStarterReady(page);
		} else {
			await this.waitForVaultReady(page);
		}
		invariant(page, "failed to get page");
		await this.closeAllExcept(page);
		logger.debug(`closed all except ${await page.title()}`);
		return page;
	}

	async executeActionAndWaitForNewWindow(
		action: () => Promise<void>,
		wait: (page: Page) => Promise<void> = this.waitForPage
	): Promise<Page> {
		const currentWindows = this.app.windows();

		// 1. 新しいウィンドウが開くのを待つ準備をする
		const windowPromise = this.app.waitForEvent("window", {
			timeout: 10000,
		});

		// 2. 新しいウィンドウを開くアクションを実行する
		await action();

		// 3. 実際に新しいウィンドウが開くまで待つ
		const newPage = await windowPromise;

		// 4. 新しいページが完全に準備できるのを待つ (Vaultの読み込み完了など)
		await wait(newPage);

		// 5. 元々開いていた古いウィンドウを閉じる
		for (const window of currentWindows) {
			if (window !== newPage && !window.isClosed()) {
				logger.debug(
					chalk.yellow(`Closing old window: ${await window.title()}`)
				);
				await window.close();
			}
		}

		logger.debug(chalk.green("New window is ready:", newPage.url()));
		return newPage;
	}

	private async closeAllExcept(keepPage: Page): Promise<void> {
		for (const window of this.app.windows()) {
			if (window !== keepPage && !window.isClosed()) {
				logger.debug(chalk.red(`close ${window.url()}`));
				await window.close();
			}
		}
	}

	/**
	 * @deprecated use waitForPage
	 */
	async waitForVaultReady(page: Page): Promise<void> {
		await page.waitForLoadState("domcontentloaded");

		await page.waitForFunction(
			async () => {
				if ((window as any).app?.workspace?.onLayoutReady) {
					return await new Promise<void>((resolve) => {
						return app.workspace.onLayoutReady(() =>
							resolve(undefined)
						);
					});
				}
			},
			{ timeout: 10000 }
		);

		// 追加の安定化待機
		await page.waitForTimeout(500);
	}

	/**
	 * @deprecated use waitForPage
	 */
	async waitForStarterReady(page: Page): Promise<void> {
		await page.waitForSelector(".mod-change-language", {
			state: "visible",
		});
	}

	waitForPage(page: Page): Promise<void> {
		if (this.isStarterPage(page)) {
			return this.waitForStarterReady(page);
		} else {
			return this.waitForVaultReady(page);
		}
	}

	isStarterPage(page: Page): boolean {
		return page.url().includes("starter");
	}
}
