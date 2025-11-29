export class ClockComponent {
    private container: HTMLElement;
    private timeEl?: HTMLElement;
    private intervalId: number | undefined;
    private worker?: Worker;
    private registerIntervalFn?: (id: number) => void;

    constructor(container: HTMLElement, registerInterval?: (id: number) => void) {
        this.container = container;
        this.registerIntervalFn = registerInterval;
    }

    public mount(): void {
        // 時計要素を作ってコンテナの末尾に追加
        this.timeEl = this.container.createDiv('count-novels-clock');
        // ルックは CSS 側で制御するため JS 側では最低限のみ設定
        Object.assign(this.timeEl.style, {
            textAlign: 'center',
            lineHeight: '1',
        } as Partial<CSSStyleDeclaration>);

        // 初期表示
        this.updateText();

        // Web Worker が使える環境なら Worker を使って 1 秒ごとのタイミングを送らせる
        if (typeof Worker !== 'undefined') {
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

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            try {
                this.worker = new Worker(url);
                this.worker.onmessage = (ev: MessageEvent) => {
                    const payload = ev.data as { now?: number };
                    if (payload && typeof payload.now === 'number') {
                        if (!this.timeEl) return;
                        const now = new Date(payload.now);
                        const hh = String(now.getHours()).padStart(2, '0');
                        const mm = String(now.getMinutes()).padStart(2, '0');
                        const ss = String(now.getSeconds()).padStart(2, '0');
                        this.timeEl.textContent = `${hh}:${mm}:${ss}`;
                    }
                };
                this.worker.postMessage('start');
            } catch (e) {
                // Worker 作成に失敗したらフォールバック
                // eslint-disable-next-line no-console
                console.log('Count Novels: Worker creation failed, falling back to setInterval:', e);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const id: any = window.setInterval(() => this.updateText(), 1000);
                this.intervalId = typeof id === 'number' ? id : (id as unknown as number);
                try {
                    if (this.registerIntervalFn && typeof this.registerIntervalFn === 'function') {
                        this.registerIntervalFn(this.intervalId);
                    }
                } catch (_err) {
                    // ignore
                }
            } finally {
                URL.revokeObjectURL(url);
            }
        } else {
            // Worker 非対応環境では通常の setInterval
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id: any = window.setInterval(() => this.updateText(), 1000);
            this.intervalId = typeof id === 'number' ? id : (id as unknown as number);
            try {
                if (this.registerIntervalFn && typeof this.registerIntervalFn === 'function') {
                    this.registerIntervalFn(this.intervalId);
                }
            } catch (_err) {
                // ignore
            }
        }
    }

    private updateText(): void {
        if (!this.timeEl) return;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        this.timeEl.textContent = `${hh}:${mm}:${ss}`;
    }

    public destroy(): void {
        if (this.worker) {
            try {
                this.worker.postMessage('stop');
            } catch (_e) {
                // ignore
            }
            try {
                this.worker.terminate();
            } catch (_e) {
                // ignore
            }
            this.worker = undefined;
        }
        if (this.intervalId != null) {
            try {
                window.clearInterval(this.intervalId);
            } catch (_e) {
                // ignore
            }
            this.intervalId = undefined;
        }
        if (this.timeEl && this.timeEl.parentElement) {
            this.timeEl.remove();
            this.timeEl = undefined;
        }
    }
}
