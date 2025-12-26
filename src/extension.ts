import * as vscode from "vscode";
import { DeclarationAsset, getNewestAsset, getSpecificAsset } from "./asset";
import {
	getOrCreateVersionDirectoryGlobal,
	deleteVersionGlobal as deleteVersionFromStorage,
	listVersionsGlobal,
	Version,
	setCurrentVersion,
	removeCurrentVersion as removeVersionLocal,
} from "./versionStorage";
import { downloadAndExtractDeclarations } from "./download";

export function activate(context: vscode.ExtensionContext): void {
	vscode.window.showInformationMessage(context.globalStorageUri.fsPath);
	const disposables = registerCommands(context, [
		["jsmacros-intellisense.fetchNewest", fetchNewest],
		["jsmacros-intellisense.fetchSpecific", fetchSpecific],
		["jsmacros-intellisense.changeVersion", changeVersion],
		["jsmacros-intellisense.removeLocal", removeVersionLocal],
		["jsmacros-intellisense.listGlobal", listVersionsQuickPick],
		["jsmacros-intellisense.removeGlobal", removeVersionGlobal],
	]);
	context.subscriptions.push(...disposables);
}

type Command = [string, (context: vscode.ExtensionContext) => Promise<any>];

function registerCommands(
	context: vscode.ExtensionContext,
	commands: Command[]
): vscode.Disposable[] {
	return commands.map((command) => {
		return vscode.commands.registerCommand(command[0], async () =>
			command[1](context)
		);
	});
}

export function deactivate(): void {}

async function fetchNewest(context: vscode.ExtensionContext): Promise<void> {
	const asset = await getNewestAsset();
	if (!asset) {
		throw new Error("Unable to get newest release");
	}
	await fetchAssetAndChangeVersion(context, asset);
	vscode.window.showInformationMessage("Successfully fetched version");
}

async function fetchSpecific(context: vscode.ExtensionContext): Promise<void> {
	const asset = await getSpecificAsset();
	if (!asset) {
		return;
	}
	await fetchAssetAndChangeVersion(context, asset);
	vscode.window.showInformationMessage("Successfully fetched version");
}

async function fetchAssetAndChangeVersion(
	context: vscode.ExtensionContext,
	asset: DeclarationAsset
): Promise<void> {
	const versionDir = await getOrCreateVersionDirectoryGlobal(
		context,
		asset.releaseName
	);

	if (!versionDir) {
		throw new Error(
			`Unable to create directory at ${vscode.Uri.joinPath(
				context.globalStorageUri,
				asset.releaseName
			)}`
		);
	}

	await downloadAndExtractDeclarations(asset, versionDir.uri);

	const version = await getOrCreateVersionDirectoryGlobal(
		context,
		asset.releaseName
	);
	if (!version) {
		throw new Error("Unable to create version directory");
	}
	await changeVersion(context, version);
}

async function changeVersion(
	context: vscode.ExtensionContext,
	version?: Version | null
) : Promise<void>{
	if (!version) {
		version = await listVersionsQuickPick(context);
		if (!version) {
			return;
		}
	}

	await setCurrentVersion(version);
	vscode.window.showInformationMessage("Successfully changed version");
}

async function listVersionsQuickPick(
	context: vscode.ExtensionContext
): Promise<Version | null> {
	const items = await listVersionsGlobal(context);
	const choice = await vscode.window.showQuickPick(
		items.map((i) => ({
			label: i.version,
			description: i.uri.fsPath,
			uri: i.uri,
		}))
	);
	if (!choice) {
		return null;
	}
	return { version: choice.label, uri: choice.uri };
}

async function removeVersionGlobal(context: vscode.ExtensionContext): Promise<void> {
	const versionToDelete = await listVersionsQuickPick(context);

	if (!versionToDelete) {
		return;
	}

	const result = (await deleteVersionFromStorage(context, versionToDelete))
		? "successfully"
		: "unsuccessfully";
	vscode.window.showInformationMessage(
		`${result} deleted version ${versionToDelete?.version}`
	);
}
