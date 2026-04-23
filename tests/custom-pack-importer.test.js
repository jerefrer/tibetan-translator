import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @tauri-apps/api/core BEFORE importing the service
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invokeMock(...args) }));

// Mock platform detection
vi.mock('../src/config/platform.js', () => ({
  isTauri: () => true,
  supportsModularPacks: () => true,
}));

import { CustomPackImporter } from '../src/services/custom-pack-importer.js';

describe('CustomPackImporter', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns the installed pack on success', async () => {
    invokeMock.mockResolvedValue({ id: 'custom-x', manifest: { name: 'X' } });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('installed');
    expect(result.pack.id).toBe('custom-x');
    expect(invokeMock).toHaveBeenCalledWith('install_custom_pack', {
      filePath: '/path/to/x.tibdict',
      force: false,
    });
  });

  it('classifies schema errors as incompatible', async () => {
    invokeMock.mockRejectedValue({ code: 'schema', message: 'schema version mismatch' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('incompatible');
  });

  it('classifies format errors as notADictionary', async () => {
    invokeMock.mockRejectedValue({ code: 'format', message: 'missing manifest' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('error');
    expect(result.errorKind).toBe('notADictionary');
  });

  it('classifies corrupt errors as corrupt', async () => {
    invokeMock.mockRejectedValue({ code: 'corrupt', message: 'bad zip' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.errorKind).toBe('corrupt');
  });

  it('returns status=conflict when the pack already exists', async () => {
    invokeMock.mockRejectedValue({ code: 'conflict', message: 'pack already installed' });
    const result = await CustomPackImporter.install('/path/to/x.tibdict');
    expect(result.status).toBe('conflict');
  });

  it('forces install when force=true is passed', async () => {
    invokeMock.mockResolvedValue({ id: 'custom-x', manifest: { name: 'X' } });
    await CustomPackImporter.install('/path/to/x.tibdict', { force: true });
    expect(invokeMock).toHaveBeenCalledWith('install_custom_pack', {
      filePath: '/path/to/x.tibdict',
      force: true,
    });
  });
});
