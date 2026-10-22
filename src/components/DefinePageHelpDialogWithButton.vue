<script>
  import { UiButton, UiDialog, UiIcon, UiTabs } from '../ui'
  import DictionariesMenuHelp from './DictionariesMenuHelp.vue'
  import { isMacOS, isTauri, isMobile } from '../config/platform'

  // The "?" in the navigation (rail on a desktop, floating above the bar on a
  // phone) and the help it opens while Define is shown.
  export default {
    components: {
      DictionariesMenuHelp,
      UiButton,
      UiDialog,
      UiIcon,
      UiTabs
    },
    data () {
      return {
        dialog: false,
        tab: 'dictionaries',
        isMobile: window.innerWidth <= 600,
        isMac: isMacOS(),
        isDesktop: isTauri() && !isMobile()
      }
    },
    computed: {
      modifierKey() {
        return this.isMac ? '⌘' : 'Ctrl'
      },
      tabs() {
        return [
          { value: 'dictionaries', label: 'Dictionaries filter' },
          this.isDesktop && { value: 'lookup', label: 'Quick Lookup' },
          !this.isMobile && { value: 'navigation', label: 'Navigation' }
        ].filter(Boolean)
      },
      pageShortcuts() {
        return [
          { key: 'D', html: 'Go to <u>D</u>efine page' },
          { key: 'S', html: 'Go to <u>S</u>earch page' },
          { key: 'T', html: 'Go to Spli<u>t</u> page' },
          { key: 'G', html: 'Go to Settin<u>g</u>s page' }
        ]
      }
    },
    watch: {
      tabs(tabs) {
        if (!tabs.some((tab) => tab.value === this.tab)) this.tab = 'dictionaries'
      }
    },
    methods: {
      handleResize() {
        this.isMobile = window.innerWidth <= 600;
      }
    },
    mounted() {
      window.addEventListener('resize', this.handleResize);
    },
    beforeUnmount() {
      window.removeEventListener('resize', this.handleResize);
    }
  }
</script>

<template>
  <span class="define-help">
    <button
      v-if="$route.path.includes('/define')"
      type="button"
      class="help-button define-help-button"
      aria-label="How to use the Define page"
      title="Help"
      data-testid="define-help-button"
      @click.stop.prevent="dialog = true"
    >
      <ui-icon name="circle-help" :size="24" />
    </button>

    <ui-dialog v-model="dialog" title="How to use the Define page" :max-width="1024">
      <div class="define-help-content" data-testid="define-help">
        <ui-tabs v-model="tab" :items="tabs">
          <template #panel-dictionaries>
            <DictionariesMenuHelp :is-mobile="isMobile" />
          </template>

          <template #panel-lookup>
            <div class="quick-lookup-layout">
              <div class="quick-lookup-video">
                <video
                  src="/img/global-lookup-demo.mp4"
                  autoplay
                  loop
                  muted
                  playsinline
                />
              </div>
              <div class="quick-lookup-content">
                <p>
                  You can look up Tibetan text from anywhere on your system using a keyboard shortcut.
                </p>
                <table class="help-shortcuts">
                  <tbody>
                    <tr>
                      <td class="help-shortcuts__keys">
                        <kbd class="help-key">{{ modifierKey }}</kbd>
                        <kbd class="help-key">C</kbd>
                      </td>
                      <td><strong>Copy</strong> Tibetan text from any app</td>
                    </tr>
                    <tr>
                      <td class="help-shortcuts__keys">
                        <kbd class="help-key">{{ modifierKey }}</kbd>
                        <kbd class="help-key"><ui-icon name="arrow-big-up" :size="14" /></kbd>
                        <kbd class="help-key">C</kbd>
                      </td>
                      <td><strong>Open</strong> the lookup popup with dictionary results</td>
                    </tr>
                  </tbody>
                </table>
                <p class="help-note">
                  You can change this hotkey in Settings, under Global Lookup.
                </p>
              </div>
            </div>
          </template>

          <template #panel-navigation>
            <h3 class="help-heading">Keyboard shortcuts</h3>
            <table class="help-shortcuts">
              <tbody>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key"><ui-icon name="arrow-up" :size="14" /></kbd>
                  </td>
                  <td>Select previous entry in results</td>
                </tr>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key"><ui-icon name="arrow-down" :size="14" /></kbd>
                  </td>
                  <td>Select next entry in results</td>
                </tr>
                <tr v-for="shortcut in pageShortcuts" :key="shortcut.key">
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key">{{ modifierKey }}</kbd>
                    <kbd class="help-key">{{ shortcut.key }}</kbd>
                  </td>
                  <!-- eslint-disable-next-line vue/no-v-html -- static text above -->
                  <td v-html="shortcut.html" />
                </tr>
              </tbody>
            </table>
          </template>
        </ui-tabs>
      </div>

      <template #actions>
        <ui-button variant="ghost" data-testid="define-help-close" @click="dialog = false">Close</ui-button>
      </template>
    </ui-dialog>
  </span>
</template>

<style>
/* The button: yellow in the rail, a floating disc above the phone's bar */
.define-help-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 0;
  border-radius: var(--radius-xl);
  background: none;
  color: var(--rail-active-ink);
  cursor: pointer;
}
.define-help-button:hover {
  background: var(--rail-active-bg);
}
.define-help-button:focus-visible {
  outline: 2px solid var(--rail-active-ink);
  outline-offset: 2px;
}
.app-nav--bar .define-help-button {
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--accent);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}
.app-nav--bar .define-help-button:hover {
  background: var(--soft);
}

/* Shared by the help panels (the dialog is rendered outside this component) */
.define-help-content {
  font-size: var(--text-base);
  line-height: 1.6;
}
.define-help-content p {
  margin: 0 0 1em;
}
.define-help-content .help-heading {
  margin: 0 0 8px;
  font-size: var(--text-md);
  font-weight: 600;
}
.define-help-content .help-shortcuts {
  border-collapse: collapse;
  width: 100%;
}
.define-help-content .help-shortcuts td {
  padding: 6px 0;
  border-bottom: 1px solid var(--soft);
  vertical-align: middle;
}
.define-help-content .help-shortcuts__keys {
  width: 1%;
  padding-right: 18px !important;
  white-space: nowrap;
}
.define-help-content .help-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  margin-right: 4px;
  padding: 0 6px;
  box-sizing: border-box;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font: 600 var(--text-xs) var(--font-ui);
}
.define-help-content .help-or {
  margin: 0 8px 0 4px;
  font-size: var(--text-xs);
  color: var(--muted);
}
.define-help-content .help-note {
  font-size: var(--text-sm);
  color: var(--muted);
}

.quick-lookup-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.quick-lookup-video {
  flex: 0 0 45%;
}
.quick-lookup-video video {
  width: 100%;
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
}
.quick-lookup-content {
  flex: 1;
  min-width: 0;
}
@media (max-width: 760px) {
  .quick-lookup-layout {
    flex-direction: column;
  }
}
</style>
