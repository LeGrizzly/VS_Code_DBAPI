import * as vscode from "vscode";

interface MethodDef {
    label: string;
    detail: string;
    doc: string;
    snippet: string;
}

const DBAPI_METHODS: MethodDef[] = [
    {
        label: "setValue",
        detail: "(namespace, key, value) → boolean, string|nil",
        doc:
            "Stores a value in the database.\n\n" +
            "**Parameters:**\n" +
            "- `namespace` — Your mod name (e.g. `\"FS25_MyMod\"`)\n" +
            "- `key` — The key to store\n" +
            "- `value` — The value (string, number, boolean, or table)\n\n" +
            "**Returns:** `true` on success, or `false` + error message.\n\n" +
            "**Example:**\n" +
            "```lua\n" +
            'local ok, err = DBAPI.setValue("FS25_MyMod", "level", 5)\n' +
            "if not ok then\n" +
            '    print("Error: " .. tostring(err))\n' +
            "end\n" +
            "```",
        snippet: 'setValue("${1:namespace}", "${2:key}", ${3:value})',
    },
    {
        label: "getValue",
        detail: "(namespace, key) → any|nil, string|nil",
        doc:
            "Retrieves a value from the database.\n\n" +
            "**Parameters:**\n" +
            "- `namespace` — Your mod name\n" +
            "- `key` — The key to retrieve\n\n" +
            "**Returns:** The value or `nil`, and an optional error message.\n\n" +
            "**Example:**\n" +
            "```lua\n" +
            'local level, err = DBAPI.getValue("FS25_MyMod", "level")\n' +
            "if level then\n" +
            '    print("Level: " .. tostring(level))\n' +
            "end\n" +
            "```",
        snippet: 'getValue("${1:namespace}", "${2:key}")',
    },
    {
        label: "deleteValue",
        detail: "(namespace, key) → boolean, string|nil",
        doc:
            "Deletes a key from the database.\n\n" +
            "**Parameters:**\n" +
            "- `namespace` — Your mod name\n" +
            "- `key` — The key to delete\n\n" +
            "**Returns:** `true` on success, or `false` + error message.\n\n" +
            "**Example:**\n" +
            "```lua\n" +
            'local ok, err = DBAPI.deleteValue("FS25_MyMod", "oldKey")\n' +
            "if not ok then\n" +
            '    print("Error: " .. tostring(err))\n' +
            "end\n" +
            "```",
        snippet: 'deleteValue("${1:namespace}", "${2:key}")',
    },
    {
        label: "listKeys",
        detail: "(namespace) → table|nil, string|nil",
        doc:
            "Lists all keys in a namespace.\n\n" +
            "**Parameters:**\n" +
            "- `namespace` — Your mod name\n\n" +
            "**Returns:** A sorted array of key names, or `nil` + error message.\n\n" +
            "**Example:**\n" +
            "```lua\n" +
            'local keys, err = DBAPI.listKeys("FS25_MyMod")\n' +
            "if keys then\n" +
            "    for _, key in ipairs(keys) do\n" +
            '        print("Key: " .. key)\n' +
            "    end\n" +
            "end\n" +
            "```",
        snippet: 'listKeys("${1:namespace}")',
    },
    {
        label: "isReady",
        detail: "() → boolean",
        doc:
            "Returns `true` if the database is initialized and ready to use.\n\n" +
            "**Example:**\n" +
            "```lua\n" +
            "if DBAPI.isReady() then\n" +
            '    print("Database is ready!")\n' +
            "end\n" +
            "```",
        snippet: "isReady()",
    },
    {
        label: "getVersion",
        detail: "() → string",
        doc:
            'Returns the API version string (e.g. `"1.0.0"`).\n\n' +
            "**Example:**\n" +
            "```lua\n" +
            'print("DBAPI version: " .. DBAPI.getVersion())\n' +
            "```",
        snippet: "getVersion()",
    },
];

export class DBAPICompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] | undefined {
        const linePrefix = document
            .lineAt(position)
            .text.substring(0, position.character);

        if (!linePrefix.endsWith("DBAPI.")) {
            return undefined;
        }

        return DBAPI_METHODS.map((m) => {
            const item = new vscode.CompletionItem(
                m.label,
                vscode.CompletionItemKind.Method
            );
            item.detail = `DBAPI.${m.label}${m.detail}`;
            item.documentation = new vscode.MarkdownString(m.doc);
            item.documentation.isTrusted = true;
            item.insertText = new vscode.SnippetString(m.snippet);
            // Keep DBAPI. completions at the top of the list
            item.sortText = `0_${m.label}`;
            item.filterText = `DBAPI.${m.label}`;
            return item;
        });
    }
}
