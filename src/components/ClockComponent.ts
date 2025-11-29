import log from "loglevel";

const logger = log.getLogger("ClockComponent");

function formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ISO週番号を取得するヘルパー関数
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][date.getDay()];
    const weekNum = getWeekNumber(date);

    // 画像のフォーマット: "2025年, 11月 29日, 土曜日, 第48週"
    return `${year}年, ${month}月 ${day}日, ${dayOfWeek}, 第${weekNum}週`;
}

export class ClockComponent {
    private container: HTMLElement;
    private wrapperEl?: HTMLElement; // 全体を囲むラッパー
    private timeEl?: HTMLElement;    // 時刻表示用
    private dateEl?: HTMLElement;    // 日付表示用
    private worker?: Worker;
    private intervalId?: number;
    private useWorkerFallback: boolean;

    constructor(container: HTMLElement, useWorkerFallback = true) {
        this.container = container;
        this.useWorkerFallback = useWorkerFallback;
    }

    public mount(): void {
        // メインコンテナ（ラッパー）を作成
        this.wrapperEl = this.container.createDiv('count-novels-clock-wrapper');
        
        // 時刻要素
        this.timeEl = this.wrapperEl.createDiv('count-novels-clock-time');
        
        // 日付要素
        this.dateEl = this.wrapperEl.createDiv('count-novels-clock-date');

        this.updateDisplay(new Date());

        if (this.useWorkerFallback) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id: any = window.setInterval(() => {
                this.updateDisplay(new Date());
            }, 1000);
            this.intervalId = typeof id === 'number' ? id : (id as unknown as number);
        }
    }

    public handleTick(now?: number): void {
        const date = typeof now === 'number' ? new Date(now) : new Date();
        this.updateDisplay(date);
    }

    private updateDisplay(date: Date): void {
        if (this.timeEl) this.timeEl.textContent = formatTime(date);
        if (this.dateEl) this.dateEl.textContent = formatDate(date);
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
        if (this.wrapperEl) {
            this.wrapperEl.remove();
            this.wrapperEl = undefined;
            this.timeEl = undefined;
            this.dateEl = undefined;
        }
    }
}
