import log from "loglevel";

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
    private useWorkerFallback: boolean;

    constructor(container: HTMLElement, useWorkerFallback = true) {
        this.container = container;
        this.useWorkerFallback = useWorkerFallback;
    }

    public mount(): void {
        this.timeEl = this.container.createDiv('count-novels-clock');
        Object.assign(this.timeEl.style, {
            textAlign: 'center',
            lineHeight: '1',
        } as Partial<CSSStyleDeclaration>);

        this.timeEl.textContent = formatTime(new Date());

        // If no external scheduler is used, create a fallback timer/worker
        if (this.useWorkerFallback) {
            // Fallback using setInterval on main thread; keep it simple
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id: any = window.setInterval(() => {
                if (this.timeEl) this.timeEl.textContent = formatTime(new Date());
            }, 1000);
            this.intervalId = typeof id === 'number' ? id : (id as unknown as number);
        }
    }

    // Called by external scheduler (main thread) when a tick occurs
    public handleTick(now?: number): void {
        if (!this.timeEl) return;
        const date = typeof now === 'number' ? new Date(now) : new Date();
        this.timeEl.textContent = formatTime(date);
    }

    public destroy(): void {
        if (this.worker) {
            try { this.worker.terminate(); } catch (_e) { /* ignore */ }
            this.worker = undefined;
        }
        if (this.intervalId != null) {
            try { window.clearInterval(this.intervalId); } catch (_e) { /* ignore */ }
            this.intervalId = undefined;
        }
        if (this.timeEl && this.timeEl.parentElement) {
            this.timeEl.remove();
            this.timeEl = undefined;
        }
    }
}
