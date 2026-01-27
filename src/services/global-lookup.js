/**
 * Global Lookup Service
 *
 * Handles system-wide hotkey for looking up Tibetan text from clipboard.
 * Only available on desktop Tauri apps (macOS, Windows, Linux).
 */

import { isTauri, isMobile, isMacOS } from '../config/platform';
import Storage from './storage';

// Default hotkey: Cmd+Shift+C on Mac, Ctrl+Shift+C on Windows/Linux
const DEFAULT_HOTKEY = 'CommandOrControl+Shift+C';

// Popup window configuration
const POPUP_WIDTH = 650;
const POPUP_HEIGHT = 500;

let isInitialized = false;
let currentShortcut = null;
let onLookupCallback = null;
let popupWindow = null;

/**
 * Check if global lookup is supported on this platform
 */
export function isSupported() {
  return isTauri() && !isMobile();
}

// Re-export isMacOS from platform for backward compatibility
export { isMacOS } from '../config/platform';

/**
 * Get the currently configured hotkey
 */
export function getHotkey() {
  return Storage.get('globalLookupHotkey') || DEFAULT_HOTKEY;
}

/**
 * Set a new hotkey
 */
export function setHotkey(hotkey) {
  Storage.set('globalLookupHotkey', hotkey);
}

/**
 * Check if global lookup is enabled
 */
export function isEnabled() {
  const enabled = Storage.get('globalLookupEnabled');
  return enabled !== false; // Default to true
}

/**
 * Enable or disable global lookup
 */
export function setEnabled(enabled) {
  Storage.set('globalLookupEnabled', enabled);
}

/**
 * Check if accessibility permission is granted (macOS only)
 * Returns true on non-macOS platforms
 */
export async function checkAccessibilityPermission() {
  if (!isMacOS()) return true;

  try {
    const macPerms = await import('tauri-plugin-macos-permissions-api');
    const result = await macPerms.checkAccessibilityPermission();
    console.log('Accessibility permission check result:', result);
    return result;
  } catch (err) {
    console.error('Error checking accessibility permission:', err);
    // If we can't check, assume we have permission and let registration fail if not
    return true;
  }
}

/**
 * Request accessibility permission (macOS only)
 * This will open System Settings to the Accessibility section
 */
export async function requestAccessibilityPermission() {
  if (!isMacOS()) return true;

  try {
    const macPerms = await import('tauri-plugin-macos-permissions-api');
    await macPerms.requestAccessibilityPermission();
    return true;
  } catch (err) {
    console.error('Error requesting accessibility permission:', err);
    return false;
  }
}

/**
 * Convert a KeyboardEvent to a hotkey string format
 * Returns format like "CommandOrControl+Shift+D"
 */
export function keyEventToHotkeyString(event) {
  const parts = [];

  // Use CommandOrControl for cross-platform compatibility
  if (event.metaKey || event.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }

  // Get the key
  let key = event.key;

  // Normalize key names
  if (key.length === 1) {
    key = key.toUpperCase();
  } else {
    // Map special keys
    const keyMap = {
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      ' ': 'Space',
      'Escape': 'Escape',
      'Enter': 'Return',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Tab': 'Tab',
    };
    key = keyMap[key] || key;
  }

  // Don't include modifier keys themselves as the main key
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
    return null;
  }

  parts.push(key);

  // Must have at least one modifier
  if (parts.length < 2) {
    return null;
  }

  return parts.join('+');
}

/**
 * Show the popup window with clipboard text
 */
async function showPopupWindow(text) {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const { currentMonitor } = await import('@tauri-apps/api/window');

    // Get the pre-defined popup window by its label
    let existingWindow = await WebviewWindow.getByLabel('global-lookup-popup');
    console.log('[GlobalLookup] Existing popup window:', existingWindow);

    // Get current monitor to center the popup
    const monitor = await currentMonitor();
    let x = 100;
    let y = 100;

    if (monitor) {
      const scaleFactor = monitor.scaleFactor || 1;
      const screenWidth = monitor.size.width / scaleFactor;
      const screenHeight = monitor.size.height / scaleFactor;
      x = Math.round((screenWidth - POPUP_WIDTH) / 2);
      y = Math.round((screenHeight - POPUP_HEIGHT) / 3); // Position in upper third
    }

    if (existingWindow) {
      console.log('[GlobalLookup] Using existing popup window');
      // Window exists, position it and use the panel-aware show command
      await existingWindow.setPosition({ type: 'Physical', x: Math.round(x * (monitor?.scaleFactor || 1)), y: Math.round(y * (monitor?.scaleFactor || 1)) });
      // Use our custom show command that properly handles NSPanel key window status
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('show_lookup_panel');
      popupWindow = existingWindow;
    } else {
      console.log('[GlobalLookup] Creating new popup window');
      // Create a new popup window
      popupWindow = new WebviewWindow('global-lookup-popup', {
        url: 'popup.html',
        title: 'Tibetan Lookup',
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        x: x,
        y: y,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        focus: true,
        decorations: false,
        transparent: false,
        skipTaskbar: true,
        center: false,
        shadow: true,
      });

      popupWindow.once('tauri://error', (e) => {
        console.error('Error creating popup window:', e);
        popupWindow = null;
      });

      popupWindow.once('tauri://destroyed', () => {
        popupWindow = null;
      });
    }

  } catch (err) {
    console.error('Failed to show popup window:', err);
    // Fallback to callback if available
    if (onLookupCallback) {
      onLookupCallback(text);
    }
  }
}

/**
 * Format a hotkey string for display
 * Converts "CommandOrControl+Shift+D" to "⌘⇧D" on Mac or "Ctrl+Shift+D" on others
 */
export function formatHotkeyForDisplay(hotkey) {
  if (!hotkey) return '';

  const isMac = isMacOS();

  const parts = hotkey.split('+');
  const displayParts = parts.map(part => {
    if (isMac) {
      switch (part) {
        case 'CommandOrControl': return '⌘';
        case 'Control': return '⌃';
        case 'Alt': return '⌥';
        case 'Shift': return '⇧';
        default: return part;
      }
    } else {
      switch (part) {
        case 'CommandOrControl': return 'Ctrl';
        default: return part;
      }
    }
  });

  return isMac ? displayParts.join('') : displayParts.join('+');
}

/**
 * Initialize global lookup service
 * @param {Function} onLookup - Callback when hotkey is triggered, receives clipboard text
 */
export async function initialize(onLookup) {
  if (!isSupported()) {
    console.log('Global lookup not supported on this platform');
    return { success: false, error: 'not_supported' };
  }

  if (isInitialized) {
    console.log('Global lookup already initialized');
    return { success: true };
  }

  onLookupCallback = onLookup;

  if (isEnabled()) {
    const result = await registerShortcut(getHotkey());
    if (!result.success) {
      isInitialized = true;
      return result;
    }
  }

  isInitialized = true;
  return { success: true };
}

/**
 * Register a global shortcut
 * Returns { success: boolean, error?: string, needsPermission?: boolean }
 */
export async function registerShortcut(hotkey) {
  if (!isSupported()) {
    return { success: false, error: 'not_supported' };
  }

  try {
    // Unregister existing shortcut first
    await unregisterShortcut();

    // Check accessibility permission on macOS
    if (isMacOS()) {
      const hasPermission = await checkAccessibilityPermission();
      if (!hasPermission) {
        console.log('Accessibility permission not granted');
        return {
          success: false,
          error: 'permission_denied',
          needsPermission: true
        };
      }
    }

    const { register, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');

    // Check if already registered by another app
    const alreadyRegistered = await isRegistered(hotkey);
    if (alreadyRegistered) {
      console.log('Hotkey already registered:', hotkey);
      // It might be registered by us from a previous session, try to unregister and re-register
      try {
        const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
        await unregister(hotkey);
      } catch (e) {
        // Ignore unregister errors
      }
    }

    await register(hotkey, async (event) => {
      console.log('Global lookup hotkey event:', event);
      // Only trigger on key press, not release
      if (event.state !== 'Pressed') return;

      console.log('Global lookup hotkey triggered');
      try {
        const text = await readText();
        console.log('Clipboard text:', text);
        if (text) {
          // Show popup window with the clipboard text
          await showPopupWindow(text);
        }
      } catch (err) {
        console.error('Error reading clipboard:', err);
      }
    });

    currentShortcut = hotkey;
    console.log('Global shortcut registered:', hotkey);
    return { success: true };
  } catch (err) {
    console.error('Failed to register global shortcut:', err);
    console.error('Error message:', err.message);
    console.error('Error string:', String(err));

    const errStr = String(err).toLowerCase();
    const errMsg = (err.message || '').toLowerCase();

    // Check if it's a permission error on macOS
    if (isMacOS() && (
      errStr.includes('accessibility') ||
      errStr.includes('permission') ||
      errStr.includes('not trusted') ||
      errStr.includes('is not trusted') ||
      errMsg.includes('accessibility') ||
      errMsg.includes('permission') ||
      errMsg.includes('not trusted')
    )) {
      return {
        success: false,
        error: 'permission_denied',
        needsPermission: true
      };
    }

    return {
      success: false,
      error: err.message || String(err) || 'registration_failed'
    };
  }
}

/**
 * Unregister the current global shortcut
 */
export async function unregisterShortcut() {
  if (!currentShortcut) return;

  try {
    const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
    await unregister(currentShortcut);
    currentShortcut = null;
    console.log('Global shortcut unregistered');
  } catch (err) {
    console.error('Failed to unregister global shortcut:', err);
  }
}

/**
 * Update the hotkey
 * Returns { success: boolean, error?: string, needsPermission?: boolean }
 */
export async function updateHotkey(newHotkey) {
  setHotkey(newHotkey);

  if (isEnabled()) {
    return await registerShortcut(newHotkey);
  }
  return { success: true };
}

/**
 * Toggle global lookup on/off
 * Returns { success: boolean, error?: string, needsPermission?: boolean }
 */
export async function toggle(enabled) {
  setEnabled(enabled);

  if (enabled) {
    return await registerShortcut(getHotkey());
  } else {
    await unregisterShortcut();
    return { success: true };
  }
}

/**
 * Close the popup window if open
 */
export async function closePopup() {
  if (popupWindow) {
    try {
      await popupWindow.hide();
    } catch (e) {
      // Window might already be closed or hidden
    }
  }
}

/**
 * Cleanup - call when app is closing
 */
export async function cleanup() {
  await closePopup();
  await unregisterShortcut();
  isInitialized = false;
}

export default {
  isSupported,
  isMacOS,
  isEnabled,
  setEnabled,
  getHotkey,
  setHotkey,
  keyEventToHotkeyString,
  formatHotkeyForDisplay,
  checkAccessibilityPermission,
  requestAccessibilityPermission,
  initialize,
  registerShortcut,
  updateHotkey,
  toggle,
  closePopup,
  cleanup,
};
