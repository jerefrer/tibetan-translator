import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pruneDist, UNUSED_IN_APP } from '../scripts/lib/prune-dist.js';

let outDir;

function touch(relative) {
  const file = path.join(outDir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'x');
}

const exists = (relative) => fs.existsSync(path.join(outDir, relative));

beforeEach(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-dist-'));
});

afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

describe('pruneDist', () => {
  it('should remove the dictionary packs and the web database when present', () => {
    touch('packs/core.7z');
    touch('packs/core.sqlite');
    touch('TibetanTranslator.sqlite');
    touch('database.7z.001');
    touch('database.7z.002');

    pruneDist(outDir);

    expect(exists('packs')).toBe(false);
    expect(exists('TibetanTranslator.sqlite')).toBe(false);
    expect(exists('database.7z.001')).toBe(false);
    expect(exists('database.7z.002')).toBe(false);
  });

  it('should keep the files the app loads at runtime', () => {
    touch('index.html');
    touch('audio/hotl1/1-100a.mp3');
    touch('botok-dictionary.json');
    touch('worker.sql-wasm.js');

    pruneDist(outDir);

    expect(exists('index.html')).toBe(true);
    expect(exists('audio/hotl1/1-100a.mp3')).toBe(true);
    expect(exists('botok-dictionary.json')).toBe(true);
    expect(exists('worker.sql-wasm.js')).toBe(true);
  });

  it('should succeed when none of the unused files exist', () => {
    touch('index.html');
    expect(() => pruneDist(outDir)).not.toThrow();
  });

  it('should return what it removed', () => {
    touch('packs/core.7z');
    touch('database.7z.001');
    expect(pruneDist(outDir).sort()).toEqual(['database.7z.001', 'packs']);
  });

  it('should never name anything outside the output directory', () => {
    for (const entry of UNUSED_IN_APP) {
      expect(path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')).toBe(false);
    }
  });
});
