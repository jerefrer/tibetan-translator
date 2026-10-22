<script>
import _ from 'underscore';
import UiTextField from './UiTextField.vue';
import { convertWylieInText } from '../utils';
import { mayNeedLegacyRepair } from '../services/legacy-to-unicode';

// Replaces <TibetanTextField> (a v-text-field) with the same behaviour on top
// of <UiTextField tibetan>: Wylie is converted to Tibetan when a space, a
// tsheg or Enter is typed, on Ctrl+V and on drop; a second trailing tsheg is
// refused; spaces an Android keyboard adds after Tibetan punctuation are
// removed; text pasted in a pre-Unicode Tibetan font is repaired. A pasted
// block of several lines is emitted as `paste:multiple` instead of inserted.
// Other attributes (placeholder, enterkeyhint...) reach the input itself.
export default {
  name: 'UiTibetanField',
  components: { UiTextField },
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },
    placeholder: { type: String, default: 'བོད་ཡིག་' },
    clearable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    prependIcon: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'keydown', 'clear', 'paste:multiple'],
  data() {
    return { text: this.modelValue || '' };
  },
  watch: {
    modelValue(value) {
      this.text = value || '';
    },
    text(value) {
      // Android keyboard auto-spacing: drop spaces after Tibetan punctuation
      if (value && value.match(/[་།༑༔] +$/)) {
        this.text = value.trimEnd();
      }
    },
  },
  methods: {
    input() {
      return this.$refs.field?.$refs.input;
    },
    focus() {
      this.$refs.field?.focus();
    },
    convertWylie(text) {
      return convertWylieInText(text, {
        normalizeTrailingPunctuation: true,
        normalizeMultipleTshegs: true,
        preserveWhitespace: false,
      });
    },
    onInput(value) {
      this.text = value;
      this.$emit('update:modelValue', this.text);
    },
    onKeydown(event) {
      if (event.key === '་' && _.last(this.text) === '་') event.preventDefault();
      else this.$emit('keydown', event);
    },
    convertAndEmit(event, isDropping) {
      if (this.text) this.text = this.text.replace(/  +/g, ' ');
      if (
        isDropping ||
        (event.key && event.key.match(/[་ ]/)) ||
        event.key === 'Enter' ||
        (event.ctrlKey && event.key === 'v')
      ) {
        this.text = this.convertWylie(this.text);
      }
      this.$emit('update:modelValue', this.text);
    },
    async onPaste(event) {
      event.preventDefault();
      const clipboard = {
        text: event.clipboardData.getData('text/plain'),
        html: event.clipboardData.getData('text/html'),
      };
      // Read the caret before awaiting, while the event still describes it
      const input = this.input();
      const start = input.selectionStart ?? this.text.length;
      const end = input.selectionEnd ?? this.text.length;

      let pastedText = clipboard.text;
      if (mayNeedLegacyRepair(clipboard)) {
        const { convertLegacyPaste } = await import('../services/legacy-to-unicode');
        pastedText = (await convertLegacyPaste(clipboard)) || clipboard.text;
      }

      if (pastedText.split(/[\r\n]+/).length > 1) {
        this.$emit('paste:multiple', this.convertWylie(pastedText));
        return;
      }
      const currentText = this.text || '';
      this.text = this.convertWylie(
        currentText.substring(0, start) + pastedText + currentText.substring(end)
      );
      this.$emit('update:modelValue', this.text);
      this.$nextTick(() => {
        const position = start + this.text.length - currentText.length + (end - start);
        input.setSelectionRange?.(position, position);
      });
    },
    onDrop() {
      setTimeout(() => this.convertAndEmit({}, true), 1);
    },
    onClear() {
      this.text = '';
      this.$emit('clear');
    },
  },
};
</script>

<template>
  <ui-text-field
    ref="field"
    tibetan
    :model-value="text"
    :label="label"
    :hint="hint"
    :error="error"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :loading="loading"
    :prepend-icon="prependIcon"
    data-testid="ui-tibetan-field"
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    data-form-type="other"
    data-lpignore="true"
    v-bind="$attrs"
    @update:model-value="onInput"
    @clear="onClear"
    @keydown="onKeydown"
    @keyup="convertAndEmit"
    @paste="onPaste"
    @drop="onDrop"
  >
    <template v-if="$slots.append" #append><slot name="append" /></template>
  </ui-text-field>
</template>
