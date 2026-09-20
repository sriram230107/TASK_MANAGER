import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { StorageDriver } from './storage.interface';
import { config } from '../../config/env';

export class LocalStorageDriver implements StorageDriver {
    private baseDir: string;

    constructor(baseDir?: string) {
        this.baseDir = path.resolve(process.cwd(), baseDir || config.UPLOAD_DIR);
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Resolves a key to an absolute path, asserting it remains strictly within baseDir.
     * Throws an error on path traversal attempts (e.g. `../` or root absolute paths).
     */
    public resolvePath(key: string): string {
        // Strip leading slashes to prevent root resolution
        const cleanKey = key.replace(/^[/\\]+/, '');
        const targetPath = path.resolve(this.baseDir, cleanKey);

        // Path traversal guard: must be strictly inside baseDir
        if (!targetPath.startsWith(this.baseDir + path.sep) && targetPath !== this.baseDir) {
            throw new Error(`Access denied: Path traversal detected for key "${key}"`);
        }

        return targetPath;
    }

    async save(key: string, buffer: Buffer): Promise<string> {
        const fullPath = this.resolvePath(key);
        const parentDir = path.dirname(fullPath);

        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        await fs.promises.writeFile(fullPath, buffer);
        return key;
    }

    async getStream(key: string): Promise<Readable> {
        const fullPath = this.resolvePath(key);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${key}`);
        }
        return fs.createReadStream(fullPath);
    }

    async delete(key: string): Promise<void> {
        const fullPath = this.resolvePath(key);
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
        }
    }

    async exists(key: string): Promise<boolean> {
        const fullPath = this.resolvePath(key);
        return fs.existsSync(fullPath);
    }
}
