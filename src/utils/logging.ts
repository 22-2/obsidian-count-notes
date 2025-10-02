// ログレベルをオブジェクト定数としてエクスポート
export const LOG_LEVEL = {
	DEBUG: "debug",
	INFO: "info",
	WARN: "warn",
	ERROR: "error",
} as const;

// LogLevel型を定数オブジェクトから生成
export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

// ログレベルの優先度
const logLevelPriorities: Record<LogLevel, number> = {
	[LOG_LEVEL.DEBUG]: 1,
	[LOG_LEVEL.INFO]: 2,
	[LOG_LEVEL.WARN]: 3,
	[LOG_LEVEL.ERROR]: 4,
};

interface LoggerInternalSettings {
	level?: LogLevel;
	name: string;
}

// 何もしない空関数
const noop = () => {};

/**
 * 動的なログレベル変更、プレフィックス表示、そして呼び出し元の行数特定を目的としたロガークラスです。
 *
 * このロガーの最大の特徴は、`console`メソッドの`bind`を組み合わせることで、
 * ログが呼び出されたファイル名と行番号をコンソールに正しく表示できる点にあります。
 * これにより、デバッグ効率が大幅に向上します。
 */
export class DirectLogger {
	private settings: LoggerInternalSettings;
	private prefix: string;
	private settingLevelPriority: number;

	// --- 変更点(1): ログ関数をプロパティとして保持 ---
	// ゲッターではなく、実際の関数を保持するプロパティに変更します。
	// 初期値は noop にしておくと安全です。
	public debug: (...args: any[]) => void = noop;
	public info: (...args: any[]) => void = noop;
	public warn: (...args: any[]) => void = noop;
	public error: (...args: any[]) => void = noop;
	public log: (...args: any[]) => void = noop;

	constructor(settings: LoggerInternalSettings) {
		this.settings = settings;
		this.prefix = `[${settings.name}]`;

		// 初期レベルを設定。デフォルトは INFO。
		const initialLevel = settings.level || LOG_LEVEL.INFO;
		this.settings.level = initialLevel;
		this.settingLevelPriority = logLevelPriorities[initialLevel];

		// --- 変更点(2): コンストラクタでログ関数を初期化 ---
		this.regenerateLogFunctions();
	}

	/**
	 * 【新設】現在のログレベル設定に基づいて、全てのログ関数を再生成します。
	 * このメソッドにロジックを集約することで、`constructor` と `updateLoggingState` で
	 * 処理を共通化できます。
	 * @private
	 * @description
	 * 【最重要】 `console[level].bind(console, this.prefix)` という実装がこのロガーの核です。
	 * 1. **呼び出し元情報の保持**: `bind`されたコンソール関数を返すことで、実行が呼び出し元まで遅延されます。
	 *    これにより、コンソールの出力にはこのロガークラスの内部ではなく、`Logger.debug(...)` が
	 *    記述されたファイルと行番号が正しく表示されます。
	 * 2. **プレフィックスの自動付与**: `bind`の第二引数にプレフィックスを渡すことで、ログ出力時に自動で先頭に付与します。
	 * 3. **`this`コンテキストの維持**: `console`メソッドが正しい`this`（つまり`console`オブジェクト自身）で実行されることを保証します。
	 */
	private regenerateLogFunctions(): void {
		const createLogFunction = (
			level: LogLevel
		): ((...args: any[]) => void) => {
			if (logLevelPriorities[level] >= this.settingLevelPriority) {
				return console[level].bind(console, this.prefix);
			}
			return noop;
		};

		this.debug = createLogFunction(LOG_LEVEL.DEBUG);
		this.info = createLogFunction(LOG_LEVEL.INFO);
		this.warn = createLogFunction(LOG_LEVEL.WARN);
		this.error = createLogFunction(LOG_LEVEL.ERROR);

		// `log` は `info` のエイリアスとして設定
		this.log = this.info;
	}

	/**
	 * ロガーのログレベルを動的に更新し、設定変更をコンソールに通知します。
	 * @param logLevel 新しく設定するログレベル
	 */
	updateLoggingState(logLevel: LogLevel) {
		this.settings.level = logLevel;
		this.settingLevelPriority = logLevelPriorities[this.settings.level];

		// --- 変更点(3): ログレベル変更後にログ関数を再生成 ---
		this.regenerateLogFunctions();

		// ログレベルの設定に関わらず、変更されたことを通知するために直接 console.info を使用
		// プレフィックスを付けて一貫性を保つ
		console.info(
			`${this.prefix} Logging level set to: ${this.settings.level}`
		);
	}

	/**
	 * 現在のロガーを親として、新しい子ロガー（サブロガー）を生成します。
	 * プレフィックスは階層的に拡張され（例: `[AppName]` -> `[AppName:SubName]`）、
	 * ログレベルの設定は親から引き継がれます。
	 * @param options サブロガーのオプション
	 * @param options.name サブロガーの名前。プレフィックスに追加されます。
	 * @returns 新しいサブロガーのインスタンス
	 */
	getSubLogger({ name }: { name: string }): DirectLogger {
		const basePrefix = this.prefix.slice(1, -1);
		const newPrefix = `${basePrefix}:${name}`;
		const subLogger = new DirectLogger({
			name: newPrefix,
			level: this.settings.level,
		});
		return subLogger;
	}
}

export const INITIAL_LOG_LEVEL = getInitialLogLevel();

function getInitialLogLevel(): LogLevel {
	const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL;
	// LOG_LEVELオブジェクトの値にenvLevelが含まれているかチェック
	if (envLevel && Object.values(LOG_LEVEL).includes(envLevel as any)) {
		return envLevel as LogLevel;
	}
	return LOG_LEVEL.INFO; // デフォルトはINFO
}
