# JsMacros Intellisense

A Visual Studio Code extension that adds type hints for [JsMacros](https://github.com/JsMacros/JsMacros) JavaScript macros.

## Features

* **Type hints**: currently only adds the decalarations to the TypeScript server (also used for JavaScript files) and thus the types cannot be imported, JavaScript is reccommended.
* **Version Management**: multiple versions of declarations can be downloaded, select one to be in current use.

## Usage

1. Open a workspace
2. Run either `JsMacros Intellisense: fetch newest declarations` or `JsMacros Intellisense: fetch a specific declaration version`, the downloaded version will automatically be selected as the current one. If you already have a version downloaded use `JsMacros Intellisense: change the declaration version for your current workspace` and select one.

## Commands

All declarations live in the global extension storage, the list of available versions is driven by its contents. The currently selected version is stored as an entry in the workspace state (`vscode.ExtensionContext.workspaceState`) and should always be changed through commands.

* `fetch newest declarations`: fetches the newest version and saves them as `latest`. After downloading it will not be checked for updates
* `fetch a specific declaration version`: shows a version selection, fetches one and saves it as the name of the release, for example `Release 1.9.2`. If the specific version is the newest it will not be saved as `latest`.
* `change the declaration version for your current workspace`
* `list all currently installed versions`
* `remove declarations for a specific version`

## Config

* `repoUrl`: URL to the JsMacros GitHub repo
* `assetRegExp`: Regular Expression used to filter for the TS declarations

## Known Issues

* Not version control system-friendly since state is stored in VSCode and not the file system
* Unpredictable behaviour might occur when deleting versions
* Unpredictable behaviour might occur when manually adding versions to the global extension storage
* Type hints currently don't work, the logic to inject the `.d.ts` files is not working. (currently through a TS plugin / language service)
