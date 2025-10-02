import esbuild from "esbuild";
import { spawn } from "child_process";

// ビルド完了時にrepomixを実行するesbuildプラグイン（改良版）
export const runRepomixPlugin: esbuild.Plugin = {
	name: "run-repomix-on-end",
	setup(build) {
		let debounceTimeout: NodeJS.Timeout;

		build.onEnd((result) => {
			// 前回のタイマーをクリア
			clearTimeout(debounceTimeout);

			if (result.errors.length > 0) {
				console.log("Build failed, skipping repomix.");
				return;
			}

			// 100ミリ秒待ってから実行（連続保存に対応）
			debounceTimeout = setTimeout(() => {
				console.log("Build successful, running repomix...");

				const child = spawn("repomix", [], {
					// stdio: 'inherit'で出力をリアルタイムに表示
					stdio: "inherit",
					shell: true, // Windows環境での互換性向上
				});

				child.on("error", (err) => {
					console.error("Failed to start repomix command:", err);
				});

				child.on("close", (code) => {
					if (code !== 0) {
						console.error(
							`repomix command exited with code ${code}`
						);
					}
				});
			}, 100);
		});
	},
};
