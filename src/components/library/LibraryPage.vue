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
// collections (My glossary, Dictionaries), what to add to this device, the
// settings, and help. The sidebar's Settings link lands on `#settings`; an
// old preferences link on `#dictionary-order`.
//
// The page is kept alive, so a hash is followed on `activated` and whenever
// the route's hash changes, not only on `mounted`.
export default {
  name: 'LibraryPage',
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
    ResizeService.subscribe('library-page', () => {
      this.isMobile = ResizeService.isMobile();
    });
    this.onDictionariesUpdated = () => {
      this.dictionaryCount = (Storage.get('dictionaries') || []).length;
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
    // The sidebar's Settings link and Cmd/Ctrl+G, followed while already on #settings
    window.addEventListener(REFOLLOW_EVENT, this.scrollToHash);
  },
  mounted() {
    this.scrollToHash();
  },
  activated() {
    this.dictionaryCount = (Storage.get('dictionaries') || []).length;
    this.scrollToHash();
  },
  unmounted() {
    ResizeService.unsubscribe('library-page');
    window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
    window.removeEventListener(REFOLLOW_EVENT, this.scrollToHash);
  },
  methods: {
    // Only while Library itself is shown: the other /library pages share the
    // route's hash but have no such sections
    async scrollToHash() {
      if (this.$route.path !== '/library') return;
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
    class="library-page"
    :class="{ 'library-page--phone': isMobile }"
    data-testid="library-page"
  >
    <div class="library-page__column">
      <h1 class="library-page__title">Library</h1>

      <section id="library-collections" class="library-section" data-testid="library-collections">
        <ui-list class="library-group">
          <ui-list-item
            title="My glossary"
            clickable
            class="library-row"
            data-testid="library-row-glossary"
            @click="$router.push('/library/glossary')"
          >
            <template #append>
              <span class="library-row__status">{{ glossaryStatus }}</span>
              <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="library-row__chevron" />
            </template>
          </ui-list-item>
          <ui-list-item
            title="Dictionaries"
            clickable
            class="library-row"
            data-testid="library-row-dictionaries"
            @click="$router.push('/library/dictionaries')"
          >
            <template #append>
              <span class="library-row__status">{{ dictionariesStatus }}</span>
              <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="library-row__chevron" />
            </template>
          </ui-list-item>
        </ui-list>
      </section>

      <section v-if="modular" id="library-device" class="library-section" data-testid="library-device">
        <h2 class="library-label">Add to this device</h2>
        <pack-manager-card />
        <audio-card />
        <scanned-dictionaries-card />
      </section>

      <section id="settings" class="library-section" data-testid="library-settings">
        <h2 class="library-label">Settings</h2>
        <appearance-card />
        <global-lookup-card />
        <dictionary-preferences-card id="dictionary-order" />
        <!-- Without packs (a browser) there is no "this device" section: the
             scans and recordings, online only there, stay with the settings
             as the old Settings page had them -->
        <template v-if="!modular">
          <scanned-dictionaries-card />
          <audio-card />
        </template>
      </section>

      <section id="library-help" class="library-section" data-testid="library-help">
        <h2 class="library-label">Help and about</h2>
        <ui-list class="library-group">
          <ui-list-item
            v-for="help in helpRows"
            :key="help.id"
            :title="help.title"
            icon="circle-help"
            clickable
            class="library-row"
            :data-testid="'library-help-' + help.id"
            @click="$refs[help.ref].open()"
          >
            <template #append>
              <ui-icon name="chevron-right" :size="18" :stroke-width="2" class="library-row__chevron" />
            </template>
          </ui-list-item>
          <about-card rows />
        </ui-list>
        <define-page-help-dialog-with-button ref="lookupHelp" />
        <search-page-help-dialog-with-button ref="searchHelp" />
        <split-page-help-dialog-with-button ref="readerHelp" />
      </section>
    </div>
  </div>
</template>

<style>
/* Desktop: a centred 40rem column, sections split by hairlines.
   Phone: a large title and white groups on the grey ground. */
.library-page {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-7) var(--space-6) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
}
.library-page__column {
  max-width: 40rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.library-page__title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.library-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  /* A section a link lands on keeps room above it */
  scroll-margin-top: var(--space-4);
}
.library-label {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Desktop rows: hairlines, no frame */
.library-group.ui-list {
  border: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.library-row .ui-list-item__row {
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-1);
}
.library-row .ui-list-item__text {
  flex: 1;
}
.library-row .ui-list-item__title {
  font-size: var(--text-md);
}
.library-row .ui-list-item__subtitle {
  font-size: var(--text-sm);
}
.library-row__status {
  font-size: var(--text-base);
  color: var(--muted);
}
.library-row__chevron {
  color: var(--faint);
}
.library-group .settings-row .ui-list-item__row {
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-1);
}
.library-group .settings-row .ui-list-item__title {
  font-size: var(--text-md);
  font-weight: 400;
}
.library-group .settings-row .ui-list-item__subtitle {
  font-size: var(--text-sm);
}

.library-page--phone {
  padding: 22px var(--space-4) var(--space-6);
  background: var(--bg-grouped);
}
.library-page--phone .library-page__column {
  gap: 18px;
}
.library-page--phone .library-page__title {
  font-size: var(--text-large-title);
  font-weight: 700;
  letter-spacing: 0;
}
.library-page--phone .library-section {
  gap: var(--space-2);
}
.library-page--phone .library-label {
  padding: 0 var(--space-1);
}
.library-page--phone .library-group.ui-list {
  border: 0;
  border-radius: var(--radius-group);
  background: var(--surface);
}
.library-page--phone .library-row .ui-list-item__row,
.library-page--phone .library-group .settings-row .ui-list-item__row {
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-4);
}
.library-page--phone .ui-list-item {
  border-bottom-color: var(--soft);
}
/* A card is one white group under its section's label, its title the
   group's first line (board MobileLibrary): no second uppercase label */
.library-page--phone .settings-card.ui-card {
  gap: var(--space-3);
  padding: 14px var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
.library-page--phone .settings-card__heading {
  padding: 0;
}
.library-page--phone .settings-card__title {
  font-size: var(--text-md);
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
}
.library-page--phone .settings-card .ui-card__body {
  padding: 0;
  border-radius: 0;
  background: transparent;
}
</style>
