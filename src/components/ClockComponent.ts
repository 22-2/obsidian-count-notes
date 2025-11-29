export class ClockComponent {
    private container: HTMLElement;
    private timeEl?: HTMLElement;
    private intervalId?: number;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    public mount(): void {
        // 時計要素を作ってコンテナの末尾に追加
        this.timeEl = this.container.createDiv('count-novels-clock');
        // ルックは CSS 側で制御するため JS 側では最低限のみ設定
        Object.assign(this.timeEl.style, {
            textAlign: 'center',
            lineHeight: '1',
        } as Partial<CSSStyleDeclaration>);

        // 秒刻みの更新を開始
        this.updateText();
        this.intervalId = window.setInterval(() => this.updateText(), 500) as unknown as number;
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
        if (this.intervalId != null) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        if (this.timeEl && this.timeEl.parentElement) {
            this.timeEl.remove();
            this.timeEl = undefined;
        }
    }
}
