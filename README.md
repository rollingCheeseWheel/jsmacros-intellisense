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

* `repoUrl`: URL to the JsMacros GitHub repo.
* `assetRegExp`: Regular Expression used to filter for the TS declarations in release assets.
* `askWhenMultipleWorkspaces`: When actions can only target one workspace ask which one to use.

## Known Issues

* Variables might clash, to fix this make the macro a module by importing/exporting something.

```ts
export {}

let commandBuilder = Chat.getCommandManager().createCommandBuilder("rejoin"); //  might clash
commandBuilder.executes(JavaWrapper.methodToJava(rejoin))
commandBuilder.register()

function rejoin(){ // might clash
    GlobalVars.putString("server", World.getCurrentServerAddress().split("/")[1])
    Client.disconnect()
    Time.sleep(1)
    Client.connect(GlobalVars.getString("server"))
}
```

* Some delcared variables, for example `event` is of type [`Events.BaseEvent`](https://jsmacros.wagyourtail.xyz/?/1.9.2/xyz/wagyourtail/jsmacros/core/event/BaseEvent.html) and properties like [`text` from `RecvMessage`](https://jsmacros.wagyourtail.xyz/?/1.9.2/xyz/wagyourtail/jsmacros/client/api/event/impl/EventRecvMessage.html) dont exist on it. **This is neither the fault of JsMacros nor the extension**. The best solution is to either cast `event` (in TypeScript files) or use `// @ts-ignore`.
