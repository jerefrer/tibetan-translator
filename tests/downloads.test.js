/**
 * Cancelling a download: the scans, the recordings and the packs are all
 * cancelled through one Tauri command, keyed by what is downloaded, and a
 * cancelled download rejects with "cancelled" rather than failing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

import { cancelDownload, wasCancelled } from '../src/services/downloads'
import { cancelScanDownload, isScanDownloaded } from '../src/services/scan-service'
import { cancelAudioDownload } from '../src/services/audio-service'

beforeEach(() => {
  invoke.mockReset()
  window.__TAURI_INTERNALS__ = {}
})

afterEach(() => {
  delete window.__TAURI_INTERNALS__
})

describe('downloads', () => {
  it('should ask the app to cancel the download of a key', async () => {
    await cancelDownload('pack:sanskrit-academic')
    expect(invoke).toHaveBeenCalledWith('cancel_download', { key: 'pack:sanskrit-academic' })
  })

  it('should tell a cancelled download from a failed one', () => {
    expect(wasCancelled('cancelled')).toBe(true)
    expect(wasCancelled(new Error('cancelled'))).toBe(true)
    expect(wasCancelled('connection reset')).toBe(false)
    expect(wasCancelled(new Error('disk full'))).toBe(false)
    expect(wasCancelled(undefined)).toBe(false)
  })

  it('should cancel a scan download by its scan id', async () => {
    await cancelScanDownload('jaeschke')
    expect(invoke).toHaveBeenCalledWith('cancel_download', { key: 'scan:jaeschke' })
  })

  it('should cancel an audio download by its audio id', async () => {
    await cancelAudioDownload('hotl1')
    expect(invoke).toHaveBeenCalledWith('cancel_download', { key: 'audio:hotl1' })
  })

  it('should check that every page of a scan is on the device, not just one', async () => {
    invoke.mockResolvedValue(true)
    await isScanDownloaded('jaeschke')
    // Jäschke's pages 3 to 697
    expect(invoke).toHaveBeenCalledWith('check_scan_downloaded', { scanId: 'jaeschke', expectedCount: 695 })
  })
})
