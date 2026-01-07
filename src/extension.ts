import * as vscode from "vscode";
import { DeclarationAsset, getNewestAsset, getSpecificAsset } from "./asset";
import {
	getOrCreateVersionDirectoryGlobal,
	deleteVersionGlobal as deleteVersionFromStorage,
	listVersionsGlobal,
	Version,
	setCurrentVersion,
	removeCurrentVersion as removeVersionLocal,
	getAbsoluteUrisToDefinitions,
} from "./versionStorage";
import { downloadAndExtractDeclarations } from "./download";
// import { PluginConfig } from "ts-plugin/src/config";
import { getConfig } from "./config";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions as LanguageServerOptions,
	TextDocumentIdentifier,
	TextDocumentItem,
	TransportKind,
} from "vscode-languageclient/node";
import * as path from "path";

export async function activate(
	context: vscode.ExtensionContext
): Promise<void> {
	await vscode.workspace.fs.createDirectory(context.globalStorageUri); // path isn't automatically created when installing extension

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
): Promise<void> {
	if (!version) {
		version = await listVersionsQuickPick(context);
		if (!version) {
			return;
		}
	}

	await setCurrentVersion(context, version);

	if (getConfig().experimentalHinting) {
		const absPaths = await getAbsoluteUrisToDefinitions(version);
		// await updateTsPlugin({ absPaths: absPaths });
	}

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

async function removeVersionGlobal(
	context: vscode.ExtensionContext
): Promise<void> {
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

/* async function loadCurrentlySelectedVersion(
	context: vscode.ExtensionContext
): Promise<void> {
	if (!getConfig().experimentalHinting) {
		return;
	}

	const currentVersion = await getCurrentVersion(context);
	if (!currentVersion) {
		return;
	}
	const absPaths = await getAbsolutePathsToDefinitions(currentVersion);
	await updateTsPlugin({ absPaths: absPaths });
} */

/* async function updateTsPlugin(config: PluginConfig): Promise<void> {
	const tsExtension = vscode.extensions.getExtension(tsExtensionId);
	if (!tsExtension) {
		return;
	}

	await tsExtension.activate();

	if (!tsExtension.exports || !tsExtension.exports.getAPI) {
		return;
	}

	const api = tsExtension.exports.getAPI(0);
	if (!api) {
		return;
	}

	api.configurePlugin(tsPluginId, config);
} */