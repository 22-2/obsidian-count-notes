import { normalizePath } from "obsidian";

const toForwardSlashes = (value: string): string => value.replace(/\\/g, "/");
const trimSlashes = (value: string): string =>
	value.replace(/^\/+/, "").replace(/\/+$/, "");

const normalizeFolderValue = (folderPath: string): string => {
	const trimmed = folderPath.trim();
	if (!trimmed) {
		return "";
	}
	const normalized = normalizePath(trimmed);
	return trimSlashes(toForwardSlashes(normalized));
};

const normalizeFilePath = (filePath: string): string => {
	return toForwardSlashes(filePath).replace(/^\/+/, "");
};

export const normalizeExcludedFolders = (folders?: string[]): string[] => {
	if (!Array.isArray(folders)) {
		return [];
	}

	const normalized = folders
		.map(normalizeFolderValue)
		.filter((folder) => folder.length > 0);

	const dedupedByCase = new Map<string, string>();
	normalized.forEach((folder) => {
		const key = folder.toLowerCase();
		if (!dedupedByCase.has(key)) {
			dedupedByCase.set(key, folder);
		}
	});

	return Array.from(dedupedByCase.values());
};

export const parseExcludedFoldersInput = (input: string): string[] => {
	if (!input) {
		return [];
	}

	const lines = input.split(/\r?\n/).map((line) => line.trim());
	return normalizeExcludedFolders(lines.filter((line) => line.length > 0));
};

export const isPathInExcludedFolders = (
	filePath: string,
	normalizedFolders: string[]
): boolean => {
	if (!normalizedFolders.length) {
		return false;
	}

	const normalizedPath = normalizeFilePath(filePath);
	return normalizedFolders.some(
		(folder) =>
			normalizedPath === folder ||
			normalizedPath.startsWith(`${folder}/`)
	);
};
