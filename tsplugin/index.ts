import type * as ts from "typescript/lib/tsserverlibrary";

interface TsPluginConfig {
	absolutePaths: string[];
}

function init(mod: { typescript: typeof ts }) {
	const typescript = mod.typescript;

	return {
		create(info: ts.server.PluginCreateInfo) {
			return info.languageService;
		},
		onConfigurationChanged(config: TsPluginConfig) {
			//
		},
	};
}

module.exports = init;
