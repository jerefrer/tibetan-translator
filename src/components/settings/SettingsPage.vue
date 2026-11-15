<script>
import Storage from '../../services/storage';
import ResizeService from '../../services/resize-service';
import GlobalLookup from '../../services/global-lookup';
import { Lexicon } from '../../services/lexicon';
import { supportsModularPacks } from '../../config/platform';
import { REFOLLOW_EVENT } from '../../config/navigation';
import AppearanceCard from './AppearanceCard.vue';
import GlobalLookupCard from './GlobalLookupCard.vue';
import AboutCard from './AboutCard.vue';
import ScannedDictionariesCard from './ScannedDictionariesCard.vue';
import AudioCard from './AudioCard.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';
import { openHelp } from '../../services/help';
import { plural } from './pack-summary';

// Settings, and nothing else (boards DesktopSettings, MobileSettings): each
// setting a row, its name and a line of explanation on the left, its control
// on the right, in a few groups. General, Quick lookup (the desktop app),
// Offline content (scans and recordings), About (the app), and on a phone
// Help, one row to the help's topics (a desktop has Help in its sidebar).
// Dictionaries, their packs and their order are on the Dictionaries page.
//
// Desktop: a column of groups, an index of them on its left. Phone: the
// glossary and the dictionaries first, as rows (no sidebar there), then the
// groups on the grey ground.
//
// The page is kept alive, so a hash (`/settings#settings-about`) is followed
// on `activated` and whenever the route's hash changes, not only on `mounted`.
export default {
  name: 'SettingsPage',
  components: {
    AppearanceCard,
    GlobalLookupCard,
    AboutCard,
    ScannedDictionariesCard,
    AudioCard,
    SettingsGroup,
    SettingsRow,
  },
  data() {
    return {
      isMobile: ResizeService.isMobile(),
      dictionaries: Storage.get('dictionaries') || [],
      modular: supportsModularPacks(),
      // The group the index highlights: the one at the top of the column
      currentSection: 'settings-general',
    };
  },
  computed: {
    // The groups shown, in order, for the index
    sections() {
      return [
        { id: 'settings-general', title: 'General' },
        GlobalLookup.isSupported() && { id: 'settings-quick-lookup', title: 'Quick lookup' },
        { id: 'settings-offline', title: 'Offline content' },
        { id: 'settings-about', title: 'About' },
      ].filter(Boolean);
    },
    glossaryStatus() {
      if (!this.modular) return '';
      const dictionaries = Lexicon.editableDictionaries();
      if (!dictionaries.length) return '';
      const entries = dictionaries.reduce((sum, dictionary) => sum + (dictionary.entriesCount || 0), 0);
      return plural(entries, 'entry', 'entries');
    },
    dictionariesStatus() {
      const on = this.dictionaries.filter((dictionary) => dictionary.enabled !== false).length;
      return `${on} of ${this.dictionaries.length} on`;
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
      this.dictionaries = Storage.get('dictionaries') || [];
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
    // The sidebar's Settings link and Cmd/Ctrl+G, followed while already on /settings
    window.addEventListener(REFOLLOW_EVENT, this.onRefollow);
  },
  mounted() {
    this.scrollToHash();
  },
  activated() {
    this.dictionaries = Storage.get('dictionaries') || [];
    this.scrollToHash();
  },
  unmounted() {
    ResizeService.unsubscribe('settings-page');
    window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
    window.removeEventListener(REFOLLOW_EVENT, this.onRefollow);
  },
  methods: {
    openHelp,
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
      this.scrollToSection(id);
    },
    scrollToSection(id) {
      // The id is read as an id, never built into a selector
      const section = document.getElementById(id);
      if (!section || !this.$refs.page?.contains(section)) return;
      section.scrollIntoView({ block: 'start' });
      this.currentSection = id;
    },
    // The index follows the scroll: the last group whose top has passed the
    // top of the page
    onScroll() {
      const page = this.$refs.page;
      if (!page || this.isMobile) return;
      const top = page.getBoundingClientRect().top + 80;
      let current = this.sections[0]?.id;
      for (const { id } of this.sections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= top) current = id;
      }
      this.currentSection = current;
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
    @scroll.passive="onScroll"
  >
    <div class="settings-page__layout">
      <nav v-if="!isMobile" class="settings-page__index" aria-label="Settings sections" data-testid="settings-index">
        <a
          v-for="section in sections"
          :key="section.id"
          :href="'#' + section.id"
          class="settings-page__index-link"
          :class="{ 'is-current': section.id === currentSection }"
          :aria-current="section.id === currentSection ? 'true' : undefined"
          @click.prevent="scrollToSection(section.id)"
        >{{ section.title }}</a>
      </nav>

      <div class="settings-page__column">
        <h1 class="settings-page__title">Settings</h1>

        <settings-group v-if="isMobile" id="settings-collections" data-testid="settings-collections">
          <settings-row title="My glossary" icon="notebook-pen" clickable data-testid="settings-row-glossary" @click="$router.push('/glossary')">
            {{ glossaryStatus }}
          </settings-row>
          <settings-row title="Dictionaries" icon="book-open" clickable data-testid="settings-row-dictionaries" @click="$router.push('/dictionaries')">
            {{ dictionariesStatus }}
          </settings-row>
        </settings-group>

        <appearance-card />
        <global-lookup-card />

        <settings-group id="settings-offline" title="Offline content" data-testid="settings-offline">
          <scanned-dictionaries-card />
          <audio-card />
          <template #after>
            <p class="settings-page__note">
              Dictionary packs, their order and which ones lookups use are in
              <router-link to="/dictionaries">Dictionaries</router-link>.
            </p>
          </template>
        </settings-group>

        <about-card />

        <settings-group v-if="isMobile" id="settings-help" title="Help" data-testid="settings-help">
          <settings-row
            title="Help topics"
            icon="circle-help"
            description="Typing Wylie, looking up, searching, reading, your glossary"
            clickable
            data-testid="settings-help-topics"
            @click="openHelp()"
          />
        </settings-group>
      </div>
    </div>
  </div>
</template>

<style>
/* Desktop: the index on the left of a 680px column of groups */
.settings-page {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: var(--space-7) var(--space-8) var(--space-8);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
}
.settings-page__layout {
  display: flex;
  justify-content: center;
  gap: var(--space-8);
}
.settings-page__index {
  position: sticky;
  top: 0;
  flex: none;
  align-self: flex-start;
  width: 10.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 3.5rem;
}
.settings-page__index-link {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
}
.settings-page__index-link:hover {
  color: var(--ink);
}
.settings-page__index-link.is-current {
  background: var(--soft);
  color: var(--ink);
}
.settings-page__index-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.settings-page__column {
  flex: 0 1 42.5rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.settings-page__title {
  margin: 0;
  font-size: var(--text-heading);
  font-weight: 700;
  letter-spacing: -0.01em;
}
.settings-page__note {
  margin: 0 2px;
  font-size: var(--text-sm);
  color: var(--muted);
}
.settings-page__note a {
  color: var(--accent);
}

/* No room for the index beside the column */
@media (max-width: 1000px) {
  .settings-page__index {
    display: none;
  }
}

/* Phone: a large title and white groups on the grey ground */
.settings-page--phone {
  padding: 22px var(--space-4) var(--space-6);
  background: var(--bg-grouped);
}
.settings-page--phone .settings-page__column {
  gap: 18px;
}
.settings-page--phone .settings-page__title {
  font-size: var(--text-large-title);
}
.settings-page--phone .settings-page__note {
  margin: 0 var(--space-1);
}
</style>
