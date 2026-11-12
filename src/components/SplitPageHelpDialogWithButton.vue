<script>
  import { UiButton, UiDialog, UiIcon, UiTabs } from '../ui'
  import DictionariesMenuHelp from './DictionariesMenuHelp.vue'
  import { HELP_SHORTCUTS } from '../config/navigation'
  import { isMacOS } from '../config/platform'

  // How to read a text in Reader, opened from Settings' help rows. The panels
  // use the styles of DefinePageHelpDialogWithButton.vue (global). The file
  // keeps the name it had when a "?" button opened it on the Split page.
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
        tab: 'text',
        isMobile: window.innerWidth <= 600,
        isMac: isMacOS()
      }
    },
    computed: {
      modifierKey() {
        return this.isMac ? '⌘' : 'Ctrl'
      },
      tabs() {
        return [
          { value: 'text', label: 'Reading' },
          { value: 'dictionaries', label: 'Dictionaries filter' },
          !this.isMobile && { value: 'navigation', label: 'Navigation' }
        ].filter(Boolean)
      },
      pageShortcuts() {
        return HELP_SHORTCUTS
      }
    },
    watch: {
      tabs(tabs) {
        if (!tabs.some((tab) => tab.value === this.tab)) this.tab = 'text'
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
  <span class="split-help">

    <ui-dialog v-model="dialog" title="Reading a text" :max-width="1024">
      <div class="define-help-content" data-testid="split-help">
        <ui-tabs v-model="tab" :items="tabs">
          <template #panel-text>
            <h3 class="help-heading">Read a Tibetan text word by word</h3>
            <p>
              Paste a text into Reader, or type it (Wylie becomes Tibetan as you go), then split it.
              Each word is shown with its entry beside it.
            </p>
            <ul class="help-list" data-testid="reader-help-tips">
              <li>
                <strong>Shift+Space</strong> types a space, which marks a word break. A plain Space types a
                tsheg. Your word breaks are kept when the text is split again.
              </li>
              <li>
                <strong>Tap a word</strong> to see its entry. A line under several words marks a longer
                expression: tap the line to look the expression up.
              </li>
              <li>
                <strong>Show Wylie</strong> writes the Wylie under each word.
              </li>
              <li>
                Recent texts are offered when the editor is empty.
              </li>
            </ul>
          </template>

          <template #panel-dictionaries>
            <DictionariesMenuHelp :is-mobile="isMobile" />
          </template>

          <template #panel-navigation>
            <h3 class="help-heading">Keyboard shortcuts</h3>
            <table class="help-shortcuts">
              <tbody>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key"><ui-icon name="arrow-up" :size="14" /></kbd>
                  </td>
                  <td>Select previous word in results</td>
                </tr>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key"><ui-icon name="arrow-down" :size="14" /></kbd>
                  </td>
                  <td>Select next word in results</td>
                </tr>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key">{{ modifierKey }}</kbd>
                    <kbd class="help-key"><ui-icon name="corner-down-left" :size="14" /></kbd>
                  </td>
                  <td>Split the text into words</td>
                </tr>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key">Space</kbd>
                  </td>
                  <td>Types a tsheg in the text</td>
                </tr>
                <tr>
                  <td class="help-shortcuts__keys">
                    <kbd class="help-key"><ui-icon name="arrow-big-up" :size="14" /></kbd>
                    <kbd class="help-key">Space</kbd>
                  </td>
                  <td>Types a space, which separates two words</td>
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
        <ui-button variant="ghost" data-testid="split-help-close" @click="dialog = false">Close</ui-button>
      </template>
    </ui-dialog>
  </span>
</template>
