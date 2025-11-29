import log from "loglevel";

const logger = log.getLogger("ClockComponent");

// ユーティリティ関数群
function formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function createWorkerBlob(): Blob {
    const workerCode = `
        self.onmessage = function(e) {
            if (e && e.data === 'start') {
                self._timer = setInterval(function() {
                    self.postMessage({ now: Date.now() });
                }, 1000);
            } else if (e && e.data === 'stop') {
                if (self._timer) {
                    clearInterval(self._timer);
                    self._timer = undefined;
                }
            }
        };
    `;
    return new Blob([workerCode], { type: 'application/javascript' });
}

export class ClockComponent {
    private container: HTMLElement;
    private timeEl?: HTMLElement;
    private worker?: Worker;

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
        const blob = createWorkerBlob();
        const url = URL.createObjectURL(blob);
        
        try {
            this.worker = new Worker(url);
            this.worker.onmessage = (ev: MessageEvent) => {
                const payload = ev.data as { now?: number };
                if (payload && typeof payload.now === 'number' && this.timeEl) {
                    this.timeEl.textContent = formatTime(new Date(payload.now));
                }
            };
            this.worker.postMessage('start');
        } finally {
            URL.revokeObjectURL(url);
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
