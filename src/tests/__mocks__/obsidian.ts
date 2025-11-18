/* c8 ignore file */
export class TFile {
	path: string;

	constructor(path = "") {
		this.path = path;
	}
}

export class PluginSettingTab {
	constructor(public app: any, public plugin: any) {}
	display(): void {}
}

export class Setting {
	setName(): this {
		return this;
	}

	setDesc(): this {
		return this;
	}

	addText(): this {
		return this;
	}

	addToggle(): this {
		return this;
	}

	addButton(): this {
		return this;
	}
}

export class Plugin {
	app: any;

	constructor(app: any) {
		this.app = app;
	}

	addSettingTab(): void {}
}

export class ItemView {
	getViewType(): string {
		return "";
	}
}

export class WorkspaceLeaf {
	view: any = { getViewType: () => "" };
}

export type ViewStateResult = void;

export class FileManager {}

export const normalizePath = (value: string): string => {
	return value.replace(/\\/g, "/").replace(/\/+/g, "/");
};
