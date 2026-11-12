<script>
import UiIcon from '../ui/UiIcon.vue';
import { navItemsFor, activeNavId, REFOLLOW_EVENT } from '../config/navigation';
import { recentTerms } from '../services/history';
import { savedTerms } from '../services/saved-terms';

const RECENT_LIMIT = 8;

// Desktop: a sidebar with the app name, Lookup / Reader / Library, the recent
// and saved terms, and Settings at the bottom.
// Phone: a bottom bar with the same three tabs.
export default {
  name: 'AppNav',
  components: { UiIcon },
  props: {
    isMobile: { type: Boolean, default: false },
    // Shows a dot on Settings (Library on a phone) when an update is waiting for a restart
    updateReady: { type: Boolean, default: false },
  },
  data() {
    return {
      recent: recentTerms().slice(0, RECENT_LIMIT),
      saved: savedTerms(),
    };
  },
  computed: {
    items() {
      return navItemsFor(this.isMobile);
    },
    activeId() {
      return this.$route.path.startsWith('/library') && this.$route.hash === '#settings'
        ? 'settings'
        : activeNavId(this.$route.path, this.isMobile);
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
    // Already on /library#settings: vue-router ignores the link, so ask the
    // page to scroll back to the section itself
    followSettings(event, navigate) {
      if (this.$route.fullPath === '/library#settings') {
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
      this.recent = recentTerms().slice(0, RECENT_LIMIT);
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
      <router-link
        v-for="item in items"
        :key="item.id"
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
              v-if="isMobile && item.id === 'library' && updateReady"
              class="app-nav__dot"
              data-testid="nav-update-dot"
            />
          </span>
          {{ item.label }}
        </a>
      </router-link>
    </div>

    <template v-if="!isMobile">
      <section v-if="recent.length" class="app-nav__section" data-testid="nav-recent">
        <h2 class="app-nav__label">Recent</h2>
        <router-link
          v-for="term in recent"
          :key="term"
          v-slot="{ href, navigate }"
          :to="termPath(term)"
          custom
        >
          <a
            :href="href"
            class="app-nav__term"
            :class="{ 'is-current': term === currentTerm }"
            @click="navigate"
          >{{ term }}</a>
        </router-link>
      </section>

      <section v-if="saved.length" class="app-nav__section" data-testid="nav-saved">
        <h2 class="app-nav__label">Saved</h2>
        <router-link
          v-for="term in saved"
          :key="term"
          v-slot="{ href, navigate }"
          :to="termPath(term)"
          custom
        >
          <a
            :href="href"
            class="app-nav__term"
            :class="{ 'is-current': term === currentTerm }"
            @click="navigate"
          >{{ term }}</a>
        </router-link>
      </section>

      <div class="app-nav__spacer" />

      <router-link v-slot="{ href, navigate }" to="/library#settings" custom>
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
.app-nav__term {
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

/* Phone bottom bar: three tabs, accent on the active one */
.app-nav--bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
