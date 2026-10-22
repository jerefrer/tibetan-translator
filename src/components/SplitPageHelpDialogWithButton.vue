<script>
  import { UiButton, UiDialog, UiIcon, UiTabs } from '../ui'
  import DictionariesMenuHelp from './DictionariesMenuHelp.vue'
  import { isMacOS } from '../config/platform'

  // The "?" in the navigation (rail on a desktop, floating above the bar on a
  // phone) and the help it opens while Split is shown. The button and the
  // panels use the styles of DefinePageHelpDialogWithButton.vue (global).
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
        isMac: isMacOS()
      }
    },
    computed: {
      modifierKey() {
        return this.isMac ? '⌘' : 'Ctrl'
      },
      tabs() {
        return [
          { value: 'dictionaries', label: 'Dictionaries filter' },
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
  <span class="split-help">
    <button
      v-if="$route.path.includes('/segment')"
      type="button"
      class="help-button define-help-button"
      aria-label="How to use the Split page"
      title="Help"
      data-testid="split-help-button"
      @click.stop.prevent="dialog = true"
    >
      <ui-icon name="circle-help" :size="24" />
    </button>

    <ui-dialog v-model="dialog" title="How to use the Split page" :max-width="1024">
      <div class="define-help-content" data-testid="split-help">
        <ui-tabs v-model="tab" :items="tabs">
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
                  <!-- eslint-disable-next-line vue/no-v-html -- static text above -->
                  <td v-html="shortcut.html" />
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
