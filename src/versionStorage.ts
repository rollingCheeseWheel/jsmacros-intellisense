import * as vscode from "vscode";
import { getConfig } from "./declarations/getAsset";

export const stateKeys = {
	prefix: "jsmacros-intellisense",
	current: "current",
	enabled: "enabled",
};

export interface Version {
	version: string;
	uri: vscode.Uri;
	current?: boolean;
}

export function isEnabled(context: vscode.ExtensionContext) {
	const existing = context.workspaceState.get<boolean>(
		`${stateKeys.prefix}.${stateKeys.enabled}`
	);
	return existing ? existing : getConfig().enabledByDefault;
}

export async function setEnabled(
	context: vscode.ExtensionContext,
	state: boolean
) {
	await context.workspaceState.update(
		`${stateKeys.prefix}.${stateKeys.enabled}`,
		state
	);
}

export async function getCurrentVersion(context: vscode.ExtensionContext) {
	return (await listVersions(context)).find((v) => v.current);
}

function getCurrentVersionString(context: vscode.ExtensionContext) {
	return context.workspaceState.get<string>(
		`${stateKeys.prefix}.${stateKeys.current}`
	);
}

export async function setCurrentVersion(
	context: vscode.ExtensionContext,
	version: Version
) {
	if (!vscode.workspace.fs.readDirectory(version.uri)) {
		throw new Error(
			`Folder of version ${version} is empty and cannot be used`
		);
	}

	await context.workspaceState.update(
		`${stateKeys.prefix}.${stateKeys.current}`,
		version.version
	);
}

export async function createVersion(
	context: vscode.ExtensionContext,
	version: string
) {
	const uri = vscode.Uri.joinPath(context.globalStorageUri, version);
	await vscode.workspace.fs.createDirectory(uri);
	return await getVersion(context, version);
}

export async function deleteVersion(
	context: vscode.ExtensionContext,
	version: string | Version | undefined
) {
	version =
		typeof version === "string"
			? await getVersion(context, version)
			: version;
	if (!version) {
		return false;
	}
	await vscode.workspace.fs.delete(version.uri, { recursive: true });
	return true;
}

export async function listVersions(
	context: vscode.ExtensionContext
): Promise<Version[]> {
	const currentString = getCurrentVersionString(context);

	return (await vscode.workspace.fs.readDirectory(context.globalStorageUri))
		.filter((tup) => tup[1] === vscode.FileType.Directory)
		.map((tup) => ({
			uri: vscode.Uri.joinPath(context.globalStorageUri, tup[0]),
			version: tup[0],
			current: tup[0] === currentString,
		}));
}

async function getVersion(context: vscode.ExtensionContext, version: string) {
	return (await listVersions(context)).find((v) => v.version === version);
}
