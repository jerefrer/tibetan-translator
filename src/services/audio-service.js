/**
 * Recordings of the dictionaries that have audio (Heart of Tibetan Language).
 *
 * The app does not ship them: they play one at a time from GitHub, or from
 * the device once a dictionary's archive is downloaded for offline use (built
 * by `pnpm build:audio`). The browser build plays the copy the dev server
 * serves from public/audio.
 */

import { isTauri } from "../config/platform";
import DICTIONARIES_DETAILS from "./dictionaries-details";

// Served by GitHub from this repository's main branch. Apps already installed
// keep requesting these paths, so moving or renaming public/audio breaks
// their audio until they update.
export const GITHUB_AUDIO_BASE =
  "https://raw.githubusercontent.com/jerefrer/tibetan-translator/main/public/audio";

async function invoke(command, args) {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke(command, args);
}

// One zip per dictionary, uploaded to the release that also holds the packs.
// Installed apps download from this path too.
export const AUDIO_ARCHIVE_BASE =
  "https://github.com/jerefrer/tibetan-translator/releases/download/dictionary-packs";

// Only needed to download, so it stays out of the main bundle
async function loadManifest() {
  return (await import("../config/audio-manifest.json")).default;
}

/**
 * Dictionaries with recordings: label, number of recordings and total size
 */
export async function getAudioDictionaries() {
  const manifest = await loadManifest();
  const dictionaries = [];
  for (const details of Object.values(DICTIONARIES_DETAILS)) {
    const entry = details.audioId && manifest[details.audioId];
    if (!entry) continue;
    dictionaries.push({
      audioId: details.audioId,
      label: details.label,
      count: entry.count,
      bytes: entry.bytes,
    });
  }
  return dictionaries;
}

/**
 * Where to play a recording from: the downloaded copy when there is one,
 * GitHub otherwise
 */
export async function getAudioUrl(audioId, fileName) {
  if (!isTauri()) return `/audio/${audioId}/${fileName}`;
  try {
    const dataUrl = await invoke("get_audio_data", { audioId, fileName });
    if (dataUrl) return dataUrl;
  } catch (e) {
    console.warn("[Audio] Reading the downloaded recording failed:", e);
  }
  return `${GITHUB_AUDIO_BASE}/${audioId}/${fileName}`;
}

export async function isAudioDownloaded(audioId) {
  if (!isTauri()) return false;
  const entry = (await loadManifest())[audioId];
  if (!entry) return false;
  try {
    return await invoke("check_audio_downloaded", { audioId, expectedCount: entry.count });
  } catch (e) {
    return false;
  }
}

/**
 * Download a dictionary's archive and unpack it. Progress arrives as
 * `audio-download-progress` events ({ audio_id, downloaded, total, percent }).
 */
export async function downloadAudio(audioId) {
  if (!isTauri()) {
    throw new Error("Downloads are only available in the desktop/mobile app");
  }
  const entry = (await loadManifest())[audioId];
  if (!entry) throw new Error(`Unknown audio id: ${audioId}`);
  await invoke("download_audio", { audioId, url: `${AUDIO_ARCHIVE_BASE}/${audioId}.zip` });
}

export async function deleteAudio(audioId) {
  if (!isTauri()) {
    throw new Error("Deleting is only available in the desktop/mobile app");
  }
  await invoke("delete_audio", { audioId });
}

export default {
  getAudioDictionaries,
  getAudioUrl,
  isAudioDownloaded,
  downloadAudio,
  deleteAudio,
};
