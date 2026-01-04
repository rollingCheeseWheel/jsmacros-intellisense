import * as vscode from "vscode";
import { getConfig, JsMIntellisenseConfig } from "./config";
import {
	editAndSaveTsConfig,
	generalIncludeGlobs,
	removeDeclarationsFromTsConfig,
	updateTsConfig,
} from "./tsconfig";
import { promises } from "dns";

export const versionJsonName = "version.json";
export const dtsDirectoryName = ".jsm_types";
export const tsConfigFileName = "tsconfig.json";

export const currentVersionStateKey = "jsmacros-intellisense-current";

export interface VersionJson {
	version: string;
}

export interface Version {
	version: string;
	uri: vscode.Uri;
}

export interface LocalVersion extends Version {
	workspaceUri: vscode.Uri | undefined;
}

export async function setCurrentVersion(
	context: vscode.ExtensionContext,
	version: Version
): Promise<boolean> {
	if (!(await verifyStructureGlobal(version.uri))) {
		throw new Error(
			`Folder of version ${version} does not meet requirements`
		);
	}

	if (getConfig().experimentalHinting) {
		context.workspaceState.update(currentVersionStateKey, version.version);
		return true;
	} else {
		const workspaceFolder = await getWorkspaceFolder();
		if (!workspaceFolder) {
			return false;
		}

		const dtsUri = vscode.Uri.joinPath(
			workspaceFolder.uri,
			dtsDirectoryName
		);
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
	if (getConfig().experimentalHinting) {
		context.workspaceState.update(currentVersionStateKey, undefined);
	} else {
		const localVersion = await getCurrentVersion(context);
		if (!localVersion) {
			throw new Error("No current version set");
		}

		const dtsDirectoryUri = vscode.Uri.joinPath(
			localVersion.workspaceUri!,
			dtsDirectoryName
		);
		await vscode.workspace.fs.delete(dtsDirectoryUri, { recursive: true });
		const tsConfigUri = vscode.Uri.joinPath(
			localVersion.workspaceUri!,
			tsConfigFileName
		);
		await removeDeclarationsFromTsConfig(tsConfigUri);
	}
}

export async function getCurrentVersion(
	context: vscode.ExtensionContext
): Promise<LocalVersion | undefined> {
	let currentVersionString: string | undefined = undefined;

	if (getConfig().experimentalHinting) {
		currentVersionString = context.workspaceState.get<string>(
			currentVersionStateKey
		);
	} else {
		const workspace = await getWorkspaceFolder();
		if (!workspace) {
			return;
		}
		currentVersionString = await getCurrentVersionString(workspace);
	}
	if (!currentVersionString) {
		return;
	}

	const globalVersions = await listVersionsGlobal(context);
	const matching = globalVersions.find(
		(v) => v.version === currentVersionString
	);
	if (!matching) {
		return;
	}
	if (getConfig().experimentalHinting) {
		return {
			...matching,
			workspaceUri: undefined,
		};
	} else {
		const workspaceFolder = await getWorkspaceFolder();
		if (!workspaceFolder) {
			return;
		}
		const currentVersionString = await getCurrentVersionString(
			workspaceFolder
		);
		if (!currentVersionString) {
			return;
		}
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
	} else if (
		config.askWhenMultipleWorkspaces &&
		workspaceFolders.length !== 1
	) {
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

export async function getAbsolutePathsToDefinitions(
	version: Version
): Promise<string[]> {
	return (await getAbsoluteUrisToDefinitions(version)).map((u) => u.fsPath);
}

export async function getAbsoluteUrisToDefinitions(
	version: Version
): Promise<vscode.Uri[]> {
	return (await vscode.workspace.fs.readDirectory(version.uri))
		.filter((f) => f[1] === vscode.FileType.File)
		.map((f) => vscode.Uri.joinPath(version.uri, f[0]));
}
