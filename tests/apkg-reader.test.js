import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readApkgNotes } from '../build/lib/apkg-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../INALCO_L1_voca.apkg');

describe('readApkgNotes', () => {
  it('returns an array of [field0, field1] note pairs from a real APKG', async () => {
    const notes = await readApkgNotes(FIXTURES);
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(Array.isArray(n)).toBe(true);
      expect(n.length).toBe(2);
      expect(typeof n[0]).toBe('string');
      expect(typeof n[1]).toBe('string');
    }
    // First entry of INALCO_L1_voca is "je ; moi" → "ང་།"
    const first = notes.find(([a, b]) => a.startsWith('je'));
    expect(first).toBeDefined();
    expect(first[1]).toContain('ང'); // Tibetan NGA
  });

  it('rejects when given a non-existent file', async () => {
    await expect(readApkgNotes('/does/not/exist.apkg')).rejects.toThrow();
  });
});
