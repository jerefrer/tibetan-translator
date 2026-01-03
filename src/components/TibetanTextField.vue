<script>
import _ from "underscore";
import TibetanRegExps from "tibetan-regexps";
import TibetanNormalizer from "tibetan-normalizer";
import WylieToUnicode from "../services/wylie-to-unicode";
const wylieToUnicode = new WylieToUnicode();

export default {
  inheritAttrs: false,
  props: {
    modelValue: String,
    placeholder: {
      type: String,
      default: 'བོད་ཡིག་'
    }
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
      if (event.key == "་" && _.last(this.text) == "་") event.preventDefault();
      else this.$emit("keydown", event);
    },
    convertWylie(text) {
      var textWithConvertedWylie = (text || "").replace(
        new RegExp(`[^${TibetanRegExps.expressions.allTibetanCharacters}\r\n]+`, 'iug'),
        (wylie) => wylieToUnicode.convert(wylie)
      );
      textWithConvertedWylie = textWithConvertedWylie.replace(/་+/g, "་");
      if (!textWithConvertedWylie.match(/[་།༑༔]$/))
        textWithConvertedWylie += "་";
      return TibetanNormalizer.normalize(textWithConvertedWylie);
    },
    convertWylieAndEmit(event, isDropping) {
      // Remove double spaces (Android keyboard auto-spacing fix)
      if (this.text) this.text = this.text.replace(/  +/g, ' ');
      if (
        isDropping ||
        event.key.match(/[་ ]/) ||
        (event.ctrlKey && event.key == "v")
      )
        this.text = this.convertWylie(this.text);
      this.$emit("update:modelValue", this.text);
    },
    handlePasteMultipleIfDefined(event) {
      // Check if paste:multiple listener exists by checking emits
      var pastedText = event.clipboardData.getData("text/plain");
      if (pastedText.split(/[\r\n]+/).length > 1) {
        event.preventDefault();
        this.$emit("paste:multiple", this.convertWylie(pastedText));
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
    @paste="handlePasteMultipleIfDefined"
    @drop="handleDrop"
    @click:clear="$emit('click:clear')"
  >
    <template v-slot:append>
      <slot name="append" />
    </template>
  </v-text-field>
</template>
