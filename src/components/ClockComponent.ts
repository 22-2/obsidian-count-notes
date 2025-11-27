export class ClockComponent {
    private container: HTMLElement;
    private timeEl?: HTMLElement;
    private intervalId?: number;
    private resizeObserver?: ResizeObserver;
    private threshold: number;
    private outside: boolean;

    constructor(container: HTMLElement, threshold = 220, outside = false) {
        this.container = container;
        this.threshold = threshold;
        this.outside = outside;
    }

    public mount(): void {
        // 時計要素を作ってコンテナの末尾に追加
        this.timeEl = this.container.createDiv('count-novels-clock');
        Object.assign(this.timeEl.style, {
            textAlign: 'center',
            marginTop: '8px',
            lineHeight: '1',
            display: 'none',
            fontWeight: '900',
            // Use tabular numbers so digits take uniform width
            fontVariantNumeric: 'tabular-nums',
            // position 外部配置モードで上書きされる
        } as Partial<CSSStyleDeclaration>);

        this.resizeObserver = new ResizeObserver(() => this.updateVisibility());
        this.resizeObserver.observe(this.container);

        // 初回評価
        this.updateVisibility();
    }

    private updateVisibility(): void {
        if (!this.timeEl) return;
        const height = this.container.clientHeight || this.container.getBoundingClientRect().height || 0;
        const shouldShow = height >= this.threshold;
        if (shouldShow) {
            this.timeEl.style.display = 'block';
            const size = Math.max(32, Math.min(120, Math.floor(height * 0.28)));
            this.timeEl.style.fontSize = `${size}px`;
            // adjust top spacing proportionally for uniform spacing
            const mt = Math.max(8, Math.floor(size * 0.12));
            this.timeEl.style.marginTop = `${mt}px`;
            if (this.outside) {
                // 外側表示モード: 親を relative にしておく想定
                Object.assign(this.timeEl.style, {
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    // 下方向に出す（高さの約半分をマイナスオフセット）
                    bottom: `${-Math.floor(size * 0.45)}px`,
                    marginTop: '0px',
                    pointerEvents: 'none',
                } as Partial<CSSStyleDeclaration>);
            } else {
                // 通常はフロー内に表示
                this.timeEl.style.position = '';
            }

            if (this.intervalId == null) {
                this.updateText();
                this.intervalId = window.setInterval(() => this.updateText(), 1000) as unknown as number;
            }
        } else {
            this.timeEl.style.display = 'none';
            if (this.intervalId != null) {
                clearInterval(this.intervalId);
                this.intervalId = undefined;
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
        if (this.intervalId != null) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        if (this.resizeObserver) {
            try { this.resizeObserver.disconnect(); } catch (e) {}
            this.resizeObserver = undefined;
        }
        if (this.timeEl && this.timeEl.parentElement) {
            this.timeEl.remove();
            this.timeEl = undefined;
        }
    }
}
