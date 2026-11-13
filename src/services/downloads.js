// Cancelling a download. The scans, the recordings and the packs are all
// cancelled through one command, keyed by what is downloaded: `scan:<scanId>`,
// `audio:<audioId>`, `pack:<packId>` (src-tauri/src/downloads.rs). A cancelled
// download leaves nothing behind and rejects with CANCELLED, which the screens
// tell from a failure.

export const CANCELLED = 'cancelled';

/** Whether a download's rejection is a cancel (Tauri rejects with the string). */
export function wasCancelled(error) {
  return error === CANCELLED || error?.message === CANCELLED;
}

export async function cancelDownload(key) {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('cancel_download', { key });
}
