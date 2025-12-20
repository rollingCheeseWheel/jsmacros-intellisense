import type * as ts from "typescript/lib/tsserverlibrary";

interface TsPluginConfig {
	absolutePaths: string[];
}

function init({ typescript }: { typescript: typeof ts }) {
	const documentRegistry = typescript.createDocumentRegistry();
	let compilationSettings: ts.CompilerOptions;
	let getScriptSnapshot: (fileName: string) => ts.IScriptSnapshot | undefined;
	let logger: ts.server.Logger;

	return {
		create(info: ts.server.PluginCreateInfo) {
			const host = info.languageServiceHost;
			compilationSettings = host.getCompilationSettings();
			getScriptSnapshot = host.getScriptSnapshot;
			logger = info.project.projectService.logger;

			logger.info("onConfigurationChanged\tcreated plugin");

			return typescript.createLanguageService(host, documentRegistry);
		},
		onConfigurationChanged(config: TsPluginConfig) {
			logger.info(
				`onConfigurationChanged\tincoming abs paths: ${config.absolutePaths.join(
					"\n"
				)}`
			);
			if (!compilationSettings) {
				logger.info(
					"onConfigurationChanged\twas unable to get compiler options"
				);
				return;
			}

			for (const absPath of config.absolutePaths) {
				logger.info(`onConfigurationChanged\tprocessing ${absPath}`);
				const scriptSnapshot = getScriptSnapshot(absPath);
				if (!scriptSnapshot) {
					logger.info(
						`onConfigurationChanged\tunable to get script snapshot for file ${absPath}`
					);
					continue;
				}

				documentRegistry.acquireDocument(
					absPath,
					compilationSettings,
					scriptSnapshot,
					"0.0.0"
				);
			}
			logger.info(`onConfigurationChanged\tfinished processing files`);
		},
	};
}

module.exports = init;
