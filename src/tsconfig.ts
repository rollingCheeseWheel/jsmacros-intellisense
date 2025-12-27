import * as vscode from "vscode";
import { dtsDirectoryName } from "./versionStorage";
import { applyEdits, modify } from "jsonc-parser";

export const generalIncludeGlobs = [
	`${dtsDirectoryName}/**/*.d.ts`,
	"**/*.ts",
	"**/*.js",
];
export const compilerOptionsChanges: [string[], (disabling: boolean) => any][] =
	[
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		[["compilerOptions", "skipLibCheck"], () => true],
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		[["compilerOptions", "checkJs"], () => true],
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		[["compilerOptions", "noEmit"], () => true],
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		[["compilerOptions", "noCheck"], (e) => !e],
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		[["compilerOptions", "lib"], () => ["es2022"]],
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		[["compilerOptions", "isolatedModules"], () => true],
	];

export async function updateTsConfig(
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
	const stdJsonConfig = JSON.parse(tsConfigContent) as TsConfigInclude;

	const includes = Array.from(
		new Set<string>([...(stdJsonConfig.include ?? []), ...globPatterns])
	);
	await editAndSaveTsConfig(tsConfigUri, tsConfigContent, includes, true);
}

export async function removeDeclarationsFromTsConfig(
	tsConfigUri: vscode.Uri
): Promise<void> {
	const tsConfigContent = new TextDecoder().decode(
		await vscode.workspace.fs.readFile(tsConfigUri)
	);
	const stdJsonConfig = JSON.parse(tsConfigContent) as TsConfigInclude;

	const includes = [...(stdJsonConfig.include ?? [])];
	await editAndSaveTsConfig(tsConfigUri, tsConfigContent, includes, false);
}

export async function editAndSaveTsConfig(
	tsConfigUri: vscode.Uri,
	content: string,
	includes: string[],
	enabling: boolean
): Promise<void> {
	const formattingOptions = {
		formattingOptions: { tabSize: 4 },
	};

	for (const [path, fun] of compilerOptionsChanges) {
		const edits = modify(content, path, fun(enabling), formattingOptions);
		content = applyEdits(content, edits);
	}

	const edits = modify(content, ["include"], includes, formattingOptions);
	content = applyEdits(content, edits);

	await vscode.workspace.fs.writeFile(
		tsConfigUri,
		new TextEncoder().encode(content)
	);
}

interface TsConfigInclude {
	include?: string[];
}
