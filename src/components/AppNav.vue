<script>
import UiIcon from '../ui/UiIcon.vue';
import { navItemsFor, activeNavId } from '../config/navigation';

// Desktop: a vertical rail with Define / Search / Split, a divider,
// Glossary / Dictionaries, and Settings at the bottom.
// Phone: a bottom bar with four tabs. The `help` slot receives the
// per-page help buttons.
export default {
  name: 'AppNav',
  components: { UiIcon },
  props: {
    isMobile: { type: Boolean, default: false },
    // Shows a dot on Settings when an update is waiting for a restart
    updateReady: { type: Boolean, default: false },
  },
  computed: {
    items() {
      return navItemsFor(this.isMobile);
    },
    activeId() {
      return activeNavId(this.$route.path, this.isMobile);
    },
    toolItems() {
      return this.items.filter((item) => item.group === 'tools');
    },
    libraryItems() {
      return this.items.filter((item) => item.group === 'library');
    },
    bottomItems() {
      return this.items.filter((item) => item.group === 'bottom');
    },
  },
  methods: {
    hint(item) {
      return item.shortcut ? `${item.label} (Ctrl/Cmd+${item.shortcut})` : item.label;
    },
  },
};
</script>

<template>
  <nav
    class="app-nav"
    :class="isMobile ? 'app-nav--bar' : 'app-nav--rail'"
    aria-label="Main"
    data-testid="app-nav"
  >
    <div v-if="!isMobile" class="app-nav__logo" aria-hidden="true">
      <span>ཀ</span>
    </div>

    <template v-if="isMobile">
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
          :data-testid="'nav-' + item.id"
          @click="navigate"
        >
          <span class="app-nav__icon">
            <ui-icon :name="item.icon" :size="22" />
            <span
              v-if="item.id === 'settings' && updateReady"
              class="app-nav__dot"
              data-testid="nav-update-dot"
            />
          </span>
          {{ item.label }}
        </a>
      </router-link>
    </template>

    <template v-else>
      <router-link
        v-for="item in toolItems"
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
          :title="hint(item)"
          :data-testid="'nav-' + item.id"
          @click="navigate"
        >
          <ui-icon :name="item.icon" :size="22" />
          {{ item.label }}
        </a>
      </router-link>

      <div class="app-nav__divider" role="separator" />

      <router-link
        v-for="item in libraryItems"
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
          :title="hint(item)"
          :data-testid="'nav-' + item.id"
          @click="navigate"
        >
          <ui-icon :name="item.icon" :size="22" />
          {{ item.label }}
        </a>
      </router-link>

      <div class="app-nav__spacer" />

      <div class="app-nav__help" data-testid="nav-help">
        <slot name="help" />
      </div>

      <router-link
        v-for="item in bottomItems"
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
          :title="hint(item)"
          :data-testid="'nav-' + item.id"
          @click="navigate"
        >
          <span class="app-nav__icon">
            <ui-icon :name="item.icon" :size="22" />
            <span
              v-if="item.id === 'settings' && updateReady"
              class="app-nav__dot"
              data-testid="nav-update-dot"
            />
          </span>
          {{ item.label }}
        </a>
      </router-link>
    </template>

    <div v-if="isMobile" class="app-nav__help" data-testid="nav-help">
      <slot name="help" />
    </div>
  </nav>
</template>

<style>
.app-nav {
  position: relative;
  flex: none;
  box-sizing: border-box;
  background: var(--rail-bg);
  color: var(--rail-ink);
  font-family: var(--font-ui);
  display: flex;
}

.app-nav--rail {
  width: var(--rail-width);
  border-right: 1px solid var(--rail-line);
  flex-direction: column;
  align-items: center;
  padding: var(--space-5) 0;
  padding-top: calc(var(--space-5) + var(--safe-top));
  gap: 6px;
  overflow-y: auto;
}

/* Android reports no safe-area inset for its status bar */
.is-android .app-nav--rail {
  padding-top: calc(var(--space-5) + 24px);
}

.app-nav--bar {
  height: calc(var(--bottom-bar-height) - 14px + max(14px, var(--safe-bottom)));
  border-top: 1px solid var(--rail-line);
  padding: 6px 8px max(14px, var(--safe-bottom));
}

.app-nav__logo {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: var(--radius-xl);
  background: var(--logo-bg);
  color: var(--logo-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
}
.app-nav__logo span {
  font-family: var(--font-tibetan);
  font-size: 1.875rem;
  line-height: 1;
  margin-top: 6px;
}

.app-nav__item {
  box-sizing: border-box;
  border-radius: var(--radius-xl);
  color: var(--rail-ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: var(--text-caption);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.app-nav--rail .app-nav__item {
  width: 68px;
  min-height: 62px;
  flex: none;
}
.app-nav--bar .app-nav__item {
  flex: 1;
  min-width: 0;
}
.app-nav__item.is-active {
  background: var(--rail-active-bg);
  color: var(--rail-active-ink);
  font-weight: 600;
}
.app-nav__item:focus-visible {
  outline: 2px solid var(--rail-active-ink);
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
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--rail-active-ink);
  border: 2px solid var(--rail-bg);
  box-sizing: content-box;
}
.app-nav__item.is-active .app-nav__dot {
  border-color: var(--rail-active-bg);
}

.app-nav__divider {
  width: 36px;
  height: 1px;
  flex: none;
  background: var(--rail-line);
  margin: 10px 0 8px;
}
.app-nav__spacer {
  flex: 1;
}

/* Per-page help button. On the rail it sits above Settings. */
.app-nav--rail .app-nav__help {
  display: flex;
  justify-content: center;
}
.app-nav--rail .app-nav__help:empty {
  display: none;
}
.app-nav .help-button {
  position: static;
  margin: 0;
  opacity: 0.85;
}
.app-nav .help-button:hover {
  opacity: 1;
}
.app-nav .help-button .v-icon {
  color: var(--rail-active-ink) !important;
}

/* On a phone the button floats just above the bar. */
.app-nav--bar .app-nav__help {
  position: absolute;
  right: 8px;
  bottom: 100%;
  margin-bottom: 6px;
  z-index: 5;
}
.app-nav--bar .app-nav__help .help-button {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
}
.app-nav--bar .app-nav__help .help-button .v-icon {
  color: var(--accent) !important;
}
</style>
