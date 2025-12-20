import * as vscode from "vscode";
import { getNewestAsset, getSpecificAsset } from "./declarations/getAsset";
import {
	createVersion,
	deleteVersion as deleteVersionFromStorage,
	getCurrentVersion,
	isEnabled,
	listVersions,
	setCurrentVersion,
	setEnabled,
	Version,
} from "./versionStorage";
import { downloadAndExtractDeclarations } from "./declarations/download";

export function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage(context.globalStorageUri.fsPath);

	const fetchNewestDisposable = vscode.commands.registerCommand(
		"jsmacros-intellisense.fetchNewest",
		async () => {
			await fetchNewest(context);
			const version = await createVersion(context, "latest");
			if (!version) {
				return;
			}
			await changeVersion(context, version);
		}
	);

	const fetchSpecificVersionDisposable = vscode.commands.registerCommand(
		"jsmacros-intellisense.fetchSpecific",
		async () => {
			await fetchSpecific(context);
			// const versions = await listVersions(context);
			// if (!versions[0]) {
			// 	return;
			// }
			// await changeVersion(context, versions[0]);
		}
	);

	const changeVersionDisposable = vscode.commands.registerCommand(
		"jsmacros-intellisense.changeVersion",
		async () => await changeVersion(context)
	);

	const listVersionsDisposable = vscode.commands.registerCommand(
		"jsmacros-intellisense.listVersions",
		async () => await listVersionsQuickPick(context)
	);

	const changeEnabledDisposable = vscode.commands.registerCommand(
		"jsmacros-intellisense.changeEnabled",
		async () => await changeEnabled(context)
	);

	const deleteVersionDisposable = vscode.commands.registerCommand(
		"jsmacros-intellisense.deleteVersion",
		async () => await deleteVersion(context)
	);

	context.subscriptions.push(
		fetchNewestDisposable,
		fetchSpecificVersionDisposable,
		changeVersionDisposable,
		listVersionsDisposable,
		changeEnabledDisposable,
		deleteVersionDisposable
	);
}

export function deactivate() {}

async function fetchNewest(context: vscode.ExtensionContext) {
	const asset = await getNewestAsset();
	await fetchAsset(context, asset);
	vscode.window.showInformationMessage("Successfully fetched declarations");
}

async function fetchSpecific(context: vscode.ExtensionContext) {
	const asset = await getSpecificAsset();
	if (!asset) {
		return;
	}
	await fetchAsset(context, asset);
	vscode.window.showInformationMessage("Successfully fetched declarations");
}

async function fetchAsset(context: vscode.ExtensionContext, asset: any) {
	const versionDir = await createVersion(context, asset.releaseName);

	if (!versionDir) {
		throw new Error(
			`Unable to create directory at ${vscode.Uri.joinPath(
				context.globalStorageUri,
				asset.releaseName
			)}`
		);
	}

	const path = await downloadAndExtractDeclarations(
		asset.asset.browser_download_url,
		versionDir.uri
	);

	await changeVersion(context, versionDir);
}

async function changeVersion(
	context: vscode.ExtensionContext,
	version?: Version | null
) {
	if (!version) {
		version = await listVersionsQuickPick(context);
		if (!version) {
			return;
		}
	}

	setCurrentVersion(context, version);

	const newVersion = await getCurrentVersion(context);
	if (!newVersion) {
		throw new Error("Unable to change current version");
	}
	const filePaths = (await vscode.workspace.fs.readDirectory(newVersion.uri))
		.filter((tuple) => tuple[1] === vscode.FileType.File)
		.map((tuple) => vscode.Uri.joinPath(newVersion.uri, tuple[0]).fsPath);

	await vscode.commands.executeCommand("typescript.restartTsServer");

	updateTsPluginConfig(isEnabled(context) ? filePaths : []);
}

async function listVersionsQuickPick(
	context: vscode.ExtensionContext
): Promise<Version | null> {
	const items = await listVersions(context);
	const choice = await vscode.window.showQuickPick(
		items.map((i) => ({
			label: i.version + (i.current ? " (current)" : ""),
			description: i.uri.fsPath,
			uri: i.uri,
		}))
	);
	if (!choice) {
		return null;
	}
	return { version: choice.label, uri: choice.uri };
}

async function changeEnabled(context: vscode.ExtensionContext) {
	const choice = await vscode.window.showQuickPick([
		{
			label: "on",
			value: true,
		},
		{ label: "off", value: false },
	]);
	const currentVersion = await getCurrentVersion(context);
	if (!choice || !currentVersion) {
		return;
	}
	await setEnabled(context, choice.value);
	await changeVersion(context, currentVersion);
	vscode.window.showInformationMessage(`Turned hints ${choice.label}`);
}

async function deleteVersion(context: vscode.ExtensionContext) {
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

interface TsPluginConfig {
	absolutePaths: string[];
}

async function updateTsPluginConfig(absPaths: string[]) {
	const tsExtension = vscode.extensions.getExtension(
		"vscode.typescript-language-features"
	);
	if (!tsExtension) {
		throw new Error("Could not load TS extension");
	}

	await tsExtension.activate();

	if (!tsExtension.exports || !tsExtension.exports.getAPI) {
		throw new Error(
			"TS extension does not expose API, unable to load hints"
		);
	}

	const tsPluginAPI = tsExtension.exports.getAPI(0);
	if (!tsPluginAPI) {
		throw new Error("Unexpected error, unable to load hints");
	}

	const config: TsPluginConfig = {
		absolutePaths: absPaths,
	};

	tsPluginAPI.configurePlugin("tsplugin", config);
}
