import * as vscode from "vscode";
import * as unzipper from "unzipper";
import { DeclarationAsset } from "./asset";

export async function downloadAndExtractDeclarations(
	asset: DeclarationAsset,
	target: vscode.Uri
): Promise<vscode.Uri> {
	const zippedBuffer = await downloadZip(asset.asset.browser_download_url);
	const unzippedDir = await extract(zippedBuffer);

	await vscode.workspace.fs.createDirectory(target);

	const regex = /^headers\/([^\/]+?\.d\.ts)$/;

	for (const file of unzippedDir.files) {
		if (file.type !== "File") {
			continue;
		}

		const matches = regex.exec(file.path);
		if (!matches || !matches[1]) {
			continue;
		}
		const outUri = vscode.Uri.joinPath(target, matches[1]);
		await vscode.workspace.fs.writeFile(outUri, await file.buffer());
	}
	return target;
}

async function downloadZip(url: string | URL): Promise<Buffer<ArrayBuffer>> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Unable to fetch ${url.toString()}: ${res.statusText}`);
	}
	const buffer = Buffer.from(await res.arrayBuffer());
	return buffer;
}

async function extract(
	buffer: Buffer<ArrayBuffer>
): Promise<unzipper.CentralDirectory> {
	return await unzipper.Open.buffer(buffer);
}
