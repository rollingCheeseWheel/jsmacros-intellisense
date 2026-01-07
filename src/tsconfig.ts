import * as vscode from "vscode";
import { dtsDirectoryName } from "./versionStorage";
import { applyEdits, modify } from "jsonc-parser";

export const generalIncludeGlobs = [
	`${dtsDirectoryName}/**/*.d.ts`,
	"**/*.ts",
	"**/*.js",
];

type JsonCEntryValue = any | (() => any);
type JsonCEntry = [string[], JsonCEntryValue];

export const generatedTsConfig: Record<string, JsonCEntryValue> = {
	compilerOptions: {
		skipLibCheck: true,
		checkJs: true,
		noEmit: true,
		lib: ["ES2022"],
		target: "ES2022",
	},
	infclude: () => {},
};

export async function addIncludesToTsConfig(
	tsConfigUri: vscode.Uri,
	globPatterns: string[] = generalIncludeGlobs
): Promise<void> {
	try {
		await vscode.workspace.fs.readFile(tsConfigUri);
	} catch {
		const content = JSON.stringify({}, null, "\t");
		await vscode.workspace.fs.writeFile(
			tsConfigUri,
			new TextEncoder().encode(content)
		);
	}

	const tsConfigContent = new TextDecoder().decode(
		await vscode.workspace.fs.readFile(tsConfigUri)
	);
	const stdJsonConfig = JSON.parse(tsConfigContent) as StrippedTsConfig;

	const includes = Array.from(
		new Set(...(stdJsonConfig.include ?? []), ...globPatterns)
	);
	await editAndSaveTsConfig(tsConfigUri, tsConfigContent, includes);
}

export async function removeIncludesFromTsConfig(
	tsConfigUri: vscode.Uri
): Promise<void> {
	const tsConfigContent = new TextDecoder().decode(
		await vscode.workspace.fs.readFile(tsConfigUri)
	);
	const stdJsonConfig = JSON.parse(tsConfigContent) as StrippedTsConfig;

	const includes = [...(stdJsonConfig.include ?? [])];
	await editAndSaveTsConfig(tsConfigUri, tsConfigContent, includes);
}

export async function editAndSaveTsConfig(
	tsConfigUri: vscode.Uri,
	content: string,
	includes: string[]
): Promise<void> {
	const formattingOptions = {
		formattingOptions: { tabSize: 4 },
	};

	for (const [path, value] of enumerateConfig()) {
		let edits;
		if (typeof value === "function") {
			edits = modify(content, path, includes, formattingOptions);
		} else {
			edits = modify(content, path, value, formattingOptions);
		}
		content = applyEdits(content, edits);
	}

	await vscode.workspace.fs.writeFile(
		tsConfigUri,
		new TextEncoder().encode(content)
	);
}

function enumerateConfig(
	config: object = generatedTsConfig,
	depth: number = 0,
	limit: number = 5
): JsonCEntry[] {
	let result: JsonCEntry[] = [];

	if (depth >= limit) {
		return result;
	}

	for (const [key, value] of Object.entries(config)) {
		if (typeof value === "object" && !Array.isArray(value)) {
			for (let entry of enumerateConfig(value, depth + 1, limit)) {
				entry[0].unshift(key);
				result.push(entry);
			}
		} else {
			result.push([[key], value]);
		}
	}
	return result;
}

interface StrippedTsConfig {
	include?: string[];
}
