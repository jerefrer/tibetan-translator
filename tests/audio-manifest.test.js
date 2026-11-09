import { describe, it, expect } from 'vitest';
import { buildAudioManifest } from '../scripts/lib/audio-manifest.js';

describe('buildAudioManifest', () => {
  it('should list each dictionary’s recordings sorted, with their total size', () => {
    const manifest = buildAudioManifest({
      hotl2: [
        { name: '1-2b.mp3', size: 30 },
        { name: '1-1a.mp3', size: 10 },
      ],
    });
    expect(manifest).toEqual({ hotl2: { files: ['1-1a.mp3', '1-2b.mp3'], bytes: 40 } });
  });

  it('should leave out everything that is not an mp3, including the hidden size markers', () => {
    const manifest = buildAudioManifest({
      hotl1: [
        { name: '1-100a.mp3', size: 5 },
        { name: '.1-100a.mp3.src-size', size: 5 },
        { name: 'notes.txt', size: 5 },
      ],
    });
    expect(manifest.hotl1.files).toEqual(['1-100a.mp3']);
  });

  it('should skip a dictionary without any recording', () => {
    expect(buildAudioManifest({ empty: [{ name: 'readme.md', size: 1 }] })).toEqual({});
  });
});
