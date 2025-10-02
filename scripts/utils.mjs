import fs from "fs";
import path from "path";

export function readJsonFile(filePath) {
	const absolutePath = path.resolve(process.cwd(), filePath);
	const fileContent = fs.readFileSync(absolutePath, "utf8");
	return JSON.parse(fileContent);
}

export function writeJsonFile(filePath, data) {
	const absolutePath = path.resolve(process.cwd(), filePath);
	const fileContent = JSON.stringify(data, null, 4) + "\n";
	fs.writeFileSync(absolutePath, fileContent);
}
