import Storage from '../services/storage.js';
import DictionariesDetailsMixin from "./DictionariesDetailsMixin";

export default {
  mixins: [DictionariesDetailsMixin],
  data() {
    return {
      dictionaries: Storage.get("dictionaries").map((dictionary) => {
        return { ...dictionary, enabledInPreferences: dictionary.enabled };
      }),
    };
  },
  computed: {
    dictionariesForCurrentResults() {
      // One pass over the entries, not one per dictionary (35 x 3,000
      // reactive reads for a long Search)
      const ids = new Set((this.entries || []).map((entry) => String(entry.dictionaryId)));
      return this.dictionaries.filter((dictionary) => ids.has(String(dictionary.id)));
    },
    enabledDictionariesIds() {
      return this.dictionariesForCurrentResults
        .filter((dictionary) => dictionary.enabled)
        .map((dictionary) => dictionary.id);
    },
    entriesForEnabledDictionaries() {
      if (this.entries == undefined) return [];
      var enabledIds = this.enabledDictionariesIds;
      var dictionaryPositions = {};
      this.dictionaries.forEach((d) => { dictionaryPositions[d.id] = d.position; });
      return this.entries
        .filter((entry) => enabledIds.includes(entry.dictionaryId))
        .sort((a, b) =>
          (dictionaryPositions[a.dictionaryId] || 0) - (dictionaryPositions[b.dictionaryId] || 0)
        );
    },
  },
  activated() {
    // Refresh dictionaries from storage when page becomes visible again
    // (e.g. after changing order/enabled state in Settings)
    this.dictionaries = Storage.get("dictionaries").map((dictionary) => {
      return { ...dictionary, enabledInPreferences: dictionary.enabled };
    });
  },
  methods: {
    resetDictionariesToDefaultAndSetNumberOfEntries() {
      const counts = {};
      this.entries.forEach((entry) => {
        counts[entry.dictionaryId] = (counts[entry.dictionaryId] || 0) + 1;
      });
      this.dictionaries.forEach((dictionary) => {
        dictionary.shortLabel = this.shortLabelFor(dictionary);
        dictionary.enabled = dictionary.enabledInPreferences;
        dictionary.numberOfEntries = counts[dictionary.id] || 0;
      });
    },
  },
};
