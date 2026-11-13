<script>
import GlobalLookup from '../../services/global-lookup';
import { isMacOS, supportsModularPacks } from '../../config/platform';
import { HELP_SHORTCUTS } from '../../config/navigation';

// One topic of the help (HelpDialog), short. Examples are buttons: `try-term`
// opens a Tibetan term in Lookup, `try-search` searches the definitions, `go`
// opens a page.
export default {
  name: 'HelpTopic',
  props: {
    id: { type: String, required: true },
    isPhone: { type: Boolean, default: false },
    // The hidden copy the search reads: no video
    indexing: { type: Boolean, default: false },
  },
  emits: ['try-term', 'try-search', 'go'],
  computed: {
    mod() {
      return isMacOS() ? '⌘' : 'Ctrl';
    },
    alt() {
      return isMacOS() ? '⌥' : 'Alt';
    },
    shift() {
      return isMacOS() ? '⇧' : 'Shift';
    },
    quickLookupKeys() {
      return GlobalLookup.formatHotkeyForDisplay(GlobalLookup.getHotkey());
    },
    appShortcuts() {
      return HELP_SHORTCUTS;
    },
    inApp() {
      return supportsModularPacks();
    },
    // The demo plays by itself unless motion is to be reduced
    playVideo() {
      return !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    },
  },
};
</script>

<template>
  <div class="help-topic" :data-topic="id">
    <template v-if="id === 'typing'">
      <p>
        Where Tibetan is expected (Lookup in <strong>བོད</strong>, the Reader), type
        Wylie: it becomes Tibetan as you type, at each space or tsheg. Under the
        field, <em>typed sangs rgyas</em> recalls the Latin you typed.
      </p>
      <table class="help-table">
        <tbody>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-term', 'སངས་རྒྱས་')">sangs rgyas</button></td><td class="help-tibetan">སངས་རྒྱས་</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-term', 'བཅོམ་ལྡན་འདས་')">bcom ldan 'das</button></td><td class="help-tibetan">བཅོམ་ལྡན་འདས་</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-term', 'རིག་པ་')">rig pa</button></td><td class="help-tibetan">རིག་པ་</td></tr>
        </tbody>
      </table>
      <ul class="help-list">
        <li>Paste Tibetan as it is. Text in older Tibetan fonts is turned into Unicode.</li>
        <li>English typed in <strong>བོད</strong> becomes Tibetan too: switch to <strong>EN</strong> to search the definitions. A hint offers it when no Tibetan term starts with what you typed.</li>
        <li>Sanskrit written in Wylie works as well: <code>buddha</code> gives its Tibetan spelling.</li>
      </ul>
    </template>

    <template v-else-if="id === 'lookup'">
      <p>
        In <strong>བོད</strong>, the terms that start with what you type are listed as
        you type, each with a short gloss, and the first one opens. Open another with
        a click, or move with <kbd class="help-key">↑</kbd> <kbd class="help-key">↓</kbd>.
      </p>
      <ul class="help-list">
        <li><strong>In short</strong> gathers the translations several dictionaries agree on.</li>
        <li>The definitions follow, dictionary by dictionary, in your order. <strong>All dictionaries</strong> above them is a filter: type a few letters of a dictionary's name to see only its definitions.</li>
        <li>A link in a definition opens that term. A dotted word is an abbreviation: point at it to read it in full.</li>
        <li><strong>Copy</strong> copies the definitions shown, <strong>Save</strong> keeps the term in Saved<template v-if="inApp">, and the last button adds your own definition to My glossary</template>.</li>
        <li>A scanned dictionary shows <strong>View scan</strong>, the page it comes from; a speaker plays a recording where there is one.</li>
      </ul>
    </template>

    <template v-else-if="id === 'search'">
      <p>
        Switch the Lookup field to <strong>EN</strong> to search the text of the
        definitions. The results are the terms whose definitions match, the hits
        highlighted. A few marks refine the search:
      </p>
      <table class="help-table">
        <tbody>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', 'wisdom')">wisdom</button></td><td>Contains the word, whatever its case</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', 'seven limbs')">seven limbs</button></td><td>Contains these words, one after the other</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', 'seven & limbs')">seven &amp; limbs</button></td><td>Contains both, anywhere, in any order</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', &quot;(dga' ba)&quot;)">(dga' ba)</button></td><td>Wylie in parentheses is read as Tibetan: <span class="help-tibetan">དགའ་བ་</span></td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', '[trenpa]')">[trenpa]</button></td><td>A Tibetan word pronounced exactly like this, however it is spelled</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', '{jom ten te}')">{jom ten te}</button></td><td>A Tibetan word that sounds more or less like this</td></tr>
          <tr><td><button type="button" class="help-try" data-testid="help-try" @click="$emit('try-search', 'enlightenment & [trenpa]')">enlightenment &amp; [trenpa]</button></td><td>Any of these can be combined</td></tr>
        </tbody>
      </table>
      <ul class="help-list">
        <li>Searching by sound, split the syllables if nothing comes up: <code>[chom den de]</code>. Syllables that run together need their consonant twice, or a space: <code>[sanggye]</code> or <code>[sang gye]</code>, not <code>[sangye]</code>.</li>
        <li><strong>Advanced</strong>, under the field, writes these queries for you: one row per condition, and an entry must match them all.</li>
        <li>When what you typed reads as a Tibetan term, switch back to <strong>བོད</strong> to look it up.</li>
      </ul>
    </template>

    <template v-else-if="id === 'reader'">
      <p>
        Paste a Tibetan text, or type it (Wylie becomes Tibetan), then split it into
        words with <strong>Split</strong><template v-if="!isPhone"> or <kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">Enter</kbd></template>.
        Each word becomes a button: {{ isPhone ? 'tap' : 'click' }} one to see its entry
        {{ isPhone ? 'in a sheet' : 'beside the text' }}.
      </p>
      <ul class="help-list">
        <li>A bar under several words marks a longer expression: {{ isPhone ? 'tap' : 'click' }} it to look the expression up.<template v-if="!isPhone"> Pointing at it shows which words it covers.</template></li>
        <li>While typing, <kbd class="help-key">Space</kbd> types a tsheg and <kbd class="help-key">{{ shift }}</kbd> <kbd class="help-key">Space</kbd> a space, which marks a word break. <strong>Edit</strong> brings the text back with its breaks.</li>
        <li><strong>{{ isPhone ? 'Wylie' : 'Show Wylie' }}</strong> writes the Wylie under each word.</li>
        <li v-if="!isPhone">Drag the line between the text and the entry to make the entry wider; a double-click puts it back.</li>
        <li>Your recent texts are offered when the editor is empty.</li>
      </ul>
    </template>

    <template v-else-if="id === 'dictionaries'">
      <p>
        <strong>Dictionaries</strong> lists every dictionary in the order Lookup and the
        Reader show them. Switch one off to leave it out.
      </p>
      <ul class="help-list">
        <li>To change the order, drag a dictionary by its handle<template v-if="!isPhone">, press <kbd class="help-key">{{ alt }}</kbd> <kbd class="help-key">↑</kbd> or <kbd class="help-key">↓</kbd> on the one selected,</template> or use <strong>Move to top</strong> and <strong>Move to bottom</strong>.<template v-if="isPhone"> On a phone, <strong>Reorder</strong> shows the handles.</template></li>
        <li v-if="!isPhone"><kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">Z</kbd> takes back a move or a switch, <kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">{{ shift }}</kbd> <kbd class="help-key">Z</kbd> does it again.</li>
        <li>Select a dictionary to read where it comes from, its languages and subjects.</li>
        <li v-if="inApp">The packs at the top add dictionaries to this device, and update or remove them. Dictionaries of a pack you have not installed are listed under <em>Not on this device</em>.</li>
      </ul>
    </template>

    <template v-else-if="id === 'glossary'">
      <p>
        <strong>My glossary</strong> holds your own definitions. They are looked up with
        every dictionary and shown under the glossary's name.
      </p>
      <ul class="help-list">
        <li>The glossary's name is a menu: switch to another glossary, create one (empty, or from a spreadsheet), add a <code>.tibdict</code> file someone shared, or remove one.</li>
        <li><strong>Import</strong> adds the rows of a spreadsheet (Excel, OpenDocument, CSV): the Tibetan in one column, its definition in another. You check what will change before anything is written.</li>
        <li><strong>Export</strong> writes a <code>.tibdict</code> file to share or keep, or a spreadsheet to edit and import back.</li>
        <li v-if="inApp">From any entry, the last button beside Save adds your definition of that term.</li>
        <li v-if="!inApp">Glossaries live in the desktop and mobile apps.</li>
      </ul>
    </template>

    <template v-else-if="id === 'saved'">
      <ul class="help-list">
        <li><strong>Save</strong>, in an entry, keeps the term. {{ isPhone ? "Lookup's home" : 'The sidebar' }} shows the newest; <button type="button" class="help-link" @click="$emit('go', '/saved')">Saved</button> shows them all, to search, sort, copy as a list (for a spreadsheet) or clear.</li>
        <li><strong>Recent</strong> lists the terms you looked up last.<template v-if="!isPhone"> The × beside a term forgets it, Clear forgets them all, and each section folds.</template></li>
      </ul>
    </template>

    <template v-else-if="id === 'quick'">
      <video v-if="!indexing" class="help-video" src="/img/global-lookup-demo.mp4" :autoplay="playVideo" loop muted playsinline :controls="!playVideo" aria-hidden="true" />
      <p>
        Copy Tibetan text in any app, then press <kbd class="help-key">{{ quickLookupKeys }}</kbd>:
        a small window shows its entry. In this app, select the text instead of copying it.
      </p>
      <p>
        The shortcut can be changed, or turned off, in
        <button type="button" class="help-link" @click="$emit('go', '/settings#settings-quick-lookup')">Settings</button>.
        On a Mac it needs the Accessibility permission, which Settings asks for.
      </p>
    </template>

    <template v-else-if="id === 'shortcuts'">
      <table class="help-table help-shortcuts">
        <tbody>
          <tr v-for="shortcut in appShortcuts" :key="shortcut.key"><td><kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">{{ shortcut.key }}</kbd></td><td>{{ shortcut.text }}</td></tr>
          <tr><td><kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">/</kbd> or <kbd class="help-key">F1</kbd></td><td>Open or close this help</td></tr>
        </tbody>
      </table>
      <h4 class="help-subheading">Lookup</h4>
      <table class="help-table help-shortcuts">
        <tbody>
          <tr><td><kbd class="help-key">↑</kbd> <kbd class="help-key">↓</kbd></td><td>Move through the results</td></tr>
          <tr><td><kbd class="help-key">Enter</kbd></td><td>In EN: search, or open the result moved to</td></tr>
          <tr><td><kbd class="help-key">Esc</kbd></td><td>Clear the field</td></tr>
        </tbody>
      </table>
      <h4 class="help-subheading">Reader</h4>
      <table class="help-table help-shortcuts">
        <tbody>
          <tr><td><kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">Enter</kbd></td><td>Split the text into words</td></tr>
          <tr><td><kbd class="help-key">{{ shift }}</kbd> <kbd class="help-key">Space</kbd></td><td>A space, to break words (Space alone types a tsheg)</td></tr>
          <tr><td><kbd class="help-key">↑</kbd> <kbd class="help-key">↓</kbd></td><td>Move between the words</td></tr>
        </tbody>
      </table>
      <h4 class="help-subheading">Dictionaries</h4>
      <table class="help-table help-shortcuts">
        <tbody>
          <tr><td><kbd class="help-key">↑</kbd> <kbd class="help-key">↓</kbd></td><td>Select a dictionary</td></tr>
          <tr><td><kbd class="help-key">{{ alt }}</kbd> <kbd class="help-key">↑</kbd> <kbd class="help-key">↓</kbd></td><td>Move the selected dictionary</td></tr>
          <tr><td><kbd class="help-key">{{ mod }}</kbd> <kbd class="help-key">Z</kbd></td><td>Undo a move or a switch</td></tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.help-list {
  margin: 0;
  padding-left: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.help-subheading {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.help-table {
  width: 100%;
  margin: 0 0 var(--space-3);
  border-collapse: collapse;
}
.help-table td {
  padding: 6px var(--space-2) 6px 0;
  border-top: 1px solid var(--line-soft);
  vertical-align: baseline;
}
.help-table td:first-child {
  width: 40%;
}
.help-shortcuts td:first-child {
  width: 1%;
  padding-right: var(--space-4);
  white-space: nowrap;
}
.help-try {
  max-width: 100%;
  padding: 2px 8px;
  text-align: left;
  overflow-wrap: anywhere;
  border: 1px solid var(--accent-line);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  font: 500 var(--text-sm) ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--accent);
  cursor: pointer;
}
.help-try:hover {
  background: var(--accent-line);
}
.help-link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
.help-tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.25em;
  color: var(--rubric);
}
.help-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 5px;
  box-sizing: border-box;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  background: var(--surface);
  font: 600 var(--text-xs) var(--font-ui);
  color: var(--ink);
}
.help-topic code {
  padding: 0.1em 0.35em;
  border-radius: var(--radius-xs);
  background: var(--soft);
  font-size: 0.92em;
}
.help-video {
  display: block;
  width: 100%;
  margin-bottom: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
}
</style>
