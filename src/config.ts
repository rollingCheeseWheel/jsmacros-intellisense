import * as vscode from "vscode";

export const defaultConfig: JsMIntellisenseConfig = {
	owner: "JsMacros",
	repo: "JsMacros",
	assetRegExp: /^typescript/,
	askWhenMultipleWorkspaces: true,
	experimentalHinting: false,
};

export interface JsMIntellisenseConfig {
	owner: string;
	repo: string;
	assetRegExp: RegExp;
	askWhenMultipleWorkspaces: boolean;
	experimentalHinting: boolean;
}

export function getConfig(): JsMIntellisenseConfig {
	const config = vscode.workspace.getConfiguration("jsmacros-intellisense");

	let result: JsMIntellisenseConfig = defaultConfig;
	const repoUrl = config.get<string>("repoUrl");
	if (repoUrl) {
		const matches = /^https:\/\/github.com\/([\w.-]+)\/([\w.-]+)$/.exec(
			repoUrl
		);
		if (matches) {
			result.owner = matches[1] ? matches[1] : result.owner;
			result.repo = matches[2] ? matches[2] : result.repo;
		}
	}

	const assetRegExp = config.get<string>("assetRegExp");
	result.assetRegExp = assetRegExp
		? new RegExp(assetRegExp)
		: result.assetRegExp;

	result.askWhenMultipleWorkspaces =
		config.get<boolean>("askWhenMultipleWorkspaces") ??
		result.askWhenMultipleWorkspaces;

	result.experimentalHinting =
		config.get<boolean>("experimentalHinting") ??
		result.experimentalHinting;

	return result;
}
