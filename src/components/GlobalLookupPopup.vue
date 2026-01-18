<script>
import TibetanRegExps from 'tibetan-regexps';
import { useTheme } from 'vuetify';

import Entries from './Entries.vue';
import SqlDatabase from '../services/sql-database';
import { withTrailingTshek } from '../utils.js';

export default {
  components: {
    Entries
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    text: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      term: '',
      loading: false,
      entries: [],
    };
  },
  computed: {
    show: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    },
    isDark() {
      return this.theme.global.current.value.dark;
    },
  },
  watch: {
    text: {
      immediate: true,
      handler(newText) {
        if (newText && this.modelValue) {
          this.handleLookup(newText);
        }
      }
    },
    modelValue(newValue) {
      if (newValue && this.text) {
        this.handleLookup(this.text);
      }
    }
  },
  methods: {
    async handleLookup(text) {
      if (!text) return;

      // Clean the text - remove non-Tibetan characters
      const cleanedText = text
        .replace(TibetanRegExps.anythingNonTibetan, '')
        .replace(TibetanRegExps.beginningPunctuation, '');

      // Check if it has Tibetan content
      if (!cleanedText.match(TibetanRegExps.tibetanGroups)) {
        this.entries = [];
        this.term = text.trim().substring(0, 50); // Show original text (truncated)
        return;
      }

      this.term = cleanedText;
      this.loading = true;

      try {
        this.entries = await SqlDatabase.getEntriesFor(withTrailingTshek(this.term));
      } catch (error) {
        console.error('Error fetching entries:', error);
        this.entries = [];
      } finally {
        this.loading = false;
      }
    },
    close() {
      this.show = false;
    },
    handleKeydown(event) {
      if (event.key === 'Escape') {
        this.close();
      }
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }
};
</script>

<template>
  <v-dialog
    v-model="show"
    max-width="600"
    :scrim="true"
    scrim-class="global-lookup-scrim"
  >
    <v-card class="global-lookup-popup" :class="{ 'theme--dark': isDark }">
      <v-card-title class="popup-header d-flex align-center">
        <v-icon class="mr-2" size="small">mdi-magnify</v-icon>
        <span class="popup-title flex-grow-1">{{ term || 'Global Lookup' }}</span>
        <v-btn
          icon
          variant="text"
          size="small"
          @click="close"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text class="popup-content">
        <v-fade-transition mode="out-in">
          <div v-if="loading" class="flex-centered">
            <v-progress-circular
              indeterminate
              size="48"
            />
          </div>

          <Entries
            v-else-if="entries.length"
            :entries="entries"
          />

          <div v-else-if="term" class="flex-centered no-entries text-center">
            <div>
              <v-icon size="48" color="grey" class="mb-2">mdi-book-search-outline</v-icon>
              <div class="text-body-1">No entries found</div>
              <div class="text-body-2 text-grey mt-1">for "{{ term }}"</div>
            </div>
          </div>

          <div v-else class="flex-centered instructions text-center">
            <div>
              <v-icon size="48" color="grey" class="mb-2">mdi-clipboard-text-search-outline</v-icon>
              <div class="text-body-1">No text to look up</div>
              <div class="text-body-2 text-grey mt-1">Copy Tibetan text and try again</div>
            </div>
          </div>
        </v-fade-transition>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style lang="stylus" scoped>
.global-lookup-popup
  max-height: 80vh
  display: flex
  flex-direction: column

.popup-header
  padding: 12px 16px
  font-size: 16px

.popup-title
  font-family: 'Jomolhari', 'Noto Sans Tibetan', serif
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.popup-content
  flex: 1
  overflow-y: auto
  min-height: 200px
  max-height: 60vh
  padding: 16px

.flex-centered
  display: flex
  align-items: center
  justify-content: center
  min-height: 200px

.no-entries, .instructions
  color: rgba(128, 128, 128, 0.8)
</style>

<style>
/* Global scrim style */
.global-lookup-scrim {
  backdrop-filter: blur(2px);
}
</style>
