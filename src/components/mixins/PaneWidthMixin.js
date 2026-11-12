/**
 * PaneWidthMixin
 *
 * The width the user gave a pane by dragging its divider (UiResizeHandle),
 * kept in storage and applied as a CSS variable on the page.
 *
 * Usage:
 *   mixins: [PaneWidthMixin({ storageKey: 'readerPanelWidth', cssVariable: '--reader-panel-width', min: 320, reserve: 400 })]
 *   <section :style="paneWidthStyle"> ... <ui-resize-handle :model-value="paneWidth" @update:model-value="setPaneWidth" @reset="setPaneWidth(null)" />
 *
 * Provides:
 *   - paneWidth: the width in px, or null while the stylesheet's default holds
 *   - paneWidthStyle: the CSS variable, never wider than what leaves `reserve`
 *     px to the rest of the page nor narrower than `min`, so a width chosen in
 *     a large window still fits a smaller one
 *   - setPaneWidth(width): sets and stores it (null goes back to the default)
 */
import Storage from '../../services/storage';

export default function PaneWidthMixin({ storageKey, cssVariable, min, reserve }) {
  return {
    data() {
      return { paneWidth: Storage.get(storageKey) };
    },
    computed: {
      paneWidthStyle() {
        if (!this.paneWidth) return {};
        return { [cssVariable]: `max(${min}px, min(${this.paneWidth}px, 100% - ${reserve}px))` };
      },
    },
    methods: {
      setPaneWidth(width) {
        this.paneWidth = width;
        Storage.set(storageKey, width);
      },
    },
  };
}
