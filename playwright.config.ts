import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	timeout: 3000 * 10,
	testDir: "./e2e",
	outputDir: "./test-results",
	reporter: [["html", { outputFolder: "../playwright-report" }]],
	fullyParallel: true,
	workers: 4,
	use: {
		trace: "on-first-retry",
		video: "on",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
