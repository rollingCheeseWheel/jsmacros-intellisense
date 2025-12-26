import * as vscode from "vscode";

export const defaultConfig: JsMIntellisenseConfig = {
	owner: "JsMacros",
	repo: "JsMacros",
	assetRegExp: /^typescript/,
	askWhenMultipleWorkspaces: true,
};

export interface JsMIntellisenseConfig {
	owner: string;
	repo: string;
	assetRegExp: RegExp;
	askWhenMultipleWorkspaces: boolean;
}

export function getConfig(
	config?: vscode.WorkspaceConfiguration
): JsMIntellisenseConfig {
	if (!config) {
		config = vscode.workspace.getConfiguration("jsmacros-intellisense");
	}

	const repoUrl = config.get<string>("repoUrl");
	if (!repoUrl) {
		throw new Error("Config: repoUrl not specified");
	}
	const matches = /^https:\/\/github.com\/([\w.-]+)\/([\w.-]+)$/.exec(
		repoUrl
	);
	if (!matches || !matches[1] || !matches[2]) {
		throw new Error("Repo URL doesn't match pattern");
	}

	const assetRegexString = config.get<string>("assetRegExp");
	if (!assetRegexString) {
		throw new Error("Config: repoUrl not specified");
	}

	const askWhenMultipleWorkspaces = config.get<boolean>(
		"askWhenMultipleWorkspaces"
	);
	if (askWhenMultipleWorkspaces === undefined) {
		throw new Error("Config: askWhenMultipleWorkspaces not specified");
	}

	return {
		owner: matches[1],
		repo: matches[2],
		assetRegExp: new RegExp(assetRegexString),
		askWhenMultipleWorkspaces: askWhenMultipleWorkspaces,
	};
}
