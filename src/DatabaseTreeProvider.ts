import * as vscode from "vscode";
import { DatabaseService } from "./DatabaseService";

/**
 * Types of items shown in the tree view.
 */
export type ItemType = "namespace" | "entry" | "property";

/**
 * Tree item representing a namespace, a top-level key, or a nested property.
 */
export class DatabaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly itemType: ItemType,
        public readonly namespace?: string,
        public readonly keyPath?: string[], // Path to the value (e.g. ["myKey", "subKey"])
        public readonly value?: unknown
    ) {
        super(
            label,
            itemType === "namespace" || (typeof value === "object" && value !== null)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        const isObject = typeof value === "object" && value !== null;
        
        if (itemType === "namespace") {
            this.contextValue = "namespace";
            this.iconPath = new vscode.ThemeIcon("database");
            this.tooltip = `Namespace: ${label}`;
        } else {
            this.contextValue = isObject ? "object" : "leaf";
            this.iconPath = isObject 
                ? new vscode.ThemeIcon("symbol-class") 
                : new vscode.ThemeIcon("symbol-field");
            
            this.description = this.formatValue(value);
            this.tooltip = `${label} = ${this.formatValue(value)}`;
        }
    }

    private formatValue(value: unknown): string {
        if (value === null || value === undefined) {
            return "null";
        }
        if (Array.isArray(value)) {
            return `Array(${value.length})`;
        }
        if (typeof value === "object") {
            return "{...}";
        }
        return String(value);
    }
}

/**
 * TreeDataProvider for the DBAPI database explorer.
 * Supports infinite nesting (Namespace > Key > SubKey > ...)
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

        // 1. Root level: Show Namespaces
        if (!element) {
            return this.dbService.getNamespaces().map(
                (ns) => new DatabaseTreeItem(ns, "namespace", ns)
            );
        }

        // 2. Namespace level: Show top-level keys
        if (element.itemType === "namespace" && element.namespace) {
            const data = this.dbService.getNamespaceData(element.namespace);
            const keys = Object.keys(data).sort();
            return keys.map(
                (key) =>
                    new DatabaseTreeItem(
                        key, 
                        "entry", 
                        element.namespace, 
                        [key], 
                        data[key]
                    )
            );
        }

        // 3. Nested level: Show properties of objects/tables
        if (element.value && typeof element.value === "object" && element.namespace && element.keyPath) {
            const obj = element.value as Record<string, unknown>;
            const keys = Object.keys(obj).sort();
            
            return keys.map(
                (key) => {
                    const newPath = [...(element.keyPath || []), key];
                    return new DatabaseTreeItem(
                        key,
                        "property",
                        element.namespace,
                        newPath,
                        obj[key]
                    );
                }
            );
        }

        return [];
    }
}
