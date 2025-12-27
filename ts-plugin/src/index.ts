import * as ts from "typescript";
import { PluginConfig } from "./config";

/* IMPORTANT: remember to run `npm run compile` before running the extension so the plugin gets compiled */

export = function init({ typescript }: { typescript: typeof ts }): {
	create(info: ts.server.PluginCreateInfo): ts.LanguageService;
	onConfigurationChanged(newConfig: PluginConfig): void;
} {
	let typeAcquisition: ts.TypeAcquisition | undefined = undefined;
	let oldConfig: PluginConfig = { absPaths: [] };
	let project: ts.server.Project | undefined = undefined;

	let serverHost: ts.server.ServerHost | undefined = undefined;
	let fileWatchers: ts.FileWatcher[] = [];

	function log(message: string): void {
		project?.log("ts-plugin:\t" + message);
	}

	return {
		create(info: ts.server.PluginCreateInfo): ts.LanguageService {
			info.project.enableLanguageService();

			// for (const absPath of oldConfig.absPaths) {
			// 	info.project.log(`ts-plugin: removing old file ${absPath}`);
			// 	info.project.projectService.closeClientFile(absPath);
			// }

			// for (const absPath of newConfig.absPaths) {
			// 	info.project.log(`ts-plugin: adding file ${absPath}`);
			// 	info.project.projectService.openClientFile(absPath);
			// }

			// info.project.log(
			// 	"ts-plugin: finished adding files from config, ready to restart ts server"
			// );

			// if (typeAcquisition) {
			// 	info.project.log("ts-plugin: updating type acquisition");
			// 	project.setTypeAcquisition(typeAcquisition);
			// }
			// info.project.log("ts-plugin: finished initializing");

			project = info.project;
			serverHost = info.serverHost;

			log("initialized plugin");

			return info.project.getLanguageService(true);
		},
		onConfigurationChanged(config: PluginConfig): void {
			// oldConfig = newConfig;
			// newConfig = config;

			/* Steam */

			// for (const absPath of oldConfig.absPaths) {
			// 	log(`removing old file ${absPath}`);
			// 	project.projectService.closeClientFile(absPath);
			// }

			// oldConfig = config;

			// for (const absPath of oldConfig.absPaths) {
			// 	log(`removing old file ${absPath}`);
			// 	project.projectService.openClientFile(
			// 		absPath,
			// 		undefined,
			// 		ts.ScriptKind.TS
			// 	);
			// }

			// log(
			// 	`earlier typeAcquisition: ${JSON.stringify(
			// 		typeAcquisition
			// 	)}`
			// );

			// typeAcquisition = project.getTypeAcquisition();
			// typeAcquisition.enable = true;
			// typeAcquisition.include = Array.from(
			// 	new Set(typeAcquisition.include.concat(config.absPaths))
			// );
			// typeAcquisition.exclude = typeAcquisition.exclude
			// 	.concat(oldConfig.absPaths)
			// 	.filter((p) => !config.absPaths.includes(p));
			// oldConfig = config;

			// log(
			// 	`modified typeAcquisition: ${JSON.stringify(
			// 		typeAcquisition
			// 	)}`
			// );

			// project.setTypeAcquisition(typeAcquisition);

			// log("reloading projects");
			// project.projectService.reloadProjects();

			// for (const watcher of fileWatchers) {
			// 	watcher.close();
			// }

			// log("closed file watchers if any");

			// fileWatchers = [];

			// for (const path of config.absPaths) {
			// 	fileWatchers.push(serverHost.watchFile(path, () => {}));
			// 	log(`watching file ${path}`);
			// }

			// log("finished updating config");
			// log("reloading projects");

			// project.projectService.reloadProjects();
		},
	};
};
