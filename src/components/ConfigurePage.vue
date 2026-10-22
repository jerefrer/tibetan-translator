<script>
import Storage from '../services/storage';
import PackManager from '../services/pack-manager';
import ResizeService from '../services/resize-service';
import { Lexicon } from '../services/lexicon';
import { supportsModularPacks } from '../config/platform';
import { UiIcon, UiList, UiListItem } from '../ui';
import AppearanceCard from './settings/AppearanceCard.vue';
import GlobalLookupCard from './settings/GlobalLookupCard.vue';
import AboutCard from './settings/AboutCard.vue';
import PackManagerCard from './settings/PackManagerCard.vue';
import ScannedDictionariesCard from './settings/ScannedDictionariesCard.vue';
import DictionaryPreferencesCard from './settings/DictionaryPreferencesCard.vue';
import { packSummary, plural } from './settings/pack-summary';

// Query keys the dictionary catalog used to read when it lived in Settings
const CATALOG_QUERY_KEYS = ['find', 'status'];

// Desktop: two columns (appearance, global lookup, about on the left; packs
// and dictionary preferences on the right). Phone: rows opening My glossary
// and Dictionaries first, then the cards; Dictionary preferences opens as a
// sub-screen (?view=preferences) with a back arrow.
export default {
  name: 'ConfigurePage',
  components: {
    UiIcon,
    UiList,
    UiListItem,
    AppearanceCard,
    GlobalLookupCard,
    AboutCard,
    PackManagerCard,
    ScannedDictionariesCard,
    DictionaryPreferencesCard,
  },
  data() {
    return {
      isMobile: ResizeService.isMobile(),
      dictionaryCount: (Storage.get('dictionaries') || []).length,
    };
  },
  computed: {
    view() {
      return this.isMobile ? String(this.$route.query.view || '') : '';
    },
    glossarySubtitle() {
      if (!supportsModularPacks()) return 'Your own definitions';
      const dictionaries = Lexicon.editableDictionaries();
      if (!dictionaries.length) return 'Your own definitions';
      const entries = dictionaries.reduce((sum, dictionary) => sum + (dictionary.entriesCount || 0), 0);
      return plural(entries, 'entry', 'entries');
    },
    dictionariesSubtitle() {
      if (!supportsModularPacks()) return plural(this.dictionaryCount, 'dictionary', 'dictionaries');
      const { installed, total, dictionaries } = packSummary(PackManager.installedPacks);
      return `${dictionaries} installed · ${installed} of ${total} packs`;
    },
  },
  watch: {
    // The dictionary catalog moved to Dictionaries; links that still point at
    // /settings?find=… or ?status=… are forwarded there.
    '$route.query': {
      immediate: true,
      handler(query) {
        if (this.$route.path !== '/settings') return;
        if (!CATALOG_QUERY_KEYS.some((key) => query && query[key] !== undefined)) return;
        const forwarded = {};
        CATALOG_QUERY_KEYS.forEach((key) => {
          if (query[key] !== undefined) forwarded[key] = query[key];
        });
        this.$router.replace({ path: '/dictionaries', query: forwarded });
      },
    },
  },
  created() {
    ResizeService.subscribe('configure-page', () => {
      this.isMobile = ResizeService.isMobile();
    });
    this.onDictionariesUpdated = () => {
      this.dictionaryCount = (Storage.get('dictionaries') || []).length;
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
  },
  unmounted() {
    ResizeService.unsubscribe('configure-page');
    window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
  },
  methods: {
    openPreferences() {
      this.$router.push({ path: '/settings', query: { view: 'preferences' } });
    },
    backToSettings() {
      // Back when Settings is the previous entry, so the hardware back button
      // and this arrow agree; otherwise replace, so we never leave the app.
      const previous = window.history.state?.back;
      if (typeof previous === 'string' && previous.split('?')[0] === '/settings') {
        this.$router.back();
      } else {
        this.$router.replace('/settings');
      }
    },
  },
};
</script>

<template>
  <div class="settings-page" :class="{ 'settings-page--phone': isMobile }" data-testid="settings-page">
    <!-- Phone sub-screen: Dictionary preferences -->
    <template v-if="view === 'preferences'">
      <button type="button" class="settings-page__back" data-testid="settings-back" @click="backToSettings">
        <span class="settings-page__back-icon"><ui-icon name="chevron-left" :size="22" :stroke-width="2.4" /></span>
        Settings
      </button>
      <h1 class="settings-page__title">Dictionary preferences</h1>
      <p class="settings-page__lead">Drag to reorder, switch off the ones you do not want</p>
      <dictionary-preferences-card bare />
    </template>

    <template v-else-if="isMobile">
      <span class="settings-page__eyebrow">Settings</span>

      <ui-list class="settings-rows">
        <ui-list-item
          title="My glossary"
          :subtitle="glossarySubtitle"
          clickable
          class="settings-row"
          data-testid="settings-row-glossary"
          @click="$router.push('/glossary')"
        >
          <template #append><ui-icon name="chevron-right" :size="18" :stroke-width="2" class="settings-row__chevron" /></template>
        </ui-list-item>
        <ui-list-item
          title="Dictionaries"
          :subtitle="dictionariesSubtitle"
          clickable
          class="settings-row"
          data-testid="settings-row-dictionaries"
          @click="$router.push('/dictionaries')"
        >
          <template #append><ui-icon name="chevron-right" :size="18" :stroke-width="2" class="settings-row__chevron" /></template>
        </ui-list-item>
      </ui-list>

      <appearance-card />
      <global-lookup-card />

      <ui-list class="settings-rows">
        <ui-list-item
          title="Dictionary preferences"
          subtitle="Reorder and switch off dictionaries"
          clickable
          class="settings-row"
          data-testid="settings-row-preferences"
          @click="openPreferences"
        >
          <template #append><ui-icon name="chevron-right" :size="18" :stroke-width="2" class="settings-row__chevron" /></template>
        </ui-list-item>
        <about-card rows />
      </ui-list>

      <pack-manager-card />
      <scanned-dictionaries-card />
    </template>

    <template v-else>
      <span class="settings-page__eyebrow">Settings</span>
      <div class="settings-page__columns">
        <div class="settings-page__column settings-page__column--main">
          <appearance-card />
          <global-lookup-card />
          <about-card />
          <scanned-dictionaries-card />
        </div>
        <div class="settings-page__column settings-page__column--side">
          <pack-manager-card />
              <dictionary-preferences-card />
        </div>
      </div>
    </template>
  </div>
</template>

<style>
/* Mockup "B · Settings": 28px 40px padding, 18px under the eyebrow,
   a 560px column and a flexible one, 24px apart, cards 16px apart. */
.settings-page {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px var(--space-8) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
}
/* The page scrolls; its blocks keep their height instead of shrinking */
.settings-page > *,
.settings-page__column > * {
  flex: none;
}
.settings-page__eyebrow {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.settings-page__columns {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.settings-page__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}
@media (min-width: 1180px) {
  .settings-page__columns {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--space-6);
  }
  .settings-page__column--main {
    flex: none;
    width: 35rem;
  }
  .settings-page__column--side {
    flex: 1;
  }
}

/* Phone board: 16px padding, 14px between blocks */
.settings-page--phone {
  gap: 14px;
  padding: var(--space-4) var(--space-4) var(--space-6);
}
.settings-rows.ui-list {
  box-shadow: var(--shadow-card);
  flex: none;
}
.settings-row .ui-list-item__row {
  min-height: 3.75rem;
  padding: var(--space-2) var(--space-4);
}
.settings-row .ui-list-item__text {
  gap: 2px;
}
.settings-row .ui-list-item__title {
  font-size: 0.9688rem;
  font-weight: 500;
}
.settings-row .ui-list-item__subtitle {
  font-size: var(--text-sm);
}
.settings-row__chevron {
  color: var(--faint);
}
.settings-row--accent .ui-list-item__row {
  color: var(--accent);
}

/* Phone sub-screen header: "‹ Settings" back link, then a 26px title */
.settings-page__back {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -6px -6px -6px;
  padding: 0 var(--space-2) 0 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: 600 0.9375rem var(--font-ui);
  cursor: pointer;
}
.settings-page__back-icon {
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings-page__back:focus-visible {
  outline: 2px solid var(--accent);
  border-radius: var(--radius-lg);
}
.settings-page__title {
  margin: 0;
  font-size: 1.625rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.settings-page__lead {
  margin: -6px 0 0;
  font-size: var(--text-sm);
  color: var(--muted);
}
</style>
