<script>
import _ from 'underscore';
import { convertWylieInText } from '../utils';

export default {
  inheritAttrs: false,
  props: {
    modelValue: String,
    placeholder: {
      type: String,
      default: 'བོད་ཡིག་',
    },
  },
  emits: ['update:modelValue', 'keydown', 'click:clear', 'paste:multiple'],
  data() {
    return {
      text: this.modelValue,
    };
  },
  watch: {
    modelValue(value) {
      this.text = value;
    },
    text(value) {
      // Android keyboard auto-spacing fix - remove spaces after Tibetan characters
      if (value && value.match(/[་།༑༔] +$/)) {
        this.text = value.trimEnd();
      }
    },
  },
  methods: {
    preventMoreThanOneTrailingTshek(event) {
      if (event.key == '་' && _.last(this.text) == '་') event.preventDefault();
      else this.$emit('keydown', event);
    },
    convertWylie(text) {
      return convertWylieInText(text, {
        normalizeTrailingPunctuation: true,
        normalizeMultipleTshegs: true,
        preserveWhitespace: false
      });
    },
    convertWylieAndEmit(event, isDropping) {
      // Remove double spaces (Android keyboard auto-spacing fix)
      if (this.text) this.text = this.text.replace(/  +/g, ' ');
      if (
        isDropping ||
        event.key.match(/[་ ]/) ||
        (event.ctrlKey && event.key == 'v')
      )
        this.text = this.convertWylie(this.text);
      this.$emit('update:modelValue', this.text);
    },
    handlePaste(event) {
      var pastedText = event.clipboardData.getData('text/plain');
      // For multi-line paste, emit paste:multiple if listener exists
      if (pastedText.split(/[\r\n]+/).length > 1) {
        event.preventDefault();
        this.$emit('paste:multiple', this.convertWylie(pastedText));
      } else {
        // For single-line paste, convert and insert at cursor position
        event.preventDefault();
        var input = this.$refs.input.$el.querySelector('input');
        var start = input.selectionStart;
        var end = input.selectionEnd;
        var currentText = this.text || '';
        var newText =
          currentText.substring(0, start) +
          pastedText +
          currentText.substring(end);
        this.text = this.convertWylie(newText);
        this.$emit('update:modelValue', this.text);
        // Restore cursor position after the pasted text
        this.$nextTick(() => {
          var newPos =
            start + this.text.length - currentText.length + (end - start);
          input.setSelectionRange(newPos, newPos);
        });
      }
    },
    handleDrop() {
      setTimeout(() => this.convertWylieAndEmit(null, true), 1);
    },
    focus() {
      this.$refs.input.focus();
    },
  },
};
</script>

<template>
  <v-text-field
    ref="input"
    hide-details
    v-model="text"
    v-bind="$attrs"
    :placeholder="placeholder"
    class="tibetan"
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    data-form-type="other"
    data-lpignore="true"
    enterkeyhint="search"
    @keydown="preventMoreThanOneTrailingTshek"
    @keyup="convertWylieAndEmit"
    @paste="handlePaste"
    @drop="handleDrop"
    @click:clear="$emit('click:clear')"
  >
    <template v-slot:append>
      <slot name="append" />
    </template>
  </v-text-field>
</template>
