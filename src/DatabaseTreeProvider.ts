import * as vscode from "vscode";
import { DatabaseService } from "./DatabaseService";

/**
 * Tree item representing either a namespace or a key-value entry.
 */
export class DatabaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly itemType: "namespace" | "entry",
        public readonly namespace?: string,
        public readonly key?: string,
        public readonly value?: unknown
    ) {
        super(
            label,
            itemType === "namespace"
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.contextValue = itemType;

        if (itemType === "namespace") {
            this.iconPath = new vscode.ThemeIcon("database");
            this.tooltip = `Namespace: ${label}`;
        } else {
            this.iconPath = new vscode.ThemeIcon("symbol-field");
            this.description = this.formatValue(value);
            this.tooltip = `${key} = ${this.formatValue(value)}`;
        }
    }

    private formatValue(value: unknown): string {
        if (value === null || value === undefined) {
            return "null";
        }
        if (typeof value === "object") {
            return JSON.stringify(value);
        }
        return String(value);
    }
}

/**
 * TreeDataProvider for the DBAPI database explorer.
 * Shows: Namespace > Key = Value
 */
export class DatabaseTreeProvider
    implements vscode.TreeDataProvider<DatabaseTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<
        DatabaseTreeItem | undefined | null | void
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly dbService: DatabaseService) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DatabaseTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DatabaseTreeItem): DatabaseTreeItem[] {
        if (!this.dbService.isConfigured()) {
            return [];
        }

        // Root level: show namespaces
        if (!element) {
            return this.dbService.getNamespaces().map(
                (ns) => new DatabaseTreeItem(ns, "namespace", ns)
            );
        }

        // Namespace level: show key-value entries
        if (element.itemType === "namespace" && element.namespace) {
            const data = this.dbService.getNamespaceData(element.namespace);
            const keys = Object.keys(data).sort();
            return keys.map(
                (key) =>
                    new DatabaseTreeItem(key, "entry", element.namespace, key, data[key])
            );
        }

        return [];
    }
}
