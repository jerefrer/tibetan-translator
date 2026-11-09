import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';

const getAudioUrl = vi.hoisted(() => vi.fn());
vi.mock('../src/services/audio-service', () => ({ getAudioUrl }));

import Decorator from '../src/services/decorator';
import AudioPlayerService from '../src/services/audio-player-service';

const played = [];

class FakeAudio {
  constructor(src) {
    this.src = src || '';
    this.paused = true;
    this.currentTime = 0;
    played.push(this);
  }
  addEventListener() {}
  play() {
    this.paused = false;
    this.playedSrc = this.src;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

beforeAll(() => {
  AudioPlayerService.initialize();
});

beforeEach(() => {
  played.length = 0;
  getAudioUrl.mockReset();
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  AudioPlayerService.stopCurrentAudio();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Decorator.prettify', () => {
  it('should name the dictionary and the mp3 a [sound:] marker refers to', () => {
    const html = Decorator.prettify('Hello [sound: 1-100a.wav]', 'hotl1');
    expect(html).toContain('data-audio-id="hotl1"');
    expect(html).toContain('data-audio-file="1-100a.mp3"');
  });
});

describe('audio player', () => {
  function renderPlayer(file = '1-100a.mp3') {
    document.body.innerHTML += Decorator.prettify(`[sound: ${file}]`, 'hotl1');
    return document.body.querySelectorAll('.audio-play-btn');
  }

  it('should play the recording from wherever the audio service says it is', async () => {
    getAudioUrl.mockResolvedValue('data:audio/mpeg;base64,AAA');
    const [button] = renderPlayer();

    button.click();
    await flushPromises();

    expect(getAudioUrl).toHaveBeenCalledWith('hotl1', '1-100a.mp3');
    expect(played).toHaveLength(1);
    expect(played[0].playedSrc).toBe('data:audio/mpeg;base64,AAA');
  });

  it('should not start a recording whose player was left before its location arrived', async () => {
    let resolveFirst;
    getAudioUrl.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    getAudioUrl.mockResolvedValueOnce('https://example.org/second.mp3');
    renderPlayer('first.mp3');
    const [first, second] = renderPlayer('second.mp3');

    first.click();
    second.click();
    await flushPromises();
    resolveFirst('https://example.org/first.mp3');
    await flushPromises();

    expect(played[0].playedSrc).toBeUndefined();
    expect(played[1].playedSrc).toBe('https://example.org/second.mp3');
  });
});
