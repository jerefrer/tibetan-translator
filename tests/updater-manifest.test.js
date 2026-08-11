import { describe, it, expect } from 'vitest';
import {
  REQUIRED_PLATFORMS,
  missingPlatforms,
  describeManifest,
} from '../scripts/lib/updater-manifest.js';

const manifestWith = (platforms) => ({
  version: '1.9.2',
  platforms: Object.fromEntries(platforms.map((p) => [p, { url: 'x', signature: 'y' }])),
});

const complete = manifestWith([
  'darwin-aarch64',
  'darwin-aarch64-app',
  'darwin-x86_64',
  'darwin-x86_64-app',
  'linux-x86_64',
  'linux-x86_64-appimage',
  'linux-x86_64-deb',
  'linux-x86_64-rpm',
  'windows-x86_64',
  'windows-x86_64-msi',
  'windows-x86_64-nsis',
]);

describe('missingPlatforms', () => {
  it('reports nothing for a complete manifest', () => {
    expect(missingPlatforms(complete)).toEqual([]);
  });

  it('catches the exact gap that shipped in 1.9.2', () => {
    // The macOS x64 job died after uploading its binaries but before writing
    // its manifest entry, so Intel Macs were never offered the update.
    const partial = manifestWith([
      'darwin-aarch64',
      'darwin-aarch64-app',
      'linux-x86_64',
      'windows-x86_64',
      'windows-x86_64-msi',
    ]);
    expect(missingPlatforms(partial)).toEqual(['darwin-x86_64']);
  });

  it('reports every missing platform, in the required order', () => {
    expect(missingPlatforms(manifestWith(['linux-x86_64']))).toEqual([
      'darwin-aarch64',
      'darwin-x86_64',
      'windows-x86_64',
    ]);
  });

  it('does not accept a format variant in place of its canonical key', () => {
    const variantOnly = manifestWith([
      'darwin-aarch64',
      'darwin-x86_64-app',
      'linux-x86_64',
      'windows-x86_64',
    ]);
    expect(missingPlatforms(variantOnly)).toEqual(['darwin-x86_64']);
  });

  it('treats an empty or malformed manifest as missing everything', () => {
    expect(missingPlatforms({ version: '1.9.2', platforms: {} })).toEqual(REQUIRED_PLATFORMS);
    expect(missingPlatforms({})).toEqual(REQUIRED_PLATFORMS);
    expect(missingPlatforms(null)).toEqual(REQUIRED_PLATFORMS);
  });

  it('honours a custom required list', () => {
    expect(missingPlatforms(complete, ['darwin-x86_64', 'freebsd-x86_64'])).toEqual([
      'freebsd-x86_64',
    ]);
  });
});

describe('describeManifest', () => {
  it('lists the platforms present and omits a missing section when complete', () => {
    const text = describeManifest(complete);
    expect(text).toContain('version: 1.9.2');
    expect(text).toContain('platforms present (11):');
    expect(text).toContain('  - darwin-x86_64');
    expect(text).not.toContain('MISSING');
  });

  it('spells out what is missing', () => {
    const text = describeManifest(manifestWith(['darwin-aarch64']));
    expect(text).toContain('MISSING (3):');
    expect(text).toContain('  - darwin-x86_64');
    expect(text).toContain('  - linux-x86_64');
    expect(text).toContain('  - windows-x86_64');
  });

  it('survives a manifest with no version', () => {
    expect(describeManifest({ platforms: {} })).toContain('version: unknown');
  });
});
