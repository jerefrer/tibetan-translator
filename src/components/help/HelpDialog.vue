<script>
import GlobalLookup from '../../services/global-lookup';
import ResizeService from '../../services/resize-service';
import { closeHelp, helpState } from '../../services/help';
import { foldForSearch } from '../../services/dictionary-catalog';
import { UiButton, UiDialog, UiIcon, UiTextField } from '../../ui';
import HelpTopic from './HelpTopic.vue';

// The help, one dialog for the whole app (helpState, services/help.js), open
// on the topic of the screen. Desktop: the topics on the left, the one chosen
// on the right; the field above finds the topics that mention what is typed.
// Phone: a tall sheet, the topics as a list, a topic on its own with a way
// back. An example tried closes the help, so that its result shows.
export default {
  name: 'HelpDialog',
  components: { HelpTopic, UiButton, UiDialog, UiIcon, UiTextField },
  data() {
    return {
      state: helpState,
      isPhone: ResizeService.isMobile(),
      query: '',
      // The topic shown; on a phone null shows the list
      current: null,
      // id -> the topic's text, for the search
      texts: {},
    };
  },
  computed: {
    topics() {
      return [
        // `words`: what people search the help for, beyond what the topic says
        { id: 'typing', title: 'Typing Tibetan and Wylie', icon: 'keyboard', words: 'ewts transliteration romanization input convert paste unicode font' },
        { id: 'lookup', title: 'Looking up a word', icon: 'search', words: 'entry definition meaning translation copy abbreviation scan audio pronunciation' },
        { id: 'search', title: 'Searching the definitions', icon: 'text-search', words: 'english phonetic phonetics sound syntax query advanced builder' },
        { id: 'reader', title: 'Reading a text', icon: 'align-left', words: 'split segment sentence passage words expression' },
        { id: 'dictionaries', title: 'Dictionaries', icon: 'book-open', words: 'order enable disable switch pack install update remove undo' },
        { id: 'glossary', title: 'My glossary', icon: 'notebook-pen', words: 'lexicon custom own definitions import export spreadsheet excel csv tibdict' },
        { id: 'saved', title: 'Saved and recent terms', icon: 'bookmark', words: 'bookmark favorite history recent forget clear' },
        GlobalLookup.isSupported() && { id: 'quick', title: 'Quick lookup', icon: 'command', words: 'hotkey global shortcut clipboard popup window accessibility permission' },
        !this.isPhone && { id: 'shortcuts', title: 'Keyboard shortcuts', icon: 'keyboard', words: 'keys hotkeys keyboard' },
      ].filter(Boolean);
    },
    folded() {
      return foldForSearch(this.query).trim();
    },
    shownTopics() {
      if (!this.folded) return this.topics;
      return this.topics.filter((topic) =>
        foldForSearch(`${topic.title} ${topic.words} ${this.texts[topic.id] || ''}`).includes(this.folded)
      );
    },
    // What the right side (or the phone's sheet) shows
    shown() {
      const topic = this.shownTopics.find((candidate) => candidate.id === this.current);
      if (topic) return topic;
      return this.isPhone ? null : this.shownTopics[0] || null;
    },
  },
  watch: {
    'state.open': {
      immediate: true,
      handler(open) {
        if (!open) return;
        this.query = '';
        this.current = this.state.topic;
        this.$nextTick(() => {
          this.readTexts();
          if (this.isPhone) this.$refs.help?.focus();
        });
      },
    },
    'state.topic'(topic) {
      if (this.state.open) this.current = topic;
    },
    query() {
      if (!Object.keys(this.texts).length) this.readTexts();
      // A search shows its first match, or the list on a phone
      if (this.folded && !this.shownTopics.some((topic) => topic.id === this.current)) {
        this.current = this.isPhone ? null : this.shownTopics[0]?.id ?? null;
      }
    },
  },
  created() {
    ResizeService.subscribe('help-dialog', () => {
      this.isPhone = ResizeService.isMobile();
    });
  },
  unmounted() {
    ResizeService.unsubscribe('help-dialog');
  },
  methods: {
    // The topics' text, from a hidden copy rendered for the search
    readTexts() {
      const texts = {};
      for (const element of document.querySelectorAll('[data-help-index] [data-topic]')) {
        texts[element.dataset.topic] = element.textContent;
      }
      this.texts = texts;
    },
    choose(id) {
      this.current = id;
    },
    onOpenChange(open) {
      if (!open) closeHelp();
    },
    close() {
      closeHelp();
    },
    tryTerm(tibetan) {
      closeHelp();
      this.$router.push(`/lookup/${encodeURIComponent(tibetan)}`);
    },
    trySearch(query) {
      closeHelp();
      this.$router.push({ path: '/search', query: { q: query } });
    },
    goTo(path) {
      closeHelp();
      this.$router.push(path);
    },
  },
};
</script>

<template>
  <ui-dialog
    :model-value="state.open"
    title="Help"
    :max-width="920"
    tall
    :auto-focus="!isPhone"
    content-class="help-dialog"
    @update:model-value="onOpenChange"
  >
    <!-- On a phone the focus goes here rather than to the field, which would
         bring the keyboard up -->
    <div ref="help" class="help" :class="{ 'is-phone': isPhone }" tabindex="-1" data-testid="help-dialog">
      <ui-text-field
        v-model="query"
        class="help__search"
        prepend-icon="search"
        placeholder="Search the help"
        aria-label="Search the help"
        clearable
        autocomplete="off"
        spellcheck="false"
        data-testid="help-search"
      />

      <div class="help__layout">
        <nav v-if="!isPhone || !shown" class="help__topics" aria-label="Help topics">
          <button
            v-for="topic in shownTopics"
            :key="topic.id"
            type="button"
            class="help__topic"
            :class="{ 'is-current': shown && topic.id === shown.id }"
            :aria-current="shown && topic.id === shown.id ? 'true' : undefined"
            data-testid="help-topic-toggle"
            @click="choose(topic.id)"
          >
            <ui-icon :name="topic.icon" :size="16" class="help__topic-icon" />
            <span class="help__topic-title">{{ topic.title }}</span>
            <ui-icon v-if="isPhone" name="chevron-right" :size="16" class="help__topic-chevron" />
          </button>
          <p v-if="!shownTopics.length" class="help__none" data-testid="help-no-match">Nothing in the help matches.</p>
        </nav>

        <article v-if="shown" class="help__content" :data-testid="'help-topic-' + shown.id">
          <button v-if="isPhone" type="button" class="help__back" data-testid="help-back" @click="current = null">
            <ui-icon name="chevron-left" :size="20" :stroke-width="2.4" />
            All topics
          </button>
          <h3 class="help__title">{{ shown.title }}</h3>
          <help-topic
            :id="shown.id"
            :is-phone="isPhone"
            @try-term="tryTerm"
            @try-search="trySearch"
            @go="goTo"
          />
        </article>
      </div>

      <!-- Every topic, hidden, for the search to read -->
      <div class="help__index" aria-hidden="true" data-help-index>
        <help-topic v-for="topic in topics" :id="topic.id" :key="topic.id" :is-phone="isPhone" indexing />
      </div>
    </div>

    <template #actions>
      <ui-button variant="ghost" data-testid="help-close" @click="close">Close</ui-button>
    </template>
  </ui-dialog>
</template>

<style>
/* Desktop: as tall as the window allows, the two panes scrolling on their own */
.help-dialog.ui-dialog {
  height: min(44rem, calc(100dvh - 2 * var(--space-6)));
  overflow: hidden;
}
.help-dialog .ui-dialog__body {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>

<style scoped>
.help {
  outline: none;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  font-size: var(--text-base);
  line-height: 1.55;
}
.help__search {
  flex: none;
}
.help__layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: var(--space-6);
}
.help__topics {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.help__topic {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.25rem;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  font: 500 var(--text-base) var(--font-ui);
  text-align: left;
  color: var(--ink);
  cursor: pointer;
}
.help__topic:hover {
  background: var(--bg-quiet);
}
.help__topic.is-current {
  background: var(--accent-soft);
  color: var(--accent);
}
.help__topic:focus-visible,
.help__back:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.help__topic-icon {
  flex: none;
  color: var(--muted);
}
.help__topic.is-current .help__topic-icon {
  color: var(--accent);
}
.help__topic-title {
  flex: 1;
}
.help__topic-chevron {
  flex: none;
  color: var(--faint);
}
.help__none {
  margin: var(--space-2);
  color: var(--muted);
}
.help__content {
  min-height: 0;
  overflow-y: auto;
  padding-right: var(--space-2);
}
.help__title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-md);
  font-weight: 600;
}
.help__index {
  display: none;
}

/* Phone: one column, the list or a topic */
.help.is-phone .help__layout {
  display: flex;
  flex-direction: column;
}
.help.is-phone .help__topics,
.help.is-phone .help__content {
  flex: 1;
}
.help.is-phone .help__topic {
  min-height: 2.75rem;
  border-bottom: 1px solid var(--line-soft);
  border-radius: 0;
}
.help__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 2.75rem;
  margin-left: -6px;
  padding: 0;
  border: 0;
  background: none;
  font: var(--text-md) var(--font-ui);
  color: var(--accent);
  cursor: pointer;
}
</style>
