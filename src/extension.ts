import * as vscode from "vscode";
import { DatabaseService } from "./DatabaseService";
import {
    DatabaseTreeProvider,
    DatabaseTreeItem,
} from "./DatabaseTreeProvider";
import { SILODBCompletionProvider } from "./CompletionProvider";

let dbService: DatabaseService;
let treeProvider: DatabaseTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
    dbService = new DatabaseService();
    treeProvider = new DatabaseTreeProvider(dbService);

    // Register the tree view
    const treeView = vscode.window.createTreeView("SILODBDatabaseView", {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Load saved path from configuration
    loadConfiguredPath();

    // Watch for config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("SILODB.dataPath")) {
                loadConfiguredPath();
            }
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand("SILODB.setDataPath", cmdSetDataPath),
        vscode.commands.registerCommand("SILODB.autoDetect", cmdAutoDetect),
        vscode.commands.registerCommand("SILODB.refresh", cmdRefresh),
        vscode.commands.registerCommand("SILODB.addEntry", cmdAddEntry),
        vscode.commands.registerCommand("SILODB.editEntry", cmdEditEntry),
        vscode.commands.registerCommand("SILODB.deleteEntry", cmdDeleteEntry),
        vscode.commands.registerCommand("SILODB.addNamespace", cmdAddNamespace),
        vscode.commands.registerCommand("SILODB.deleteNamespace", cmdDeleteNamespace)
    );

    // Register Lua IntelliSense for SILODB API
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: "lua" },
            new SILODBCompletionProvider(),
            ".", ":"
        )
    );

    vscode.window.showInformationMessage("SILODB Explorer activated");
}

export function deactivate(): void {
    // Nothing to clean up
}

// =============================================================================
// Configuration
// =============================================================================

function loadConfiguredPath(): void {
    const config = vscode.workspace.getConfiguration("SILODB");
    const configPath = config.get<string>("dataPath", "");

    if (configPath) {
        dbService.setDataPath(configPath);
        treeProvider.refresh();
    }
}

// =============================================================================
// Commands
// =============================================================================

async function cmdSetDataPath(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Select SILODB_data folder",
    });

    if (!uris || uris.length === 0) {
        return;
    }

    const selectedPath = uris[0].fsPath;
    dbService.setDataPath(selectedPath);

    // Save to workspace config
    const config = vscode.workspace.getConfiguration("SILODB");
    await config.update("dataPath", selectedPath, vscode.ConfigurationTarget.Workspace);

    treeProvider.refresh();
    vscode.window.showInformationMessage(`SILODB: Database path set to ${selectedPath}`);
}

async function cmdAutoDetect(): Promise<void> {
    const paths = dbService.autoDetectPaths();

    if (paths.length === 0) {
        vscode.window.showWarningMessage(
            "SILODB: No savegames with SILODB_data found. Use the folder icon to set the path manually."
        );
        return;
    }

    const selected = await vscode.window.showQuickPick(
        paths.map((p) => ({
            label: p.replace(/\\/g, "/").split("/").slice(-2).join("/"),
            description: p,
            path: p,
        })),
        {
            placeHolder: "Select a savegame database",
        }
    );

    if (!selected) {
        return;
    }

    dbService.setDataPath(selected.path);

    const config = vscode.workspace.getConfiguration("SILODB");
    await config.update("dataPath", selected.path, vscode.ConfigurationTarget.Workspace);

    treeProvider.refresh();
    vscode.window.showInformationMessage(`SILODB: Connected to ${selected.label}`);
}

function cmdRefresh(): void {
    treeProvider.refresh();
}

async function cmdAddNamespace(): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: "Namespace name (e.g. FS25_MyMod)",
        placeHolder: "FS25_MyMod",
        validateInput: (value) => {
            if (!value || value.trim() === "") {
                return "Namespace name is required";
            }
            if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                return "Use only letters, numbers, and underscores";
            }
            return null;
        },
    });

    if (!name) {
        return;
    }

    if (dbService.createNamespace(name)) {
        treeProvider.refresh();
        vscode.window.showInformationMessage(`SILODB: Namespace '${name}' created`);
    } else {
        vscode.window.showErrorMessage(`SILODB: Failed to create namespace '${name}'`);
    }
}

async function cmdDeleteNamespace(item: DatabaseTreeItem): Promise<void> {
    if (!item || item.itemType !== "namespace" || !item.namespace) {
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Delete namespace '${item.namespace}' and ALL its data?`,
        { modal: true },
        "Delete"
    );

    if (confirm !== "Delete") {
        return;
    }

    if (dbService.deleteNamespace(item.namespace)) {
        treeProvider.refresh();
        vscode.window.showInformationMessage(
            `SILODB: Namespace '${item.namespace}' deleted`
        );
    }
}

async function cmdAddEntry(item: DatabaseTreeItem): Promise<void> {
    if (!item || !item.namespace) {
        return;
    }

    const key = await vscode.window.showInputBox({
        prompt: `Key name to add under '${item.label}'`,
        placeHolder: "myKey",
        validateInput: (value) => {
            if (!value || value.trim() === "") {
                return "Key name is required";
            }
            return null;
        },
    });

    if (!key) {
        return;
    }

    const rawValue = await vscode.window.showInputBox({
        prompt: `Value for '${key}' (JSON for objects/arrays, plain text for strings)`,
        placeHolder: '42, "hello", true, {"key": "value"}',
    });

    if (rawValue === undefined) {
        return;
    }

    const value = parseInputValue(rawValue);
    const newPath = [...(item.keyPath || []), key];

    if (dbService.setValueAtPath(item.namespace, newPath, value)) {
        treeProvider.refresh();
        vscode.window.showInformationMessage(
            `SILODB: [${item.namespace}] Added ${newPath.join(".")} = ${JSON.stringify(value)}`
        );
    }
}

async function cmdEditEntry(item: DatabaseTreeItem): Promise<void> {
    if (!item || !item.namespace || !item.keyPath) {
        return;
    }

    const currentValue = item.value;
    const currentDisplay =
        typeof currentValue === "object"
            ? JSON.stringify(currentValue, null, 2)
            : String(currentValue ?? "");

    const rawValue = await vscode.window.showInputBox({
        prompt: `Edit value for '${item.keyPath.join(".")}'`,
        value: currentDisplay,
        placeHolder: '42, "hello", true, {"key": "value"}',
    });

    if (rawValue === undefined) {
        return;
    }

    const value = parseInputValue(rawValue);

    if (dbService.setValueAtPath(item.namespace, item.keyPath, value)) {
        treeProvider.refresh();
    }
}

async function cmdDeleteEntry(item: DatabaseTreeItem): Promise<void> {
    if (!item || !item.namespace || !item.keyPath) {
        return;
    }

    const pathString = item.keyPath.join(".");
    const confirm = await vscode.window.showWarningMessage(
        `Delete key '${pathString}' from '${item.namespace}'?`,
        { modal: true },
        "Delete"
    );

    if (confirm !== "Delete") {
        return;
    }

    if (dbService.deleteKeyAtPath(item.namespace, item.keyPath)) {
        treeProvider.refresh();
        vscode.window.showInformationMessage(
            `SILODB: [${item.namespace}] Deleted '${pathString}'`
        );
    }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parses a user input string into the appropriate JS type.
 * Tries JSON first, falls back to string.
 */
function parseInputValue(raw: string): unknown {
    const trimmed = raw.trim();

    if (trimmed === "") {
        return "";
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}
