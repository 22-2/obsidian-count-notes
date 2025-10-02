import { MyPluginSettings } from "../settings";
import manifest from "../../manifest.json";

export const DEFAULT_SETTINGS: MyPluginSettings = {
	logLevel: "debug",
};

export const APP_NAME = manifest.name || "MyPlugin";
