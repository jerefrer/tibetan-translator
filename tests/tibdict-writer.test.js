import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { writeTibdict } from '../build/lib/tibdict-writer.js';

let tmpFile;

afterEach(() => {
  if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe('writeTibdict', () => {
  it('writes a ZIP with manifest.json and data.sqlite', async () => {
    tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.tibdict`);
    const sqlite = Buffer.from([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65]); // fake header
    const manifest = { format: 'tibdict', formatVersion: 1, id: 'x', name: 'X' };

    await writeTibdict(tmpFile, manifest, sqlite);

    const zip = new AdmZip(tmpFile);
    const names = zip.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(['data.sqlite', 'manifest.json']);

    const parsed = JSON.parse(zip.readAsText('manifest.json'));
    expect(parsed.format).toBe('tibdict');
    expect(parsed.id).toBe('x');

    expect(zip.readFile('data.sqlite').slice(0, 6).toString()).toBe('SQLite');
  });
});
