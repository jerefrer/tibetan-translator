import Storage from "./storage";
import DICTIONARIES_DETAILS from "./dictionaries-details";

// GitHub raw URL base for scan images
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/christiansteinert/tibetan-dictionary/master/webapp/data/scan";

// Tauri invoke function (lazy loaded)
let invoke = null;
let _isTauri = null;

async function checkIsTauri() {
  if (_isTauri !== null) return _isTauri;

  if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    try {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      invoke = tauriInvoke;
      _isTauri = true;
    } catch (e) {
      _isTauri = false;
    }
  } else {
    _isTauri = false;
  }
  return _isTauri;
}

async function getInvoke() {
  if (invoke) return invoke;
  await checkIsTauri();
  return invoke;
}

/**
 * Get list of all scanned dictionaries with their metadata
 */
export function getScannedDictionaries() {
  const scanned = [];
  for (const [key, details] of Object.entries(DICTIONARIES_DETAILS)) {
    if (details.scanId && details.scanInfo) {
      scanned.push({
        id: key,
        scanId: details.scanId,
        label: details.label,
        linkText: details.linkText,
        pageCount: details.scanInfo.max_page - details.scanInfo.min_page + 1,
        ...details.scanInfo
      });
    }
  }
  return scanned;
}

/**
 * Get scan metadata for a dictionary
 */
export function getScanInfo(dictionaryId) {
  const details = DICTIONARIES_DETAILS[dictionaryId];
  if (!details || !details.scanId) return null;
  return {
    scanId: details.scanId,
    linkText: details.linkText,
    exactPageNumbersAvailable: details.exactPageNumbersAvailable,
    ...details.scanInfo
  };
}

/**
 * Get the URL for a scan image (online or local if downloaded)
 */
export async function getScanUrl(scanId, pageNum) {
  const isTauri = await checkIsTauri();

  if (isTauri) {
    // Check if downloaded locally first - returns base64 data URL directly
    try {
      const inv = await getInvoke();
      const dataUrl = await inv("get_scan_image_data", { scanId, pageNum });
      if (dataUrl) {
        return dataUrl;
      }
    } catch (e) {
      // Not downloaded, fall through to online URL
    }
  }

  // Return GitHub raw URL
  return `${GITHUB_RAW_BASE}/${scanId}/${pageNum}.png`;
}

/**
 * Check if a dictionary's scans are downloaded locally
 */
export async function isScanDownloaded(scanId) {
  const isTauri = await checkIsTauri();
  if (!isTauri) return false;

  try {
    const inv = await getInvoke();
    return await inv("check_scan_downloaded", { scanId });
  } catch (e) {
    return false;
  }
}

/**
 * Get download status for all scanned dictionaries
 */
export async function getDownloadStatuses() {
  const scanned = getScannedDictionaries();
  const statuses = {};

  for (const dict of scanned) {
    statuses[dict.scanId] = {
      downloaded: await isScanDownloaded(dict.scanId),
      progress: getDownloadProgress(dict.scanId)
    };
  }

  return statuses;
}

// Track download progress in memory
const downloadProgress = {};

/**
 * Get current download progress for a scan (0-100 or null if not downloading)
 */
export function getDownloadProgress(scanId) {
  return downloadProgress[scanId] || null;
}

/**
 * Download all scan images for a dictionary
 */
export async function downloadScan(scanId, onProgress) {
  const isTauri = await checkIsTauri();
  if (!isTauri) {
    throw new Error("Downloads only available in desktop/mobile app");
  }

  // Find the dictionary info
  const scanned = getScannedDictionaries();
  const dict = scanned.find(d => d.scanId === scanId);
  if (!dict) {
    throw new Error(`Unknown scan ID: ${scanId}`);
  }

  downloadProgress[scanId] = 0;

  try {
    const inv = await getInvoke();
    await inv("download_scan_images", {
      scanId,
      baseUrl: GITHUB_RAW_BASE,
      minPage: dict.min_page,
      maxPage: dict.max_page
    });

    downloadProgress[scanId] = 100;
    if (onProgress) onProgress(100);

    // Clear progress after a moment
    setTimeout(() => {
      delete downloadProgress[scanId];
    }, 1000);

    return true;
  } catch (e) {
    delete downloadProgress[scanId];
    throw e;
  }
}

/**
 * Delete downloaded scan images for a dictionary
 */
export async function deleteScan(scanId) {
  const isTauri = await checkIsTauri();
  if (!isTauri) {
    throw new Error("Delete only available in desktop/mobile app");
  }

  try {
    const inv = await getInvoke();
    await inv("delete_scan", { scanId });
    return true;
  } catch (e) {
    throw e;
  }
}

/**
 * Check if we're running in Tauri (desktop/mobile app)
 */
export async function isAppMode() {
  return await checkIsTauri();
}

export default {
  getScannedDictionaries,
  getScanInfo,
  getScanUrl,
  isScanDownloaded,
  getDownloadStatuses,
  getDownloadProgress,
  downloadScan,
  deleteScan,
  isAppMode
};
