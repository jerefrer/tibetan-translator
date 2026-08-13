// Throwaway visual harness for ImportPreviewDialog.
//
// The lexicon is Tauri-only, so a browser can never reach this dialog in the
// real app. This mounts the real component with the real Vuetify theme and the
// app's global stylesheets, stubbing only the data layer.
//
// Delete once the styling pass is done.
import { createApp, h } from 'vue';
import vuetify from './plugins/vuetify';
import './css/layout.css';
import './css/tibetan.css';
import ImportPreviewDialog from './components/ImportPreviewDialog.vue';
import Lexicon from './services/lexicon';

const params = new URLSearchParams(location.search);

const GRID = {
  sheetName: 'vocabulaire-cours-3',
  headers: ['A', 'B', 'C'],
  rows: [
    ['Terme', 'Traduction', 'Notes'],
    ['སངས་རྒྱས་', 'awakened one, buddha', 'n.'],
    ['བླ་མ་', 'lama, spiritual teacher', ''],
    ['ཆོས་', 'dharma, the teaching', 'n.'],
    ['དགེ་བ་', 'virtue, wholesome action', ''],
    ['', 'orphan row', ''],
    ['ཆོས་', 'duplicate further down', ''],
  ],
};

const NO_TIBETAN = {
  sheetName: 'unclear',
  headers: ['A', 'B'],
  rows: [
    ['one', 'two'],
    ['three', 'four'],
  ],
};

Lexicon.entries = async () => ({
  total: 2,
  entries: [
    { id: 1, term: 'སངས་རྒྱས་', definition: 'buddha' },
    { id: 2, term: 'དགེ་བ་', definition: 'virtue, wholesome action' },
  ],
});
Lexicon.applyImport = async () => ({ inserted: 2, updated: 1 });

const app = createApp({
  data: () => ({ open: false }),
  mounted() {
    this.open = true;
  },
  render() {
    return h(ImportPreviewDialog, {
      modelValue: this.open,
      grid: params.has('mapping') ? NO_TIBETAN : GRID,
      packId: params.has('create') ? null : 'custom-notes',
      dictionaryId: 1,
      dictionaryName: params.has('create') ? '' : 'INALCO Français-Tibétain',
    });
  },
});
app.provide('snackbar', { open: () => {} });
app.use(vuetify);
if (params.has('dark')) vuetify.theme.global.name.value = 'dark';
app.mount('#app');
