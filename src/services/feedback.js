/**
 * Feedback service
 *
 * Where feedback goes and how to send it: a mailto: link carrying the app's
 * version and platform, and the bare address for those who have no mail
 * client (copied with copy-service's writeToClipboard).
 */

import UpdateService from './update-service';
import { getPlatformType, isTauri } from '../config/platform';

export const FEEDBACK_ADDRESS = 'feedback@tibetantoolbox.org';

const PLATFORM_LABELS = {
  web: 'Web',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
};

export function platformLabel() {
  const type = getPlatformType();
  return PLATFORM_LABELS[type] || type;
}

/**
 * @param {{ version: string|null, platform: string }} info
 * @returns {string} A mailto: URL; the body leaves room to write above a
 *   signature that says which app this comes from
 */
export function feedbackMailto({ version, platform }) {
  const subject = 'Tibetan Translator feedback';
  const app = version ? `Tibetan Translator ${version}` : 'Tibetan Translator (web)';
  const body = ['', '', '', '—', app, `Platform: ${platform}`].join('\n');
  return `mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Open the mail client on a new message to the feedback address. */
export async function openFeedbackMail() {
  const version = isTauri() ? await UpdateService.getVersion() : null;
  const url = feedbackMailto({ version, platform: platformLabel() });
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.location.href = url;
  }
}
