import { describe, it, expect } from 'vitest';
import { listRecordings, buildAudioManifest } from '../scripts/lib/audio-manifest.js';

describe('listRecordings', () => {
  it('should list a folder’s mp3 files sorted', () => {
    expect(listRecordings(['1-2b.mp3', '1-1a.mp3'])).toEqual(['1-1a.mp3', '1-2b.mp3']);
  });

  it('should leave out everything that is not an mp3, including the hidden size markers', () => {
    expect(listRecordings(['1-100a.mp3', '.1-100a.mp3.src-size', 'notes.txt'])).toEqual(['1-100a.mp3']);
  });
});

describe('buildAudioManifest', () => {
  it('should give each dictionary its number of recordings and the size of its archive', () => {
    const manifest = buildAudioManifest(
      { hotl1: ['a.mp3', 'b.mp3'], hotl2: ['c.mp3'] },
      { hotl1: 2048, hotl2: 1024 },
    );
    expect(manifest).toEqual({ hotl1: { count: 2, bytes: 2048 }, hotl2: { count: 1, bytes: 1024 } });
  });

  it('should skip a dictionary without any recording', () => {
    expect(buildAudioManifest({ empty: [] }, { empty: 22 })).toEqual({});
  });
});
