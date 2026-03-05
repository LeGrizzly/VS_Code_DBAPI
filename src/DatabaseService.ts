import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Represents a namespace with its key-value data.
 */
export interface NamespaceData {
    [key: string]: unknown;
}

/**
 * DatabaseService reads and writes DBAPI JSON files on disk.
 * Each namespace is a separate file inside the DBAPI_data directory.
 */
export class DatabaseService {
    private dataPath: string | null = null;

    /**
     * Sets the path to the DBAPI_data directory.
     */
    setDataPath(dataPath: string): void {
        this.dataPath = dataPath;
    }

    getDataPath(): string | null {
        return this.dataPath;
    }

    isConfigured(): boolean {
        return this.dataPath !== null && fs.existsSync(this.dataPath);
    }

    /**
     * Lists all namespace files in the data directory.
     */
    getNamespaces(): string[] {
        if (!this.dataPath || !fs.existsSync(this.dataPath)) {
            return [];
        }

        return fs
            .readdirSync(this.dataPath)
            .filter((file) => {
                const fullPath = path.join(this.dataPath!, file);
                return fs.statSync(fullPath).isFile();
            })
            .sort();
    }

    /**
     * Reads all key-value pairs from a namespace file.
     */
    getNamespaceData(namespace: string): NamespaceData {
        if (!this.dataPath) {
            return {};
        }

        const filePath = path.join(this.dataPath, namespace);
        if (!fs.existsSync(filePath)) {
            return {};
        }

        try {
            const content = fs.readFileSync(filePath, "utf-8");
            if (content.trim() === "") {
                return {};
            }
            return JSON.parse(content) as NamespaceData;
        } catch {
            return {};
        }
    }

    /**
     * Writes the full namespace data to disk.
     */
    saveNamespaceData(namespace: string, data: NamespaceData): boolean {
        if (!this.dataPath) {
            return false;
        }

        try {
            const filePath = path.join(this.dataPath, namespace);
            fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sets a single key in a namespace.
     */
    setValue(namespace: string, key: string, value: unknown): boolean {
        const data = this.getNamespaceData(namespace);
        data[key] = value;
        return this.saveNamespaceData(namespace, data);
    }

    /**
     * Deletes a key from a namespace.
     */
    deleteKey(namespace: string, key: string): boolean {
        const data = this.getNamespaceData(namespace);
        delete data[key];
        return this.saveNamespaceData(namespace, data);
    }

    /**
     * Creates a new empty namespace file.
     */
    createNamespace(namespace: string): boolean {
        return this.saveNamespaceData(namespace, {});
    }

    /**
     * Deletes a namespace file from disk.
     */
    deleteNamespace(namespace: string): boolean {
        if (!this.dataPath) {
            return false;
        }

        try {
            const filePath = path.join(this.dataPath, namespace);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Auto-detects savegame directories containing DBAPI_data.
     * Scans the standard FS25 savegame location.
     */
    autoDetectPaths(): string[] {
        const results: string[] = [];
        const home = os.homedir();

        const basePaths = [
            path.join(home, "Documents", "My Games", "FarmingSimulator2025"),
            path.join(
                home,
                "OneDrive",
                "Documents",
                "My Games",
                "FarmingSimulator2025"
            ),
        ];

        for (const basePath of basePaths) {
            if (!fs.existsSync(basePath)) {
                continue;
            }

            try {
                const entries = fs.readdirSync(basePath);
                for (const entry of entries) {
                    if (!entry.startsWith("savegame")) {
                        continue;
                    }
                    const dbPath = path.join(basePath, entry, "DBAPI_data");
                    if (fs.existsSync(dbPath)) {
                        results.push(dbPath);
                    }
                }
            } catch {
                // Skip directories we can't read
            }
        }

        return results.sort();
    }
}
