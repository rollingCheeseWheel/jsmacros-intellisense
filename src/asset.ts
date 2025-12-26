import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import * as vscode from "vscode";
import { getConfig, JsMIntellisenseConfig } from "./config";
import { components } from "@octokit/openapi-types";

export type Release =
	RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"][0];
export type Asset = components["schemas"]["release-asset"];

export interface DeclarationAsset {
	asset: Asset;
	releaseName: string;
}

export async function getNewestAsset(): Promise<DeclarationAsset | undefined> {
	const asset = await getDeclarationAsset();
	return asset
		? {
				releaseName: "latest",
				asset: asset,
		  }
		: undefined;
}

export async function getSpecificAsset(): Promise<
	DeclarationAsset | undefined
> {
	const release = await showReleaseQuickPick();
	if (!release) {
		return;
	}

	const asset = await getDeclarationAsset(release.releaseId);
	return asset
		? {
				releaseName: release.label,
				asset: asset,
		  }
		: asset;
}

interface AssetQuickPick extends vscode.QuickPickItem {
	asset: Asset;
}

async function getDeclarationAsset(
	releaseId?: number
): Promise<Asset | undefined> {
	const octokit = new Octokit();
	const config = getConfig();

	releaseId ??= (await listReleases(octokit))[0].id;

	if (!releaseId) {
		throw new Error("No Release was found for the specified repository");
	}
	const release = await octokit.repos.getRelease({
		...getConfig(),
		release_id: releaseId,
	});

	const assets = release.data.assets.filter((a) =>
		config.assetRegExp.test(a.name)
	);

	const quickPickItems = assets.map<AssetQuickPick>((a) => ({
		asset: a,
		label: a.name,
	}));

	if (quickPickItems.length === 0) {
		return undefined;
	} else if (quickPickItems.length === 1) {
		return quickPickItems[0].asset;
	} else {
		return (await vscode.window.showQuickPick(quickPickItems))?.asset;
	}
}

interface ReleaseItem extends vscode.QuickPickItem {
	releaseId: number;
}

async function showReleaseQuickPick(): Promise<ReleaseItem | undefined> {
	const items = (await listReleases()).map<ReleaseItem>((r) => ({
		label: r.name || r.tag_name,
		releaseId: r.id,
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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

async function listReleases(
	octokit?: Octokit,
	config?: JsMIntellisenseConfig
): Promise<Release[]> {
	octokit ??= new Octokit();
	config ??= getConfig();

	return (
		await octokit.repos.listReleases({
			...config,
		})
	).data;
}
