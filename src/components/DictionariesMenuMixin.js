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
      return this.dictionaries.filter((dictionary) => {
        return this.entries?.find(
          (entry) => entry.dictionaryId == dictionary.id
        );
      });
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
  methods: {
    resetDictionariesToDefaultAndSetNumberOfEntries() {
      this.dictionaries.forEach((dictionary) => {
        dictionary.shortLabel = this.shortLabelFor(dictionary);
        dictionary.enabled = dictionary.enabledInPreferences;
        dictionary.numberOfEntries = this.entries.filter(
          (entry) => entry.dictionaryId == dictionary.id
        ).length;
      });
    },
  },
};
