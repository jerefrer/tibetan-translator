<script>
import { convertWylieInText } from '../../utils';
import { mayNeedLegacyRepair } from '../../services/legacy-to-unicode';
import { UiButton, UiIcon, UiTextField } from '../../ui';

// The Reader's text area, with the rules of the former Split page:
// Wylie converts when Space or a tsheg is released, Space types a tsheg,
// Shift+Space a real space (a word break), Ctrl/Cmd+Enter splits, a paste is
// converted (and repaired when set in a pre-Unicode font) and split.
//
// It is a <UiTextField multiline> rather than <UiTibetanField>: that one turns
// spaces into tshegs and drops trailing spaces, and here the spaces are the
// word breaks.
//
// v-model is the text. Emits `split` ({ pasted }) when the text should be cut
// into words: `pasted` says the text was just pasted, so its spaces are not
// the user's word breaks. `paste` is the Paste button (the page reads the
// clipboard); `clear` the Clear button.
export default {
  name: 'ReaderEditor',
  components: { UiButton, UiIcon, UiTextField },
  props: {
    modelValue: { type: String, default: '' },
    splitting: { type: Boolean, default: false },
    pasting: { type: Boolean, default: false },
    isMobile: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'split', 'paste', 'clear'],
  computed: {
    hasText() {
      return !!this.modelValue.trim();
    },
  },
  beforeUnmount() {
    clearTimeout(this._pasteTimer);
  },
  methods: {
    setText(text) {
      this.$emit('update:modelValue', text);
    },
    convertWylie(text) {
      return convertWylieInText(text, {
        normalizeTrailingPunctuation: false,
        normalizeMultipleTshegs: true,
        preserveWhitespace: true,
      });
    },
    onKeydown(event) {
      // Ctrl/Cmd+Enter: split
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.$emit('split', { pasted: false });
        return;
      }
      // Space without Shift types a tsheg instead
      if (event.key === ' ' && !event.shiftKey) {
        event.preventDefault();
        const textarea = event.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = this.modelValue || '';
        this.setText(text.substring(0, start) + '་' + text.substring(end));
        this.$nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        });
      }
      // Shift+Space: a real space, the browser's own
    },
    onKeyup(event) {
      // Convert Wylie on Space or a tsheg
      if (event.key && event.key.match(/[་ ]/)) {
        this.setText(this.convertWylie(this.modelValue));
      }
    },
    async onPaste(event) {
      const clipboard = {
        text: event.clipboardData?.getData('text/plain') || '',
        html: event.clipboardData?.getData('text/html') || '',
      };

      // A passage set in a pre-Unicode Tibetan font arrives as Latin gibberish,
      // and repairing it needs the markup, which the textarea would have thrown
      // away by the time the timeout below runs. Take over the insertion only
      // then; every other paste keeps the browser's own.
      if (mayNeedLegacyRepair(clipboard)) {
        event.preventDefault();
        const start = event.target.selectionStart;
        const end = event.target.selectionEnd;
        const { convertLegacyPaste } = await import('../../services/legacy-to-unicode');
        const repaired = (await convertLegacyPaste(clipboard)) || clipboard.text;
        const current = this.modelValue || '';
        this.setText(this.convertWylie(current.substring(0, start) + repaired + current.substring(end)));
        await this.$nextTick();
        this.$emit('split', { pasted: true });
        return;
      }

      // Wait for the paste to complete, convert Wylie, then split
      clearTimeout(this._pasteTimer);
      this._pasteTimer = setTimeout(async () => {
        this.setText(this.convertWylie(this.modelValue));
        await this.$nextTick();
        this.$emit('split', { pasted: true });
      }, 50);
    },
    // Text from the Paste button, inserted at the caret as a paste would be
    insertAtCaret(text) {
      const textarea = this.textareaElement();
      const current = this.modelValue || '';
      const start = textarea && document.activeElement === textarea ? textarea.selectionStart : current.length;
      const end = textarea && document.activeElement === textarea ? textarea.selectionEnd : current.length;
      this.setText(this.convertWylie(current.substring(0, start) + text + current.substring(end)));
    },
    textareaElement() {
      return this.$refs.field?.$refs.input || null;
    },
    focus() {
      this.$refs.field?.focus();
    },
  },
};
</script>

<template>
  <div class="reader-editor" :class="{ 'is-phone': isMobile }">
    <ui-text-field
      ref="field"
      :model-value="modelValue"
      multiline
      tibetan
      class="reader-editor__field"
      :rows="isMobile ? 5 : 6"
      placeholder="Paste or type Tibetan text"
      aria-label="Tibetan text"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      data-testid="reader-editor"
      @update:model-value="setText"
      @paste="onPaste"
      @keydown="onKeydown"
      @keyup="onKeyup"
    />
    <div class="reader-editor__actions">
      <p v-if="!isMobile" class="reader-editor__hint">
        Space types a tsheg, Shift+Space breaks words. Wylie becomes Tibetan as you type.
      </p>
      <ui-button
        v-if="hasText"
        variant="ghost"
        class="reader-editor__clear"
        data-testid="reader-editor-clear"
        @click="$emit('clear')"
      >Clear</ui-button>
      <ui-button
        variant="outline"
        :loading="pasting"
        data-testid="reader-paste"
        @click="$emit('paste')"
      >Paste</ui-button>
      <ui-button
        :disabled="!hasText"
        :loading="splitting"
        data-testid="reader-split"
        @click="$emit('split', { pasted: false })"
      >
        <ui-icon v-if="!splitting" name="scissors" :size="16" />
        Split
      </ui-button>
    </div>
  </div>
</template>

<style scoped>
.reader-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* The space above and below sits inside the textarea, which clips what
   overflows it: vowels like ི rise above the first line */
.reader-editor__field :deep(.ui-field__control) {
  align-items: stretch;
  padding: 0 var(--space-4);
  border-radius: var(--radius-xl);
}
.reader-editor__field :deep(.ui-field__input) {
  min-height: 12rem;
  resize: vertical;
  padding: var(--space-3) 0;
  font-size: var(--text-reader-word);
  line-height: 1.7;
}
.reader-editor__field :deep(.ui-field__input::placeholder) {
  font-family: var(--font-ui);
  font-size: var(--text-md);
  line-height: 2.4;
}

.reader-editor__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}
.reader-editor__hint {
  flex: 1;
  margin: 0;
  font-size: var(--text-sm);
  color: var(--muted);
}
.reader-editor__actions :deep(.ui-button) {
  gap: 6px;
}
.reader-editor__clear {
  color: var(--muted);
}

.reader-editor.is-phone .reader-editor__field :deep(.ui-field__input) {
  min-height: 9rem;
  font-size: var(--text-tibetan-lg);
}
.reader-editor.is-phone .reader-editor__actions :deep(.ui-button) {
  height: 2.75rem;
  font-size: var(--text-base);
}
</style>
