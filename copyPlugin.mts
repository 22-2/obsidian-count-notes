import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import { CopyPluginOptions } from "./esbuild.config.mts";

export const copyPlugin = ({ opts }: CopyPluginOptions): esbuild.Plugin => ({
	name: "copy-plugin",
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length > 0) {
				console.warn("[CopyPlugin] Build failed. Skipping file copy.");
				return;
			}

			console.log("[CopyPlugin] Starting file copy process...");

			for (const { src, dest } of opts) {
				if (!dest) {
					console.error(`[CopyPlugin] Destination path is required.`);
					continue;
				}

				try {
					// 1. First, ensure the destination directory (dest) exists, creating it recursively if necessary.
					await fs.mkdir(dest, { recursive: true });

					for (const srcPath of src) {
						// 2. Get the filename robustly.
						const fileName = path.basename(srcPath);
						const destPath = path.join(dest, fileName);

						try {
							// 3. Check if the source file exists
							await fs.access(srcPath);

							// 4. Copy the file
							await fs.copyFile(srcPath, destPath);
							console.log(
								`[CopyPlugin] Copied: ${srcPath} -> ${destPath}`
							);
						} catch (e) {
							if (
								e instanceof Error &&
								"code" in e &&
								e.code === "ENOENT"
							) {
								console.warn(
									`[CopyPlugin] Warning: Source file not found: ${srcPath}. Skipping.`
								);
							} else {
								console.error(
									`[CopyPlugin] Failed to copy ${srcPath}:`,
									e
								);
							}
						}
					}
				} catch (e) {
					// Catch critical errors, mainly those resulting from fs.mkdir failures.
					console.error(
						`[CopyPlugin] Failed processing destination group for '${dest}':`,
						e
					);
				}
			}
			console.log("[CopyPlugin] File copy process finished.");
		});
	},
});
