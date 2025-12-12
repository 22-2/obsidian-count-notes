import log from "loglevel";
import { Notice } from "obsidian";
import {
	COLLECTION_INTERVAL,
	STATUS_BAR_UPDATE_INTERVAL,
	TICK_INTERVAL,
	VIEW_TYPE_COUNT_NOVEL,
} from "../utils/constants";
// @ts-expect-error: inline worker import
import SchedulerWorker from "../workers/scheduler.worker.ts";

/** Worker メッセージの型定義 */
interface WorkerMessage {
	type: "collect" | "status" | "tick";
	now?: number;
}

/** Worker 開始コマンドのパラメータ */
interface WorkerStartCommand {
	cmd: "start";
	collectInterval: number;
	statusInterval: number;
	tickInterval: number;
}

/** プラグインインターフェース（依存関係の最小化） */
interface PluginInterface {
	schedulerWorker?: Worker;
	collectData(): Promise<void>;
	updateStatusBar(): void;
	app: {
		workspace: {
			iterateAllLeaves(callback: (leaf: { view: { getViewType(): string } }) => void): void;
		};
	};
}

/**
 * Scheduler Worker を初期化して開始する
 */
export function setupAndStartWorker(plugin: PluginInterface): void {
	try {
		const worker = createWorker();
		if (!worker) {
			throw new Error("Worker factory returned undefined");
		}

		plugin.schedulerWorker = worker;
		registerWorkerEventHandlers(worker, plugin);
		startWorker(worker);

		log.log("Count Novels: Scheduler worker started.");
	} catch (e) {
		handleWorkerError(e, plugin);
	}
}

/**
 * Worker を終了する
 */
export function terminateWorker(plugin: PluginInterface): void {
	if (!plugin.schedulerWorker) return;

	try {
		plugin.schedulerWorker.postMessage({ cmd: "stop" });
		plugin.schedulerWorker.terminate();
	} catch (e) {
		log.error("Count Novels: Failed to terminate worker", e);
	}
	plugin.schedulerWorker = undefined;
}

function createWorker(): Worker | undefined {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const factory = SchedulerWorker as () => Worker;
	return factory();
}

function registerWorkerEventHandlers(
	worker: Worker,
	plugin: PluginInterface
): void {
	worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
		const data = ev.data;
		if (!data) return;

		switch (data.type) {
			case "collect":
				handleCollectMessage(plugin);
				break;
			case "status":
				plugin.updateStatusBar();
				break;
			case "tick":
				handleTickMessage(plugin, data.now);
				break;
		}
	};
}

function handleCollectMessage(plugin: PluginInterface): void {
	plugin.collectData().catch((err) =>
		log.error("Count Novels: Scheduled collection failed", err)
	);
}

function handleTickMessage(plugin: PluginInterface, now?: number): void {
	const timestamp = typeof now === "number" ? now : Date.now();

	plugin.app.workspace.iterateAllLeaves((leaf) => {
		try {
			if (leaf.view.getViewType() === VIEW_TYPE_COUNT_NOVEL) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = leaf.view as any;
				if (typeof view.handleTick === "function") {
					view.handleTick(timestamp);
				}
			}
		} catch {
			// ignore per-leaf errors
		}
	});
}

function startWorker(worker: Worker): void {
	const command: WorkerStartCommand = {
		cmd: "start",
		collectInterval: COLLECTION_INTERVAL,
		statusInterval: STATUS_BAR_UPDATE_INTERVAL,
		tickInterval: TICK_INTERVAL,
	};
	worker.postMessage(command);
}

function handleWorkerError(e: unknown, plugin: PluginInterface): void {
	const msg =
		"Count Novels: Critical Error - Scheduler Worker failed to start.";
	log.error(msg, e);
	try {
		new Notice(msg);
	} catch {
		// ignore notice errors
	}
	plugin.schedulerWorker = undefined;
}
