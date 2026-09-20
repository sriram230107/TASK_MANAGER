import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sniffFileContent } from '../services/storage/magic-bytes';
import { LocalStorageDriver } from '../services/storage/local.driver';
import fs from 'node:fs';
import path from 'node:path';

describe('Storage Magic Bytes Sniffer', () => {
    it('identifies PDF documents by magic bytes', () => {
        const buffer = Buffer.from('%PDF-1.7 header and content');
        const result = sniffFileContent(buffer, 'test.pdf');
        expect(result.mimeType).toBe('application/pdf');
        expect(result.extension).toBe('pdf');
        expect(result.isAllowed).toBe(true);
        expect(result.isExecutable).toBe(false);
    });

    it('identifies PNG images by magic bytes', () => {
        const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
        const result = sniffFileContent(buffer, 'image.png');
        expect(result.mimeType).toBe('image/png');
        expect(result.isAllowed).toBe(true);
        expect(result.isExecutable).toBe(false);
    });

    it('identifies JPEG images by magic bytes', () => {
        const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
        const result = sniffFileContent(buffer, 'photo.jpg');
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.isAllowed).toBe(true);
        expect(result.isExecutable).toBe(false);
    });

    it('identifies ZIP/Office documents by magic bytes', () => {
        const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
        const result = sniffFileContent(buffer, 'report.docx');
        expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        expect(result.isAllowed).toBe(true);
        expect(result.isExecutable).toBe(false);
    });

    it('identifies UTF-8 plain text files', () => {
        const buffer = Buffer.from('Hello world! This is a plain text document.\nSecond line.');
        const result = sniffFileContent(buffer, 'notes.txt');
        expect(result.mimeType).toBe('text/plain');
        expect(result.isAllowed).toBe(true);
        expect(result.isExecutable).toBe(false);
    });

    it('detects and BLOCKS Windows PE executables (.exe / MZ header)', () => {
        const buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
        const result = sniffFileContent(buffer, 'innocent-doc.pdf'); // client spoofing as PDF!
        expect(result.isExecutable).toBe(true);
        expect(result.isAllowed).toBe(false);
        expect(result.mimeType).toBe('application/x-msdownload');
    });

    it('detects and BLOCKS Linux ELF executables', () => {
        const buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
        const result = sniffFileContent(buffer, 'payload.png');
        expect(result.isExecutable).toBe(true);
        expect(result.isAllowed).toBe(false);
    });

    it('detects and BLOCKS macOS Mach-O binaries', () => {
        const buffer = Buffer.from([0xfe, 0xed, 0xfa, 0xcf, 0x00, 0x00, 0x00, 0x01]);
        const result = sniffFileContent(buffer, 'binary.dat');
        expect(result.isExecutable).toBe(true);
        expect(result.isAllowed).toBe(false);
    });
});

describe('LocalStorageDriver Security and Operations', () => {
    const testDir = 'uploads_test_temp';
    let driver: LocalStorageDriver;

    beforeEach(() => {
        driver = new LocalStorageDriver(testDir);
    });

    afterEach(() => {
        const resolved = path.resolve(process.cwd(), testDir);
        if (fs.existsSync(resolved)) {
            fs.rmSync(resolved, { recursive: true, force: true });
        }
    });

    it('saves, checks existence, and deletes a file cleanly', async () => {
        const content = Buffer.from('%PDF-1.4 test document content');
        const key = 'test-org/documents/doc-123.pdf';
        const savedKey = await driver.save(key, content);

        expect(savedKey).toBe(key);
        expect(await driver.exists(key)).toBe(true);

        const stream = await driver.getStream(key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const readBack = Buffer.concat(chunks);
        expect(readBack.toString()).toBe(content.toString());

        await driver.delete(key);
        expect(await driver.exists(key)).toBe(false);
    });

    it('rejects path traversal attempts in key resolution and access', async () => {
        expect(() => driver.resolvePath('../../../secret.txt')).toThrow(/Path traversal detected/);
        expect(() => driver.resolvePath('..\\..\\secret.txt')).toThrow(/Path traversal detected/);
        await expect(driver.save('../../../secret.txt', Buffer.from('bad'))).rejects.toThrow(/Path traversal detected/);
        await expect(driver.getStream('../../../secret.txt')).rejects.toThrow(/Path traversal detected/);
        await expect(driver.delete('../../../secret.txt')).rejects.toThrow(/Path traversal detected/);
    });
});
