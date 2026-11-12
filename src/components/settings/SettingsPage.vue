<script>
import Storage from '../../services/storage';
import PackManager from '../../services/pack-manager';
import ResizeService from '../../services/resize-service';
import { Lexicon } from '../../services/lexicon';
import { supportsModularPacks } from '../../config/platform';
import { REFOLLOW_EVENT } from '../../config/navigation';
import { UiIcon, UiList, UiListItem } from '../../ui';
import AppearanceCard from '../settings/AppearanceCard.vue';
import GlobalLookupCard from '../settings/GlobalLookupCard.vue';
import AboutCard from '../settings/AboutCard.vue';
import PackManagerCard from '../settings/PackManagerCard.vue';
import ScannedDictionariesCard from '../settings/ScannedDictionariesCard.vue';
import AudioCard from '../settings/AudioCard.vue';
import DictionaryPreferencesCard from '../settings/DictionaryPreferencesCard.vue';
import DefinePageHelpDialogWithButton from '../DefinePageHelpDialogWithButton.vue';
import SearchPageHelpDialogWithButton from '../SearchPageHelpDialogWithButton.vue';
import SplitPageHelpDialogWithButton from '../SplitPageHelpDialogWithButton.vue';
import { packSummary, plural } from '../settings/pack-summary';

// Everything that is not a lookup, in one page grouped like iOS Settings:
// collections (My glossary, Dictionaries; on a phone only, the desktop
// sidebar lists them), the general settings, downloads, and the dictionary
// preferences beside help. A link to `/settings#dictionary-order` lands on
// the preferences; a link to bare `/settings` shows the top.
//
// The page is kept alive, so a hash is followed on `activated` and whenever
// the route's hash changes, not only on `mounted`.
export default {
  name: 'SettingsPage',
  components: {
    UiIcon,
    UiList,
    UiListItem,
    AppearanceCard,
    GlobalLookupCard,
    AboutCard,
    PackManagerCard,
    ScannedDictionariesCard,
    AudioCard,
    DictionaryPreferencesCard,
    DefinePageHelpDialogWithButton,
    SearchPageHelpDialogWithButton,
    SplitPageHelpDialogWithButton,
  },
  data() {
    return {
      isMobile: ResizeService.isMobile(),
      dictionaryCount: (Storage.get('dictionaries') || []).length,
      modular: supportsModularPacks(),
    };
  },
  computed: {
    helpRows() {
      return [
        { id: 'lookup', ref: 'lookupHelp', title: 'Looking up a word' },
        { id: 'search', ref: 'searchHelp', title: 'Searching the definitions' },
        { id: 'reader', ref: 'readerHelp', title: 'Reading a text' },
      ];
    },
    glossaryStatus() {
      if (!this.modular) return 'Your own definitions';
      const dictionaries = Lexicon.editableDictionaries();
      if (!dictionaries.length) return 'Your own definitions';
      const entries = dictionaries.reduce((sum, dictionary) => sum + (dictionary.entriesCount || 0), 0);
      return plural(entries, 'entry', 'entries');
    },
    dictionariesStatus() {
      const count = this.modular
        ? packSummary(PackManager.installedPacks).dictionaries
        : this.dictionaryCount;
      return `${count} on this device`;
    },
  },
  watch: {
    '$route.hash'() {
      this.scrollToHash();
    },
  },
  created() {
    ResizeService.subscribe('settings-page', () => {
      this.isMobile = ResizeService.isMobile();
    });
    this.onDictionariesUpdated = () => {
      this.dictionaryCount = (Storage.get('dictionaries') || []).length;
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
    // The sidebar's Settings link and Cmd/Ctrl+G, followed while already on /settings
    window.addEventListener(REFOLLOW_EVENT, this.onRefollow);
  },
  mounted() {
    this.scrollToHash();
  },
  activated() {
    this.dictionaryCount = (Storage.get('dictionaries') || []).length;
    this.scrollToHash();
  },
  unmounted() {
    ResizeService.unsubscribe('settings-page');
    window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
    window.removeEventListener(REFOLLOW_EVENT, this.onRefollow);
  },
  methods: {
    // A link to the current route followed again: back to its section, or to
    // the top when it has none
    onRefollow() {
      if (this.$route.path === '/settings' && !this.$route.hash) {
        this.$refs.page?.scrollTo?.({ top: 0 });
        return;
      }
      this.scrollToHash();
    },
    // Only while Settings itself is shown: the other pages share the route's
    // hash but have no such sections
    async scrollToHash() {
      if (this.$route.path !== '/settings') return;
      const id = this.$route.hash.replace(/^#/, '');
      if (!id) return;
      await this.$nextTick();
      // The hash is read as an id, never built into a selector
      const section = document.getElementById(id);
      if (section && this.$refs.page?.contains(section)) section.scrollIntoView({ block: 'start' });
    },
  },
};
</script>

<template>
  <div
    ref="page"
    class="settings-page"
    :class="{ 'settings-page--phone': isMobile }"
    data-testid="settings-page"
  >
    <div class="settings-page__column">
      <h1 class="settings-page__title">Settings</h1>

      <section v-if="isMobile" id="settings-collections" class="settings-section" data-testid="settings-collections">
        <ui-list class="settings-group">
          <ui-list-item
            title="My glossary"
            clickable
            class="settings-nav-row"
            data-testid="settings-row-glossary"
            @click="$router.push('/glossary')"
          >
            <template #append>
              <span class="settings-nav-row__status">{{ glossaryStatus }}</span>
              <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="settings-nav-row__chevron" />
            </template>
          </ui-list-item>
          <ui-list-item
            title="Dictionaries"
            clickable
            class="settings-nav-row"
            data-testid="settings-row-dictionaries"
            @click="$router.push('/dictionaries')"
          >
            <template #append>
              <span class="settings-nav-row__status">{{ dictionariesStatus }}</span>
              <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="settings-nav-row__chevron" />
            </template>
          </ui-list-item>
        </ui-list>
      </section>

      <!-- The short cards side by side; in a browser the Quick lookup card
           renders nothing and Appearance sits alone -->
      <section id="settings-general" class="settings-section" data-testid="settings-general">
        <appearance-card />
        <global-lookup-card />
      </section>

      <section id="settings-downloads" class="settings-section" data-testid="settings-downloads">
        <h2 class="settings-label">{{ modular ? 'Downloads' : 'Scans and recordings' }}</h2>
        <pack-manager-card v-if="modular" class="settings-section__wide" />
        <scanned-dictionaries-card />
        <audio-card />
      </section>

      <section id="settings-dictionaries" class="settings-section" data-testid="settings-dictionaries">
        <!-- Each column under its own label, the two labels on one line -->
        <div class="settings-stack">
          <h2 class="settings-label">Dictionaries</h2>
          <dictionary-preferences-card id="dictionary-order" />
        </div>
        <div id="settings-help" class="settings-stack" data-testid="settings-help">
          <h2 class="settings-label">Help and about</h2>
          <ui-list class="settings-group">
            <ui-list-item
              v-for="help in helpRows"
              :key="help.id"
              :title="help.title"
              icon="circle-help"
              clickable
              class="settings-nav-row"
              :data-testid="'settings-help-' + help.id"
              @click="$refs[help.ref].open()"
            >
              <template #append>
                <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="settings-nav-row__chevron" />
              </template>
            </ui-list-item>
            <about-card rows />
          </ui-list>
          <define-page-help-dialog-with-button ref="lookupHelp" />
          <search-page-help-dialog-with-button ref="searchHelp" />
          <split-page-help-dialog-with-button ref="readerHelp" />
        </div>
      </section>
    </div>
  </div>
</template>

<style>
/* Desktop: a centred column as wide as Search was, each section's cards
   two by two once there is room for both. Phone: a large title and white
   groups on the grey ground. */
.settings-page {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-7) var(--space-6) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
}
.settings-page__column {
  max-width: 72rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.settings-page__title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.settings-section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 28rem), 1fr));
  align-items: start;
  gap: var(--space-3) var(--space-6);
  /* A section a link lands on keeps room above it */
  scroll-margin-top: var(--space-4);
}
.settings-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.settings-section > .settings-label,
.settings-section > .settings-group,
.settings-section__wide {
  grid-column: 1 / -1;
}
.settings-label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Desktop rows: hairlines, no frame */
.settings-group.ui-list {
  border: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.settings-nav-row .ui-list-item__row {
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-1);
}
.settings-nav-row .ui-list-item__text {
  flex: 1;
}
.settings-nav-row .ui-list-item__title {
  font-size: var(--text-md);
}
.settings-nav-row .ui-list-item__subtitle {
  font-size: var(--text-sm);
}
.settings-nav-row__status {
  font-size: var(--text-base);
  color: var(--muted);
}
.settings-nav-row__chevron {
  color: var(--faint);
}
.settings-group .settings-row .ui-list-item__row {
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-1);
}
.settings-group .settings-row .ui-list-item__title {
  font-size: var(--text-md);
  font-weight: 400;
}
.settings-group .settings-row .ui-list-item__subtitle {
  font-size: var(--text-sm);
}

.settings-page--phone {
  padding: 22px var(--space-4) var(--space-6);
  background: var(--bg-grouped);
}
.settings-page--phone .settings-page__column {
  gap: 18px;
}
.settings-page--phone .settings-page__title {
  font-size: var(--text-large-title);
  font-weight: 700;
  letter-spacing: 0;
}
.settings-page--phone .settings-section,
.settings-page--phone .settings-stack {
  gap: var(--space-2);
}
.settings-page--phone .settings-label {
  padding: 0 var(--space-1);
}
.settings-page--phone .settings-group.ui-list {
  border: 0;
  border-radius: var(--radius-group);
  background: var(--surface);
}
.settings-page--phone .settings-nav-row .ui-list-item__row,
.settings-page--phone .settings-group .settings-row .ui-list-item__row {
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-4);
}
.settings-page--phone .ui-list-item {
  border-bottom-color: var(--soft);
}
/* A card is one white group under its section's label, its title the
   group's first line (board MobileLibrary): no second uppercase label */
.settings-page--phone .settings-card.ui-card {
  gap: var(--space-3);
  padding: 14px var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
.settings-page--phone .settings-card__heading {
  padding: 0;
}
.settings-page--phone .settings-card__title {
  font-size: var(--text-md);
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
}
.settings-page--phone .settings-card .ui-card__body {
  padding: 0;
  border-radius: 0;
  background: transparent;
}
</style>
