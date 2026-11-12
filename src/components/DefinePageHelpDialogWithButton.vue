<script>
  import { UiButton, UiDialog, UiIcon, UiTabs } from '../ui'
  import DictionariesMenuHelp from './DictionariesMenuHelp.vue'
  import { HELP_SHORTCUTS } from '../config/navigation'
  import { isMacOS, isTauri, isMobile } from '../config/platform'

  // How to look up a word in Lookup, opened from Library's help rows. The file
  // keeps the name it had when a "?" button opened it on the Define page.
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
        tab: 'word',
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
          { value: 'word', label: 'Looking up' },
          { value: 'dictionaries', label: 'Dictionaries filter' },
          this.isDesktop && { value: 'lookup', label: 'Quick Lookup' },
          !this.isMobile && { value: 'navigation', label: 'Navigation' }
        ].filter(Boolean)
      },
      pageShortcuts() {
        return HELP_SHORTCUTS
      }
    },
    watch: {
      tabs(tabs) {
        if (!tabs.some((tab) => tab.value === this.tab)) this.tab = 'word'
      }
    },
    methods: {
      open() {
        this.dialog = true
      },
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

    <ui-dialog v-model="dialog" title="Looking up a word" :max-width="1024">
      <div class="define-help-content" data-testid="define-help">
        <ui-tabs v-model="tab" :items="tabs">
          <template #panel-word>
            <h3 class="help-heading">One field, two languages</h3>
            <p>
              Type in the field and the results follow. The <strong>བོད</strong> / <strong>EN</strong>
              switch beside it tells Lookup what you are typing.
            </p>
            <ul class="help-list" data-testid="lookup-help-modes">
              <li>
                <strong>བོད</strong> looks up Tibetan terms. Type Wylie and it becomes Tibetan as you
                go (<code>sangs rgyas</code> followed by a space gives <span class="tibetan">སངས་རྒྱས་</span>),
                or paste Tibetan.
              </li>
              <li>
                <strong>EN</strong> searches the English text of the definitions.
              </li>
            </ul>
            <p>
              When what you typed fits the other mode better, a hint under the field offers to switch,
              for instance to search the definitions when no Tibetan term starts with your text.
            </p>
            <h3 class="help-heading">What you get</h3>
            <p>
              Open a result to read its entry: <strong>In short</strong> gathers the meanings several
              dictionaries agree on, and the definitions follow, dictionary by dictionary. Links inside a
              definition open that term.
            </p>
            <p>
              Before you type anything, Lookup lists your <strong>Recent</strong> terms and the ones you
              <strong>Saved</strong>. Tap one to open it again.
            </p>
          </template>

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
                  You can change this hotkey in the Library, under Settings.
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
                  <td>{{ shortcut.text }}</td>
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
.define-help-content .help-list {
  margin: 0 0 1em;
  padding-left: 1.25em;
}
.define-help-content .help-list li {
  margin-bottom: 0.4em;
}
.define-help-content code {
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background: var(--soft);
  font-size: 0.92em;
}
.define-help-content .tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.2em;
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
