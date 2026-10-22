<script>
  import { UiAlert, UiButton, UiDialog, UiIcon, UiTabs } from '../ui'
  import DictionariesMenuHelp from './DictionariesMenuHelp.vue'
  import { isMacOS } from '../config/platform'

  // The "?" in the navigation while Search is shown, and the help it opens.
  // The button and the panels take their look from the Define help
  // (.define-help-button, .define-help-content in
  // DefinePageHelpDialogWithButton.vue), so the two read as one.
  export default {
    components: {
      DictionariesMenuHelp,
      UiAlert,
      UiButton,
      UiDialog,
      UiIcon,
      UiTabs
    },
    data () {
      return {
        dialog: false,
        tab: 'builder',
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
          { value: 'builder', label: 'Query Builder' },
          { value: 'syntax', label: 'Syntax Examples' },
          { value: 'phonetics', label: 'Phonetic search' },
          { value: 'wylie', label: 'Wylie support' },
          { value: 'dictionaries', label: 'Dictionaries filter' },
          !this.isMobile && { value: 'navigation', label: 'Navigation' }
        ].filter(Boolean)
      },
      builderModes() {
        return [
          { label: 'contains', text: 'Regular text search', syntax: 'term' },
          { label: 'contains (Wylie)', text: 'Type in Wylie romanization', syntax: '(term)' },
          { label: 'sounds precisely like', text: 'Strict phonetic match', syntax: '[term]' },
          { label: 'sounds more or less like', text: 'Fuzzy phonetic match', syntax: '{term}' }
        ]
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
        if (!tabs.some((tab) => tab.value === this.tab)) this.tab = 'builder'
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
  <span class="search-help">
    <button
      v-if="$route.path.includes('/search')"
      type="button"
      class="help-button define-help-button"
      aria-label="How to use the Search page"
      title="Help"
      data-testid="search-help-button"
      @click.stop.prevent="dialog = true"
    >
      <ui-icon name="circle-help" :size="24" />
    </button>

    <ui-dialog v-model="dialog" title="How to use the search page" :max-width="1024">
      <div class="define-help-content search-help-content" data-testid="search-help">
        <ui-tabs v-model="tab" :items="tabs">
          <template #panel-builder>
            <h3 class="help-heading">Visual Query Builder</h3>
            <p>
              The Query Builder provides a visual way to build search queries
              without memorizing syntax.
            </p>

            <h4 class="help-subheading">How it works</h4>
            <p>
              Each row in the builder represents a search condition. Use the
              dropdown to select how to search:
            </p>

            <table class="help-table" data-testid="search-help-modes">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>What it does</th>
                  <th>Equivalent syntax</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="mode in builderModes" :key="mode.label">
                  <td><code>{{ mode.label }}</code></td>
                  <td>{{ mode.text }}</td>
                  <td><code>{{ mode.syntax }}</code></td>
                </tr>
              </tbody>
            </table>

            <p>
              Click <strong>+ Add condition</strong> to combine multiple search
              terms (they are combined with AND logic).
            </p>

            <ui-alert type="info">
              The builder syncs with the text box above — you can use either
              interface! Changes in one are reflected in the other.
            </ui-alert>

            <p class="help-note">
              Prefer typing? Hide the builder using the "Hide" button.
              Your preference is remembered.
            </p>
          </template>

          <template #panel-syntax>
            <table class="help-table help-table--examples" data-testid="search-help-syntax">
              <tbody>
                <tr>
                  <td><code>seven</code></td>
                  <td>
                    Matches everything that contains "seven" regardless
                    of case.
                    <span class="help-aside">("SeVeN" will be matched as well)</span>
                  </td>
                </tr>
                <tr>
                  <td><code>seven limbs of enlightenment</code></td>
                  <td>
                    Matches everything that contains the exact expression
                    "seven limbs of enlightenment".
                  </td>
                </tr>
                <tr>
                  <td><code>seven &amp; limbs &amp; enlightenment</code></td>
                  <td>
                    Matches everything that contains "seven" <b>and</b>
                    "limbs" <b>and</b> "enlightenment" but not necessarily
                    following one another nor in that particular order.
                  </td>
                </tr>
                <tr>
                  <td><code>enlightenment &amp; <span class="tibetan">དགའ་བ་</span></code></td>
                  <td>
                    Matches everything that contains "enlightenment" and
                    <span class="tibetan">དགའ་བ་</span> in any order.
                  </td>
                </tr>
                <tr>
                  <td><code>enlightenment &amp; [trenpa]</code></td>
                  <td>
                    Matches everything that contains "enlightenment" as well
                    as any Tibetan word that <b>sounds like</b> "trenpa".
                    <span class="help-aside">
                      (See <button type="button" class="help-link" @click="tab = 'phonetics'">Phonetic search</button>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><code>{trenpa}</code></td>
                  <td>
                    Matches everything that contains any Tibetan word that
                    <b>sounds more or less like</b> "trenpa".
                    <span class="help-aside">
                      (See <button type="button" class="help-link" @click="tab = 'phonetics'">Phonetic search</button>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><code>[<span class="tibetan">དྲན་པ་</span>]</code></td>
                  <td>
                    Matches everything that contains any Tibetan word that is
                    <b>pronounced like</b> <span class="tibetan">དྲན་པ་</span>
                    but not necessarily spelled the same way.
                    <span class="help-aside">
                      (See <button type="button" class="help-link" @click="tab = 'phonetics'">Phonetic search</button>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><code>{<span class="tibetan">དྲན་པ་</span>}</code></td>
                  <td>
                    Matches everything that contains any Tibetan word that
                    <b>sounds more or less like</b> <span class="tibetan">དྲན་པ་</span>
                    <span class="help-aside">
                      (See <button type="button" class="help-link" @click="tab = 'phonetics'">Phonetic search</button>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><code>(dga' ba)</code></td>
                  <td>
                    Matches everything that contains <span class="tibetan">དགའ་བ་</span>
                    <span class="help-aside">
                      (See <button type="button" class="help-link" data-testid="search-help-to-wylie" @click="tab = 'wylie'">Wylie support</button>)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>

          <template #panel-phonetics>
            <p>
              This enables you to find something <em>by the way it
              is pronounced</em>.
            </p>
            <p>
              Say, for example, that you heard a Tibetan teacher pronounce
              <i>"chomdende"</i> and, although you know it has something to do
              with Buddha, you have no idea how to spell this in Tibetan.
              You might then just type <code>[chomdende]</code>, and it will
              return all the words that sound like <i>"chomdende"</i>, whatever
              their spelling is.
            </p>

            <ui-alert type="warning">
              The app will automatically split the different syllables, and
              actually will search for <code>chom den de</code>.
              Nevertheless there might be cases where this automatic split
              might fail, so if you can't find what you're looking for, you might
              want to try to split the syllables yourself, in this case by inputting
              <code>[chom den de]</code>.
            </ui-alert>

            <ui-alert type="warning">
              Beware of words with "merged" syllables.
              For instance <code>[sangye]</code> won't yield any result because
              it is actually <code>san<b>g</b></code> and <code><b>g</b>ye</code>
              put together.
              Search instead for <code>[sang gye]</code> or <code>[sanggye]</code>.
              Therefore if you can't find something try to double the
              consonants between two syllables.
            </ui-alert>

            <p>
              Now let's say you were quite far away from the teacher and could
              only hear him say something like <i>"jom ten té"</i>.
              That's all right, you can also search words that sound <em>more or
              less like that</em>. For this you will use the curly brackets:
              <code>{jom ten té}</code>.
            </p>

            <ui-alert type="info">
              [] Square brackets yield a square result.<br />
              {} Curly brackets are more open-minded...
            </ui-alert>

            <p>
              This works with Tibetan too!
              <code>[<span class="tibetan">ཆོམ་སྡེན་སྡེ་</span>]</code> will find
              <span class="tibetan">བཅོམ་ལྡན་འདས་</span> and so does
              <code>{<span class="tibetan">ཇོམ་ཏེན་དེ་</span>}</code>.
            </p>

            <p>
              You can even mix them up:
              <code>[chom<span class="tibetan">སྡེན་</span>de]</code> will also find
              <span class="tibetan">བཅོམ་ལྡན་འདས་</span>.
            </p>
          </template>

          <template #panel-wylie>
            <p>Everything between parenthesis will be understood as Wylie.</p>
            <p>For instance all queries below are interchangeable:</p>
            <div class="help-terms" data-testid="search-help-wylie">
              <code>(sangs rgyas kyi chos)</code>
              <code>(sangs rgyas)(kyi)(chos)</code>
              <code>(sangs rgyas)<span class="tibetan">ཀྱི་</span>(chos)</code>
              <code>(sangs rgyas)<span class="tibetan">ཀྱི་ཆོས་</span></code>
              <code><span class="tibetan">སངས་རྒྱས་ཀྱི་ཆོས་</span></code>
            </div>
          </template>

          <template #panel-dictionaries>
            <DictionariesMenuHelp :is-mobile="isMobile" />
          </template>

          <template #panel-navigation>
            <h3 class="help-heading">Keyboard shortcuts</h3>
            <table class="help-shortcuts">
              <tbody>
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
        <ui-button variant="ghost" data-testid="search-help-close" @click="dialog = false">Close</ui-button>
      </template>
    </ui-dialog>
  </span>
</template>

<style>
/* Only what the Define help does not already draw */
.search-help-content .help-subheading {
  margin: 1.25em 0 6px;
  font-size: var(--text-base);
  font-weight: 600;
}
.search-help-content code {
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background: var(--soft);
  color: var(--ink);
  font-size: 0.92em;
  white-space: nowrap;
}
.search-help-content code .tibetan,
.search-help-content .tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.2em;
}
.search-help-content .help-table {
  width: 100%;
  margin: 0 0 1em;
  border-collapse: collapse;
}
.search-help-content .help-table th {
  padding: 6px 12px 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--text-xs);
  font-weight: 600;
  text-align: left;
  color: var(--muted);
}
.search-help-content .help-table td {
  padding: 8px 12px 8px 0;
  border-bottom: 1px solid var(--soft);
  vertical-align: top;
}
.search-help-content .help-table--examples td:first-child {
  width: 1%;
  white-space: nowrap;
}
.search-help-content .help-aside {
  font-size: var(--text-xs);
  color: var(--muted);
  white-space: nowrap;
}
.search-help-content .help-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.search-help-content .ui-alert {
  margin: 0 0 1em;
}
.search-help-content .help-terms {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
@media (max-width: 600px) {
  .search-help-content .help-table--examples td:first-child,
  .search-help-content code {
    white-space: normal;
  }
}
</style>
