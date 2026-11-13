<script>
import { open } from '@tauri-apps/plugin-dialog';
import ResizeService from '../services/resize-service';
import { UiButton, UiDialog, UiIcon } from '../ui';

export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xls', 'ods', 'csv', 'tsv'];
const SPREADSHEET = new RegExp(`\\.(${SPREADSHEET_EXTENSIONS.join('|')})$`, 'i');

// Where a spreadsheet is brought into a glossary: a large zone to drop it on
// (HTML5 drag and drop: Tauri's own is off, see tauri.conf.json), or a click
// on it for the file picker. On a phone, where nothing is dragged, the zone
// is the picker's button.
//
// Emits `file` (a dropped File) or `path` (the picker's choice), then closes.
export default {
  name: 'SpreadsheetDropDialog',
  components: { UiButton, UiDialog, UiIcon },
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: 'Import a spreadsheet' },
  },
  emits: ['update:modelValue', 'file', 'path'],
  data() {
    return {
      // dragenter / dragleave also fire for the zone's children: count them
      dragDepth: 0,
      rejected: '',
      isPhone: ResizeService.isMobile(),
    };
  },
  computed: {
    over() {
      return this.dragDepth > 0;
    },
  },
  watch: {
    modelValue(open) {
      if (open) {
        this.dragDepth = 0;
        this.rejected = '';
      }
    },
  },
  methods: {
    close() {
      this.$emit('update:modelValue', false);
    },
    onEnter() {
      this.dragDepth++;
    },
    onLeave() {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
    },
    onDrop(event) {
      // The page behind listens for drops on the window too
      event.stopPropagation();
      this.dragDepth = 0;
      const files = Array.from(event.dataTransfer?.files || []);
      const file = files.find((candidate) => SPREADSHEET.test(candidate.name));
      if (!file) {
        this.rejected = files[0] ? `${files[0].name} is not a spreadsheet.` : '';
        return;
      }
      this.$emit('file', file);
      this.close();
    },
    async choose() {
      let path;
      try {
        path = await open({
          multiple: false,
          filters: [{ name: 'Spreadsheets', extensions: SPREADSHEET_EXTENSIONS }],
        });
      } catch (error) {
        console.error('[SpreadsheetDropDialog] file picker failed:', error);
        this.rejected = 'The file picker could not open.';
        return;
      }
      if (!path) return;
      this.$emit('path', path);
      this.close();
    },
  },
};
</script>

<template>
  <ui-dialog :model-value="modelValue" :title="title" :max-width="560" @update:model-value="$emit('update:modelValue', $event)">
    <button
      type="button"
      class="drop-zone"
      :class="{ 'is-over': over }"
      data-testid="drop-zone"
      @click="choose"
      @dragenter.prevent="onEnter"
      @dragover.prevent
      @dragleave="onLeave"
      @drop.prevent="onDrop"
    >
      <ui-icon name="file-spreadsheet" :size="36" :stroke-width="1.6" class="drop-zone__icon" />
      <template v-if="isPhone">
        <strong class="drop-zone__title">Choose a spreadsheet</strong>
      </template>
      <template v-else>
        <strong class="drop-zone__title">{{ over ? 'Drop it to import it' : 'Drop a spreadsheet here' }}</strong>
        <span class="drop-zone__hint">or click to choose a file</span>
      </template>
      <span v-if="rejected" class="drop-zone__error" role="alert">{{ rejected }}</span>
    </button>
    <p class="drop-note">
      Excel, OpenDocument, CSV or TSV. One row per entry: the Tibetan in one
      column, its definition in another. You check what will be added before
      anything is written.
    </p>
    <template #actions>
      <ui-button variant="ghost" @click="close">Cancel</ui-button>
    </template>
  </ui-dialog>
</template>

<style scoped>
.drop-zone {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 100%;
  min-height: 13rem;
  padding: var(--space-6);
  border: 2px dashed var(--line-strong);
  border-radius: var(--radius-card);
  background: var(--bg-quiet);
  font: inherit;
  color: var(--ink);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.drop-zone:hover {
  border-color: var(--accent-line);
}
.drop-zone.is-over {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.drop-zone:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.drop-zone__icon {
  margin-bottom: var(--space-2);
  color: var(--accent);
}
.drop-zone__title {
  font-size: var(--text-md);
  font-weight: 600;
}
.drop-zone__hint {
  font-size: var(--text-sm);
  color: var(--muted);
}
.drop-zone__error {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--danger-ink);
}
.drop-note {
  margin: var(--space-3) 0 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--muted);
}
@media (prefers-reduced-motion: reduce) {
  .drop-zone {
    transition: none;
  }
}
</style>
