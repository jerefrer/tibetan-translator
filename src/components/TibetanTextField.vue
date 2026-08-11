<script>
import _ from 'underscore';
import { convertWylieInText } from '../utils';
import { mayNeedLegacyRepair } from '../services/legacy-to-unicode';

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
        event.key === 'Enter' ||
        (event.ctrlKey && event.key == 'v')
      )
        this.text = this.convertWylie(this.text);
      this.$emit('update:modelValue', this.text);
    },
    async handlePaste(event) {
      event.preventDefault();
      var clipboard = {
        text: event.clipboardData.getData('text/plain'),
        html: event.clipboardData.getData('text/html'),
      };
      // The selection has to be read before awaiting, while the event is still
      // the one that describes the caret the user pasted at.
      var input = this.$refs.input.$el.querySelector('input');
      var start = input.selectionStart;
      var end = input.selectionEnd;

      // Text set in a pre-Unicode Tibetan font arrives as Latin gibberish;
      // repair it so the rest of this handler sees ordinary Unicode Tibetan.
      var pastedText = clipboard.text;
      if (mayNeedLegacyRepair(clipboard)) {
        const { convertLegacyPaste } = await import(
          '../services/legacy-to-unicode'
        );
        pastedText = (await convertLegacyPaste(clipboard)) || clipboard.text;
      }

      // For multi-line paste, emit paste:multiple if listener exists
      if (pastedText.split(/[\r\n]+/).length > 1) {
        this.$emit('paste:multiple', this.convertWylie(pastedText));
      } else {
        // For single-line paste, convert and insert at cursor position
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
    :class="['tibetan', { 'tibetan-labelled': !!$attrs.label }]"
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
    <!-- Declaring this slot unconditionally makes Vuetify render an empty
         .v-input__append, whose 16px inline padding shrinks the field and
         leaves it visibly narrower than a plain field beside it in a form. -->
    <template v-if="$slots.append" v-slot:append>
      <slot name="append" />
    </template>
  </v-text-field>
</template>
