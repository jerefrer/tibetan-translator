<script>
import { UiButton, UiChip, UiDialog } from '../ui';
import Decorator from '../services/decorator';
import DICTIONARIES_DETAILS from '../services/dictionaries-details';
import { LANGUAGE_LABELS } from '../services/dictionary-catalog';
import { substituteLinksWithATags } from '../utils';

const DIRECTION_SYMBOLS = { '<->': '⇄', '->': '→', '<-': '←' };

// "About" of one dictionary, opened from the dictionary chip of an entry.
// Same look as the catalog's About dialog (Dialogs board, B).
export default {
  name: 'DictionaryAboutDialog',
  components: { UiButton, UiChip, UiDialog },
  props: {
    modelValue: { type: Boolean, default: false },
    // The dictionary's name, as entries carry it (`entry.dictionary`)
    dictionary: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  computed: {
    details() {
      return DICTIONARIES_DETAILS[this.dictionary] || null;
    },
    title() {
      return (this.details?.label || this.dictionary || 'About').trim();
    },
    // The first line of "about" is the work's title, the rest its credits
    lines() {
      return (this.details?.about || '')
        .split('|')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) =>
          Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(substituteLinksWithATags(line))
        );
    },
    // "Tibetan ⇄ English", from ["tib", "<->", "en"]
    languages() {
      let text = '';
      let afterLanguage = false;
      (this.details?.language || []).forEach((code) => {
        if (DIRECTION_SYMBOLS[code]) {
          text += ` ${DIRECTION_SYMBOLS[code]} `;
          afterLanguage = false;
        } else {
          text += (afterLanguage ? ', ' : '') + (LANGUAGE_LABELS[code] || code);
          afterLanguage = true;
        }
      });
      return text.trim();
    },
    keywords() {
      return this.details?.keywords || [];
    },
  },
};
</script>

<template>
  <ui-dialog
    :model-value="modelValue"
    :title="title"
    :max-width="520"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="dictionary-about" data-testid="dictionary-about">
      <template v-if="lines.length">
        <!-- eslint-disable-next-line vue/no-v-html -- bundled dictionary details -->
        <p v-for="(line, index) in lines" :key="index" v-html="line" />
      </template>
      <p v-else class="dictionary-about__empty">No description for this dictionary.</p>
      <div v-if="languages || keywords.length" class="dictionary-about__tags">
        <ui-chip v-if="languages">{{ languages }}</ui-chip>
        <ui-chip v-for="keyword in keywords" :key="keyword">{{ keyword }}</ui-chip>
      </div>
    </div>
    <template #actions>
      <ui-button data-testid="dictionary-about-close" @click="$emit('update:modelValue', false)">
        Close
      </ui-button>
    </template>
  </ui-dialog>
</template>

<style lang="stylus" scoped>
.dictionary-about
  display flex
  flex-direction column
  gap 6px

  p
    margin 0
    overflow-wrap anywhere

  p:first-child
    font-weight 600

  :deep(a)
    color var(--accent)

.dictionary-about__empty
  color var(--muted)
  font-weight 400 !important

.dictionary-about__tags
  display flex
  flex-wrap wrap
  gap 8px
  margin-top 8px
</style>
