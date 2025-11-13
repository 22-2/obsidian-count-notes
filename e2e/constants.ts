import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// Replace invalid JSON import with safe runtime read
const manifest = JSON.parse(
	// resolve manifest relative to this file's URL
	readFileSync(new URL("../manifest.json", import.meta.url), "utf-8")
);

// --- Project Structure ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const E2E_ROOT_DIR = __dirname;
export const PROJECT_ROOT_DIR = path.resolve(E2E_ROOT_DIR, "src");
export const DIST_DIR = path.join(PROJECT_ROOT_DIR, "dist");
export const PLUGIN_ID = manifest.id;
