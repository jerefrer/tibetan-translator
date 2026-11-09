import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import manifest from '../src/config/audio-manifest.json';
import {
  getAudioDictionaries,
  getAudioUrl,
  isAudioDownloaded,
  downloadAudio,
  deleteAudio,
  GITHUB_AUDIO_BASE,
  AUDIO_ARCHIVE_BASE,
} from '../src/services/audio-service';

function inApp() {
  window.__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  invoke.mockReset();
});

afterEach(() => {
  delete window.__TAURI_INTERNALS__;
});

describe('getAudioDictionaries', () => {
  it('should list every dictionary with recordings, with their count and size', async () => {
    const dictionaries = await getAudioDictionaries();
    expect(dictionaries.map((d) => d.audioId)).toEqual(['hotl1', 'hotl2', 'hotl3']);
    const hotl1 = dictionaries[0];
    expect(hotl1.label).toBe('Heart of Tibetan Language 1');
    expect(hotl1.count).toBe(manifest.hotl1.count);
    expect(hotl1.bytes).toBe(manifest.hotl1.bytes);
  });
});

describe('getAudioUrl in a browser', () => {
  it('should use the copy the dev server serves from public/', async () => {
    expect(await getAudioUrl('hotl1', '1-100a.mp3')).toBe('/audio/hotl1/1-100a.mp3');
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('getAudioUrl in the app', () => {
  beforeEach(inApp);

  it('should play the downloaded copy when there is one', async () => {
    invoke.mockResolvedValue('data:audio/mpeg;base64,AAA');
    expect(await getAudioUrl('hotl1', '1-100a.mp3')).toBe('data:audio/mpeg;base64,AAA');
    expect(invoke).toHaveBeenCalledWith('get_audio_data', { audioId: 'hotl1', fileName: '1-100a.mp3' });
  });

  it('should stream from GitHub when the recording is not downloaded', async () => {
    invoke.mockResolvedValue(null);
    expect(await getAudioUrl('hotl1', '1-100a.mp3')).toBe(`${GITHUB_AUDIO_BASE}/hotl1/1-100a.mp3`);
  });

  it('should stream from GitHub when reading the local copy fails', async () => {
    invoke.mockRejectedValue('Invalid recording name');
    expect(await getAudioUrl('hotl1', '1-100a.mp3')).toBe(`${GITHUB_AUDIO_BASE}/hotl1/1-100a.mp3`);
  });
});

describe('downloads in the app', () => {
  beforeEach(inApp);

  it('should check against the number of recordings in the manifest', async () => {
    invoke.mockResolvedValue(true);
    expect(await isAudioDownloaded('hotl2')).toBe(true);
    expect(invoke).toHaveBeenCalledWith('check_audio_downloaded', {
      audioId: 'hotl2',
      expectedCount: manifest.hotl2.count,
    });
  });

  it('should download the dictionary’s archive from the packs release', async () => {
    invoke.mockResolvedValue(undefined);
    await downloadAudio('hotl3');
    expect(invoke).toHaveBeenCalledWith('download_audio', {
      audioId: 'hotl3',
      url: `${AUDIO_ARCHIVE_BASE}/hotl3.zip`,
    });
    expect(AUDIO_ARCHIVE_BASE).toBe('https://github.com/jerefrer/tibetan-translator/releases/download/dictionary-packs');
  });

  it('should refuse a dictionary that has no recordings', async () => {
    await expect(downloadAudio('nope')).rejects.toThrow('Unknown audio id: nope');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should delete a dictionary’s recordings', async () => {
    invoke.mockResolvedValue(undefined);
    await deleteAudio('hotl1');
    expect(invoke).toHaveBeenCalledWith('delete_audio', { audioId: 'hotl1' });
  });
});

describe('downloads in a browser', () => {
  it('should report nothing as downloaded', async () => {
    expect(await isAudioDownloaded('hotl1')).toBe(false);
  });

  it('should refuse to download', async () => {
    await expect(downloadAudio('hotl1')).rejects.toThrow('only available in the desktop/mobile app');
  });
});
