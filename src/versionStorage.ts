import * as vscode from "vscode";
import { getConfig, JsMIntellisenseConfig } from "./config";
import { applyEdits, modify } from "jsonc-parser";

export const dtsDirectoryName = ".jsm_types";
export const versionJsonName = "version.json";
export const tsConfigFileName = "tsconfig.json";
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
		[["compilerOptions", "isolatedModules"], () => true]
	];

export interface VersionJson {
	version: string;
}

export interface Version {
	version: string;
	uri: vscode.Uri;
}

export interface LocalVersion extends Version {
	workspaceUri: vscode.Uri;
}

let logCounter = 0;
function log(message: string): void {
	vscode.window.showInformationMessage(`[${logCounter}] ${message}`);
	logCounter++;
}

export async function setCurrentVersion(version: Version): Promise<boolean> {
	if (!(await verifyStructureGlobal(version.uri))) {
		throw new Error(
			`Folder of version ${version} does not meet requiredments`
		);
	}

	const workspaceFolder = await getWorkspaceFolder();
	if (!workspaceFolder) {
		return false;
	}

	const dtsUri = vscode.Uri.joinPath(workspaceFolder.uri, dtsDirectoryName);
	await vscode.workspace.fs.createDirectory(dtsUri);
	await vscode.workspace.fs.delete(dtsUri, { recursive: true });
	await vscode.workspace.fs.createDirectory(dtsUri);
	await vscode.workspace.fs.copy(
		version.uri,
		vscode.Uri.joinPath(workspaceFolder.uri, dtsDirectoryName),
		{ overwrite: true }
	);

	await createOrUpdateVersionJson(dtsUri, { version: version.version });

	await updateTsConfig(
		vscode.Uri.joinPath(workspaceFolder.uri, tsConfigFileName)
	);

	return true;
}

async function createOrUpdateVersionJson(
	dtsDirectory: vscode.Uri,
	version: VersionJson
): Promise<void> {
	const content = await new TextEncoder().encode(JSON.stringify(version));
	const versionJsonUri = vscode.Uri.joinPath(dtsDirectory, versionJsonName);
	await vscode.workspace.fs.writeFile(versionJsonUri, content);
}

export async function removeCurrentVersion(
	context: vscode.ExtensionContext
): Promise<void> {
	const localVersion = await getCurrentVersion(context);
	if (!localVersion) {
		throw new Error("No current version set");
	}

	const dtsDirectoryUri = vscode.Uri.joinPath(
		localVersion.workspaceUri,
		dtsDirectoryName
	);
	await vscode.workspace.fs.delete(dtsDirectoryUri, { recursive: true });
	const tsConfigUri = vscode.Uri.joinPath(
		localVersion.workspaceUri,
		tsConfigFileName
	);
	await removeDeclarationsFromTsConfig(tsConfigUri);
}

interface TsConfigInclude {
	include?: string[];
}

async function updateTsConfig(
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

async function removeDeclarationsFromTsConfig(
	tsConfigUri: vscode.Uri
): Promise<void> {
	const tsConfigContent = new TextDecoder().decode(
		await vscode.workspace.fs.readFile(tsConfigUri)
	);
	const stdJsonConfig = JSON.parse(tsConfigContent) as TsConfigInclude;

	const includes = [...(stdJsonConfig.include ?? [])];
	await editAndSaveTsConfig(tsConfigUri, tsConfigContent, includes, false);
}

async function editAndSaveTsConfig(
	tsConfigUri: vscode.Uri,
	content: string,
	includes: string[],
	enabling: boolean
): Promise<void> {
	const formattingOptions = {
		formattingOptions: { tabSize: 4 },
	};

	for (const [path, fun] of compilerOptionsChanges) {
		// make compiler options changes
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

export async function getCurrentVersion(
	context: vscode.ExtensionContext
): Promise<LocalVersion | undefined> {
	const workspaceFolder = await getWorkspaceFolder();
	log(`workspace folder: ${workspaceFolder}`);
	if (!workspaceFolder) {
		return;
	}
	const currentVersionString = await getCurrentVersionString(workspaceFolder);
	if (!currentVersionString) {
		return;
	}
	const globalVersions = await listVersionsGlobal(context);
	const matching = globalVersions.find(
		(v) => v.version === currentVersionString
	);
	if (!matching) {
		return;
	} else {
		return {
			...matching,
			workspaceUri: workspaceFolder.uri,
		};
	}
}

export async function getCurrentVersionString(
	workspaceFolder: vscode.WorkspaceFolder
): Promise<string | undefined> {
	const versionDirUri = vscode.Uri.joinPath(
		workspaceFolder.uri,
		dtsDirectoryName
	);
	const versionJson = await verifyStructureLocal(versionDirUri);
	if (!versionJson) {
		return;
	} else {
		return versionJson.version;
	}
}

async function getWorkspaceFolder(
	config?: JsMIntellisenseConfig
): Promise<vscode.WorkspaceFolder | undefined> {
	config ??= getConfig();
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		throw new Error("No workspaces are currently open");
	} else if (config.askWhenMultipleWorkspaces && workspaceFolders.length !== 1) {
		return (await showWorkspaceQuickPick(workspaceFolders))
			?.workspaceFolder;
	} else {
		return workspaceFolders[0];
	}
}

interface WorkspaceFolderQuickPickItem extends vscode.QuickPickItem {
	workspaceFolder: vscode.WorkspaceFolder;
}

async function showWorkspaceQuickPick(
	workspaceFolders?: readonly vscode.WorkspaceFolder[] | undefined
): Promise<WorkspaceFolderQuickPickItem | undefined> {
	workspaceFolders ??= vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return;
	}
	const items = workspaceFolders.map<WorkspaceFolderQuickPickItem>(
		(folder) => ({ label: folder.name, workspaceFolder: folder })
	);
	return await vscode.window.showQuickPick(items);
}

async function verifyStructureGlobal(
	uri: vscode.Uri,
	files?: [string, vscode.FileType][]
): Promise<boolean> {
	files ??= await vscode.workspace.fs.readDirectory(uri);
	if (!files) {
		return false;
	}
	for (const file of files) {
		if (
			file[1] !== vscode.FileType.File ||
			file[0] === undefined ||
			!file[0].endsWith(".d.ts")
		) {
			continue;
		}
		return true;
	}
	return false;
}

async function verifyStructureLocal(
	uri: vscode.Uri
): Promise<VersionJson | undefined> {
	const files = await vscode.workspace.fs.readDirectory(uri);
	if (!(await verifyStructureGlobal(uri, files))) {
		log("global structure not verified");
		return;
	}
	for (const file of files) {
		if (!file[0].endsWith(versionJsonName)) {
			continue;
		}

		const parsedVersionJson = await parseVersionJson(
			vscode.Uri.joinPath(uri, file[0])
		);
		if (!parsedVersionJson || !parsedVersionJson.version) {
			continue;
		}
		return parsedVersionJson;
	}

	log("local structure not verified");
	return;
}

async function parseVersionJson(
	uri: vscode.Uri
): Promise<VersionJson | undefined> {
	try {
		const contents = await vscode.workspace.fs.readFile(uri);
		return JSON.parse(new TextDecoder().decode(contents)) as VersionJson;
	} catch {
		return;
	}
}

export async function getOrCreateVersionDirectoryGlobal(
	context: vscode.ExtensionContext,
	version: string
): Promise<Version | undefined> {
	const uri = vscode.Uri.joinPath(context.globalStorageUri, version);
	await vscode.workspace.fs.createDirectory(uri);
	return await getVersionGlobal(context, version);
}

export async function deleteVersionGlobal(
	context: vscode.ExtensionContext,
	version: string | Version | undefined
): Promise<boolean> {
	version =
		typeof version === "string"
			? await getVersionGlobal(context, version)
			: version;
	if (!version) {
		return false;
	}
	await vscode.workspace.fs.delete(version.uri, { recursive: true });
	return true;
}

export async function listVersionsGlobal(
	context: vscode.ExtensionContext
): Promise<Version[]> {
	return (await vscode.workspace.fs.readDirectory(context.globalStorageUri))
		.filter((tup) => tup[1] === vscode.FileType.Directory)
		.map((tup) => ({
			uri: vscode.Uri.joinPath(context.globalStorageUri, tup[0]),
			version: tup[0],
		}));
}

async function getVersionGlobal(
	context: vscode.ExtensionContext,
	version: string
): Promise<Version | undefined> {
	return (await listVersionsGlobal(context)).find(
		(v) => v.version === version
	);
}
