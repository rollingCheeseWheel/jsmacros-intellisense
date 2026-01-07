import * as vscode from "vscode";
import {
	applyEdits,
	findNodeAtLocation,
	modify,
	parseTree,
} from "jsonc-parser";

export const tsConfigFileName = "tsconfig.json";
export const typesDirectoryName = ".jsm_types";

export const includeGlobs = [
	`${typesDirectoryName}/**/*.d.ts`,
	"**/*.ts",
	"**/*.js",
];

type JsonCEntry = [string[], any];

export const generatedTsConfig: Record<string, any> = {
	compilerOptions: {
		skipLibCheck: true,
		checkJs: true,
		noEmit: true,
		lib: ["ES2022"],
		target: "ES2022",
	},
	include: (includes: string[]) => includes,
};

export async function addJsmTsConfig(
	tsConfigUri: vscode.Uri,
	globPatterns: string[] = includeGlobs
): Promise<void> {
	try {
		await vscode.workspace.fs.stat(tsConfigUri);
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
		new Set([...(stdJsonConfig.include ?? []), ...globPatterns])
	);
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

	const tree = parseTree(content);

	if (!tree) {
		throw new Error(`Error parsing ${tsConfigUri.fsPath}`);
	}

	for (let [path, value] of enumerateConfig()) {
		if (typeof value === "function") {
			value = value(includes);
		}
		
		if (Array.isArray(value)) {
			const previousValues = findNodeAtLocation(tree, path)?.value;
			if (Array.isArray(previousValues)) {
				value = value.concat(previousValues);
			}
		}
		const edits = modify(content, path, value, formattingOptions);
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
