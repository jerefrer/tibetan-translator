<script>
import UiIcon from '../ui/UiIcon.vue';
import { navItemsFor, activeNavId, REFOLLOW_EVENT } from '../config/navigation';
import Storage from '../services/storage';
import { clearHistory, forgetTerm, recentTerms } from '../services/history';
import { removeSaved, savedTerms } from '../services/saved-terms';
import { helpState, toggleHelp, topicForRoute } from '../services/help';

// Terms each section of the sidebar shows; Saved links to all of them
const SECTION_LIMIT = 8;
const FOLDED_KEY = 'sidebarFolded';

// Desktop: a sidebar with the app name, Lookup / Reader, My glossary /
// Dictionaries, the recent and saved terms (eight of each, a × on each to
// forget it, Clear for Recent, All for the Saved page; each section folds, and
// stays folded), and Help and Settings at the bottom.
// Phone: a bottom bar with Lookup, Reader and Settings.
export default {
  name: 'AppNav',
  components: { UiIcon },
  props: {
    isMobile: { type: Boolean, default: false },
    // Shows a dot on Settings (a tab on a phone) when an update is waiting for a restart
    updateReady: { type: Boolean, default: false },
  },
  data() {
    return {
      recent: recentTerms().slice(0, SECTION_LIMIT),
      saved: savedTerms(),
      folded: { recent: false, saved: false, ...Storage.get(FOLDED_KEY, {}) },
      help: helpState,
    };
  },
  computed: {
    sectionLimit() {
      return SECTION_LIMIT;
    },
    items() {
      return navItemsFor(this.isMobile);
    },
    activeId() {
      return activeNavId(this.$route.path, this.isMobile);
    },
    currentTerm() {
      const match = this.$route.path.match(/^\/lookup\/(.+)$/);
      if (!match) return '';
      try {
        return decodeURIComponent(match[1]);
      } catch (error) {
        return match[1];
      }
    },
  },
  methods: {
    // Already on /settings: vue-router ignores the link, so ask the page to
    // scroll back to the top itself
    followSettings(event, navigate) {
      if (this.$route.fullPath === '/settings') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(REFOLLOW_EVENT));
        return;
      }
      navigate(event);
    },
    hint(item) {
      return item.shortcut ? `${item.label} (Ctrl/Cmd+${item.shortcut})` : item.label;
    },
    termPath(term) {
      return `/lookup/${encodeURIComponent(term)}`;
    },
    refreshRecent() {
      this.recent = recentTerms().slice(0, SECTION_LIMIT);
    },
    toggleHelp() {
      toggleHelp(topicForRoute(this.$route));
    },
    toggleFold(section) {
      this.folded = { ...this.folded, [section]: !this.folded[section] };
      Storage.set(FOLDED_KEY, this.folded);
    },
    forgetRecent(term) {
      forgetTerm(term);
      this.refreshRecent();
    },
    unsave(term) {
      removeSaved(term);
      this.refreshSaved();
    },
    clearRecent() {
      clearHistory();
      this.refreshRecent();
    },
    refreshSaved() {
      this.saved = savedTerms();
    },
  },
  mounted() {
    window.addEventListener('recents-updated', this.refreshRecent);
    window.addEventListener('saved-terms-updated', this.refreshSaved);
  },
  beforeUnmount() {
    window.removeEventListener('recents-updated', this.refreshRecent);
    window.removeEventListener('saved-terms-updated', this.refreshSaved);
  },
};
</script>

<template>
  <nav
    class="app-nav"
    :class="isMobile ? 'app-nav--bar' : 'app-nav--sidebar'"
    aria-label="Main"
    data-testid="app-nav"
  >
    <div v-if="!isMobile" class="app-nav__brand">
      <img class="app-nav__logo" src="/img/app-icon.png" alt="" />
      <span class="app-nav__name">Tibetan Translator</span>
    </div>

    <div class="app-nav__items">
      <template v-for="(item, index) in items" :key="item.id">
      <span
        v-if="!isMobile && index > 0 && item.group !== items[index - 1].group"
        class="app-nav__separator"
        role="separator"
        data-testid="nav-separator"
      />
      <router-link
        v-slot="{ href, navigate }"
        :to="item.path"
        custom
      >
        <a
          :href="href"
          class="app-nav__item"
          :class="{ 'is-active': item.id === activeId }"
          :aria-current="item.id === activeId ? 'page' : undefined"
          :title="isMobile ? undefined : hint(item)"
          :data-testid="'nav-' + item.id"
          @click="navigate"
        >
          <span class="app-nav__icon">
            <ui-icon :name="item.icon" :size="isMobile ? 24 : 18" />
            <span
              v-if="isMobile && item.id === 'settings' && updateReady"
              class="app-nav__dot"
              data-testid="nav-update-dot"
            />
          </span>
          {{ item.label }}
        </a>
      </router-link>
      </template>
    </div>

    <template v-if="!isMobile">
      <section v-if="recent.length" class="app-nav__section" data-testid="nav-recent">
        <div class="app-nav__section-head">
          <h2 class="app-nav__label">
            <button type="button" class="app-nav__fold" :aria-expanded="folded.recent ? 'false' : 'true'" data-testid="nav-fold" @click="toggleFold('recent')">
              <ui-icon name="chevron-right" :size="12" :stroke-width="2.6" class="app-nav__fold-icon" />
              Recent
            </button>
          </h2>
          <button type="button" class="app-nav__head-action" data-testid="nav-recent-clear" @click="clearRecent">Clear</button>
        </div>
        <template v-if="!folded.recent">
          <div v-for="term in recent" :key="term" class="app-nav__term-row">
            <router-link v-slot="{ href, navigate }" :to="termPath(term)" custom>
              <a :href="href" class="app-nav__term" :class="{ 'is-current': term === currentTerm }" @click="navigate">{{ term }}</a>
            </router-link>
            <button type="button" class="app-nav__forget" :aria-label="'Forget ' + term" title="Forget" data-testid="nav-forget" @click="forgetRecent(term)">
              <ui-icon name="x" :size="14" />
            </button>
          </div>
        </template>
      </section>

      <section v-if="saved.length" class="app-nav__section" data-testid="nav-saved">
        <div class="app-nav__section-head">
          <h2 class="app-nav__label">
            <button type="button" class="app-nav__fold" :aria-expanded="folded.saved ? 'false' : 'true'" data-testid="nav-fold" @click="toggleFold('saved')">
              <ui-icon name="chevron-right" :size="12" :stroke-width="2.6" class="app-nav__fold-icon" />
              Saved · {{ saved.length }}
            </button>
          </h2>
          <router-link to="/saved" class="app-nav__head-action" data-testid="nav-saved-all">All</router-link>
        </div>
        <template v-if="!folded.saved">
          <div v-for="term in saved.slice(0, sectionLimit)" :key="term" class="app-nav__term-row">
            <router-link v-slot="{ href, navigate }" :to="termPath(term)" custom>
              <a :href="href" class="app-nav__term" :class="{ 'is-current': term === currentTerm }" @click="navigate">{{ term }}</a>
            </router-link>
            <button type="button" class="app-nav__forget" :aria-label="'Remove ' + term + ' from Saved'" title="Remove from Saved" data-testid="nav-forget" @click="unsave(term)">
              <ui-icon name="x" :size="14" />
            </button>
          </div>
          <router-link v-if="saved.length > sectionLimit" to="/saved" class="app-nav__more">
            {{ saved.length - sectionLimit }} more…
          </router-link>
        </template>
      </section>

      <div class="app-nav__spacer" />

      <div class="app-nav__items">
        <button
          type="button"
          class="app-nav__item"
          :class="{ 'is-active': help.open }"
          :aria-pressed="help.open ? 'true' : 'false'"
          title="Help (F1)"
          data-testid="nav-help"
          @click="toggleHelp"
        >
          <span class="app-nav__icon"><ui-icon name="circle-help" :size="18" /></span>
          Help
        </button>

        <router-link v-slot="{ href, navigate }" to="/settings" custom>
          <a
            :href="href"
            class="app-nav__item"
            :class="{ 'is-active': activeId === 'settings' }"
            :aria-current="activeId === 'settings' ? 'page' : undefined"
            data-testid="nav-settings"
            @click="followSettings($event, navigate)"
          >
            <span class="app-nav__icon">
              <ui-icon name="settings" :size="18" />
              <span v-if="updateReady" class="app-nav__dot" data-testid="nav-update-dot" />
            </span>
            Settings
          </a>
        </router-link>
      </div>
    </template>
  </nav>
</template>

<style>
.app-nav {
  position: relative;
  flex: none;
  box-sizing: border-box;
  color: var(--muted);
  font-family: var(--font-ui);
  display: flex;
}

.app-nav__item {
  box-sizing: border-box;
  border: 0;
  background: none;
  font-family: inherit;
  text-align: left;
  color: var(--ink);
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.app-nav__item:focus-visible,
.app-nav__term:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.app-nav__icon {
  position: relative;
  display: inline-flex;
}
.app-nav__dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-quiet);
  box-sizing: content-box;
}

/* Desktop sidebar */
.app-nav--sidebar {
  width: var(--sidebar-width);
  flex-direction: column;
  gap: 22px;
  padding: 18px 14px;
  padding-top: calc(18px + var(--safe-top));
  background: var(--bg-quiet);
  border-right: 1px solid var(--line);
  overflow-y: auto;
}
.is-android .app-nav--sidebar {
  padding-top: calc(18px + 24px);
}
.app-nav__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px;
}
.app-nav__logo {
  width: 30px;
  height: 30px;
  flex: none;
}
.app-nav__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ink);
}
.app-nav__separator {
  display: block;
  height: 1px;
  margin: var(--space-2) var(--space-2);
  background: var(--line);
}
.app-nav--sidebar .app-nav__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.app-nav--sidebar .app-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-weight: 500;
}
.app-nav--sidebar .app-nav__item:hover {
  background: var(--soft);
}
.app-nav--sidebar .app-nav__item.is-active {
  background: var(--accent-soft);
  color: var(--accent);
}
.app-nav__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.app-nav__label {
  margin: 0;
  padding: 0 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}
.app-nav__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-right: 6px;
}
.app-nav__label .app-nav__fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: -4px;
  padding: 2px 4px;
  border: 0;
  border-radius: var(--radius-xs);
  background: none;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
}
.app-nav__fold:hover {
  color: var(--ink);
}
.app-nav__fold:focus-visible,
.app-nav__head-action:focus-visible,
.app-nav__forget:focus-visible,
.app-nav__more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.app-nav__fold-icon {
  transform: rotate(90deg);
  transition: transform 0.15s ease;
}
.app-nav__fold[aria-expanded='false'] .app-nav__fold-icon {
  transform: none;
}
.app-nav__head-action {
  padding: 2px 4px;
  border: 0;
  border-radius: var(--radius-xs);
  background: none;
  font: 500 var(--text-xs) var(--font-ui);
  color: var(--faint);
  text-decoration: none;
  cursor: pointer;
}
.app-nav__head-action:hover {
  color: var(--accent);
}
.app-nav__term-row {
  position: relative;
  display: flex;
  align-items: center;
}
.app-nav__forget {
  position: absolute;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--soft);
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.app-nav__term-row:hover .app-nav__forget,
.app-nav__forget:focus-visible {
  opacity: 1;
}
.app-nav__forget:hover {
  color: var(--ink);
}
@media (hover: none) {
  .app-nav__forget {
    opacity: 1;
  }
}
.app-nav__more {
  padding: 2px 10px;
  font-size: var(--text-sm);
  color: var(--muted);
  text-decoration: none;
}
.app-nav__more:hover {
  color: var(--accent);
}
@media (prefers-reduced-motion: reduce) {
  .app-nav__fold-icon,
  .app-nav__forget {
    transition: none;
  }
}
.app-nav__term {
  flex: 1;
  min-width: 0;
  display: block;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-tibetan);
  font-size: 1.0625rem;
  line-height: 1.5;
  color: var(--rubric);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-nav__term:hover,
.app-nav__term.is-current {
  background: var(--soft);
}
.app-nav__spacer {
  flex: 1;
}

/* Phone bottom bar: one equal column per tab, accent on the active one */
.app-nav--bar {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  height: calc(var(--bottom-bar-height) - 14px + max(14px, var(--safe-bottom)));
  padding: 6px 8px max(14px, var(--safe-bottom));
  background: var(--surface);
  border-top: 1px solid var(--line);
}
.app-nav--bar .app-nav__items {
  display: contents;
}
.app-nav--bar .app-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  border-radius: var(--radius-xl);
  color: var(--muted);
  font-size: var(--text-caption);
  font-weight: 500;
}
.app-nav--bar .app-nav__item:active {
  background: var(--soft);
}
.app-nav--bar .app-nav__item.is-active {
  color: var(--accent);
  font-weight: 600;
}
.app-nav--bar .app-nav__dot {
  border-color: var(--surface);
}
</style>
