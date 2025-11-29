import log from "loglevel";
// @ts-ignore: inline-worker plugin provides a default factory for .worker.ts imports
import ClockWorker from "../workers/clock.worker.ts";

const logger = log.getLogger("ClockComponent");

function formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

export class ClockComponent {
    private container: HTMLElement;
    private timeEl?: HTMLElement;
    private worker?: Worker;
    private intervalId?: number;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    public mount(): void {
        this.timeEl = this.container.createDiv('count-novels-clock');
        Object.assign(this.timeEl.style, {
            textAlign: 'center',
            lineHeight: '1',
        } as Partial<CSSStyleDeclaration>);

        this.timeEl.textContent = formatTime(new Date());
        this.setupWorker();
    }

    private setupWorker(): void {
        try {
            // The inline-worker plugin exposes a factory that returns a Worker instance
            // TypeScript declaration for '*.worker.ts' is provided in src/types/worker.d.ts
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const factory = ClockWorker as any;
            this.worker = factory();
            if (this.worker) {
                this.worker.onmessage = (ev: MessageEvent) => {
                    const payload = ev.data as { now?: number };
                    if (payload && typeof payload.now === 'number' && this.timeEl) {
                        this.timeEl.textContent = formatTime(new Date(payload.now));
                    }
                };
                this.worker.postMessage('start');
            }
        } catch (e) {
            logger.error('Count Novels: Failed to create inline worker, falling back', e);
            // Fallback: create a simple interval on main thread
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id: any = window.setInterval(() => {
                if (this.timeEl) this.timeEl.textContent = formatTime(new Date());
            }, 1000);
            this.intervalId = typeof id === 'number' ? id : (id as unknown as number);
        }
    }


    public destroy(): void {
        if (this.worker) {
            try {
                this.worker.postMessage('stop');
            } catch (_e) {
                // ignore
                logger.error("Failed to stop worker:", _e);
            }
            try {
                this.worker.terminate();
            } catch (_e) {
                // ignore
                logger.error("Failed to terminate worker:", _e);
            }
            this.worker = undefined;
        }
        
        if (this.timeEl && this.timeEl.parentElement) {
            this.timeEl.remove();
            this.timeEl = undefined;
        }
    }
}
