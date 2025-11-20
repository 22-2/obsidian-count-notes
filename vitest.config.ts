import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["fake-indexeddb/auto"],
		exclude: ["e2e/**", "node_modules/**"],
	},
	resolve: {
		alias: {
			src: path.resolve(__dirname, "./src"),
			obsidian: path.resolve(
				__dirname,
				"./src/tests/__mocks__/obsidian.ts"
			),
		},
	},
});
