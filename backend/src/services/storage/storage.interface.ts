import { Readable } from 'node:stream';

export interface StorageDriver {
    save(key: string, buffer: Buffer, mimeType: string): Promise<string>;
    getStream(key: string): Promise<Readable>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
}
