<script>
  import TibetanRegExps from 'tibetan-regexps'
  import TibetanNormalizer from 'tibetan-normalizer'
  import WylieToUnicode from '../../../wylie-to-unicode'
  const wylieToUnicode = new WylieToUnicode();
  
  export default {
    inheritAttrs: false,
    props: {
      value: String
    },
    data () {
      return {
        text: this.value
      }
    },
    watch: {
      value (value) {
        this.text = value;
      }
    },
    methods: {
      preventMoreThanOneTrailingTshek (event) {
        if (event.key == '་' && this.text.last() == '་')
          event.preventDefault();
        else
          this.$emit('keydown', event);
      },
      convertWylie (text) {
        var textWithConvertedWylie = (text || '').replace(
          TibetanRegExps.anythingNonTibetan,
          (wylie) => wylieToUnicode.convert(wylie)
        );
        textWithConvertedWylie = textWithConvertedWylie.replace(/་+/g, '་');
        if (!textWithConvertedWylie.match(/[་།༑༔]$/))
          textWithConvertedWylie += '་';
        return TibetanNormalizer.normalize(textWithConvertedWylie);
      },
      convertWylieAndEmit (event, isDropping) {
        if (isDropping || event.key.match(/[་ ]/) || (event.ctrlKey && event.key == 'v'))
          this.text = this.convertWylie(this.text);
        this.$emit('input', this.text);
      },
      handlePasteMultipleIfDefined (event) {
        if (this.$listeners['paste:multiple']) {
          var pastedText = event.clipboardData.getData('text/plain');
          event.clipboardData.setData('text/plain', pastedText);
          if (pastedText.lines().length > 1) {
            event.preventDefault();
            this.$emit('paste:multiple', this.convertWylie(pastedText));
          }
        }
      },
      handleDrop () {
        setTimeout(() => this.convertWylieAndEmit(null, true), 1);
      },
      focus () {
        this.$refs.input.focus();
      }
    }
  }
</script>

<template>
  <v-text-field
    ref="input"
    hide-details
    v-model="text"
    v-bind="$attrs"
    v-on="$listeners"
    placeholder="བོད་ཡིག་"
    class="tibetan"
    spellcheck="false"
    autocomplete="off"
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
