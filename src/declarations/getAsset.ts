import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import * as vscode from "vscode";

export async function getNewestAsset() {
	return {
		releaseName: "latest",
		asset: await getDeclarationAsset(),
	};
}

export async function getSpecificAsset() {
	const release = await showQuickPick();
	if (!release) {
		return;
	}

	return {
		releaseName: release.label,
		asset: await getDeclarationAsset(release.releaseId),
	};
}

interface AssetPickItem extends vscode.QuickPickItem {
	asset: any;
}

async function getDeclarationAsset(releaseId?: number) {
	const config = getConfig();

	const octokit = new Octokit();
	let release;
	if (releaseId) {
		release = await octokit.repos.getRelease({
			...config,
			release_id: releaseId,
		});
	} else {
		release = await octokit.repos.getLatestRelease(config);
	}

	const assets = release.data.assets.filter((a) =>
		config.assetRegEx.test(a.name)
	);

	const quickPickItems = assets.map<AssetPickItem>((a) => ({
		asset: a,
		label: a.name,
	}));

	return (await vscode.window.showQuickPick(quickPickItems))?.asset;
}

interface ReleaseItem extends vscode.QuickPickItem {
	releaseId: number;
}

async function showQuickPick() {
	const items: ReleaseItem[] = (await listReleases()).map((r) => ({
		label: r.name || r.tag_name,
		releaseId: r.id,
		description: (() => {
			const date = new Date(r.created_at);

			const yyyy = date.getFullYear();
			const MM = (date.getMonth() + 1).toString().padStart(2, "0");
			const dd = date.getDate().toString().padStart(2, "0");
			return `${yyyy}-${MM}-${dd}`;
		})(),
	}));

	return await vscode.window.showQuickPick(items);
}

async function listReleases() {
	const octokit = new Octokit();
	return await octokit.paginate(octokit.repos.listReleases, {
		...getConfig(),
		per_page: 100,
	});
}

export function getConfig(config?: vscode.WorkspaceConfiguration) {
	if (!config) {
		config = vscode.workspace.getConfiguration("jsmacros-intellisense");
	}

	const repoUrl = config.get<string>("repoUrl");
	if (!repoUrl) {
		throw new Error("JsMacros repo URL not specified");
	}
	const matches = /^https:\/\/github.com\/([\w.-]+)\/([\w.-]+)$/.exec(
		repoUrl
	);
	if (!matches || !matches[1] || !matches[2]) {
		throw new Error("Repo URL doesn't match pattern");
	}

	const assetRegexString = config.get<string>("assetRegExp");
	if (!assetRegexString) {
		throw new Error("Asset filter RegExp not specified");
	}

	const enabledByDefault = config.get<boolean>("enabledByDefault");

	return {
		owner: matches[1],
		repo: matches[2],
		assetRegEx: new RegExp(assetRegexString),
		assetRegexString: assetRegexString,
		enabledByDefault: enabledByDefault,
	};
}
