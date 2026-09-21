/**
 * Content-based file validation (magic bytes inspection).
 * Validates actual binary signatures, rejecting client-spoofed MIME types and executables.
 */

export interface SniffResult {
    mimeType: string;
    extension: string;
    isAllowed: boolean;
    isExecutable: boolean;
}

export const sniffFileContent = (buffer: Buffer, originalFilename = ''): SniffResult => {
    if (!buffer || buffer.length === 0) {
        return { mimeType: 'application/octet-stream', extension: 'bin', isAllowed: false, isExecutable: false };
    }

    // 1. Check for executable signatures (always blocked)
    // Windows PE (MZ)
    if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return { mimeType: 'application/x-msdownload', extension: 'exe', isAllowed: false, isExecutable: true };
    }
    // Linux ELF (\x7fELF)
    if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        return { mimeType: 'application/x-executable', extension: 'elf', isAllowed: false, isExecutable: true };
    }
    // macOS Mach-O
    if (buffer.length >= 4) {
        const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];
        if (
            (b0 === 0xFE && b1 === 0xED && b2 === 0xFA && (b3 === 0xCE || b3 === 0xCF)) ||
            (b0 === 0xCE && b1 === 0xFA && b2 === 0xED && b3 === 0xFE) ||
            (b0 === 0xCF && b1 === 0xFA && b2 === 0xED && b3 === 0xFE) ||
            (b0 === 0xCA && b1 === 0xFE && b2 === 0xBA && b3 === 0xBE)
        ) {
            return { mimeType: 'application/x-mach-binary', extension: 'macho', isAllowed: false, isExecutable: true };
        }
    }

    // 2. Reject HTML and SVG (script execution & XSS risk)
    const previewText = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8').trim().toLowerCase();
    if (
        previewText.includes('<html') ||
        previewText.includes('<!doctype html') ||
        previewText.includes('<script') ||
        previewText.includes('<svg') ||
        (previewText.includes('<?xml') && previewText.includes('<svg'))
    ) {
        return { mimeType: 'text/html', extension: 'html', isAllowed: false, isExecutable: false };
    }

    const lowerName = originalFilename.toLowerCase();

    // 3. Strict Allow-List: PDF, PNG, JPEG, WEBP, DOCX, DOC, TXT, CSV
    // PDF (%PDF-)
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return { mimeType: 'application/pdf', extension: 'pdf', isAllowed: true, isExecutable: false };
    }

    // PNG (\x89PNG\r\n\x1a\n)
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
    ) {
        return { mimeType: 'image/png', extension: 'png', isAllowed: true, isExecutable: false };
    }

    // JPEG (\xFF\xD8\xFF)
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { mimeType: 'image/jpeg', extension: 'jpg', isAllowed: true, isExecutable: false };
    }

    // WEBP (RIFF....WEBP)
    if (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return { mimeType: 'image/webp', extension: 'webp', isAllowed: true, isExecutable: false };
    }

    // DOCX (ZIP-based Word document, must end with .docx)
    if (
        buffer.length >= 4 &&
        buffer[0] === 0x50 && buffer[1] === 0x4B &&
        (buffer[2] === 0x03 || buffer[2] === 0x05) &&
        (buffer[3] === 0x04 || buffer[3] === 0x06)
    ) {
        if (lowerName.endsWith('.docx')) {
            return {
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                extension: 'docx',
                isAllowed: true,
                isExecutable: false
            };
        }
        // Reject non-DOCX ZIP files (e.g. raw .zip, .jar)
        return { mimeType: 'application/zip', extension: 'zip', isAllowed: false, isExecutable: false };
    }

    // DOC (Legacy Office OLE compound file, must end with .doc)
    if (
        buffer.length >= 8 &&
        buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0
    ) {
        if (lowerName.endsWith('.doc')) {
            return { mimeType: 'application/msword', extension: 'doc', isAllowed: true, isExecutable: false };
        }
        return { mimeType: 'application/octet-stream', extension: 'bin', isAllowed: false, isExecutable: false };
    }

    // Plain text / CSV check (strictly .txt and .csv only)
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
        const checkLen = Math.min(buffer.length, 1024);
        let isText = true;
        for (let i = 0; i < checkLen; i++) {
            const byte = buffer[i];
            if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
                isText = false;
                break;
            }
        }
        if (isText) {
            return {
                mimeType: lowerName.endsWith('.csv') ? 'text/csv' : 'text/plain',
                extension: lowerName.endsWith('.csv') ? 'csv' : 'txt',
                isAllowed: true,
                isExecutable: false
            };
        }
    }

    // All other formats rejected
    return {
        mimeType: 'application/octet-stream',
        extension: 'bin',
        isAllowed: false,
        isExecutable: false
    };
};

/**
 * PNG, JPEG and WEBP may display inline. Everything else, including GIF, is an attachment.
 */
export const isImageMime = (mimeType: string): boolean => {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
};
