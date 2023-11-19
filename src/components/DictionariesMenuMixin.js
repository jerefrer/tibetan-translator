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
        .map("id");
    },
    entriesForEnabledDictionaries() {
      if (this.entries == undefined) return [];
      return this.entries.filter((entry) =>
        this.enabledDictionariesIds.includes(entry.dictionaryId)
      );
    },
  },
  methods: {
    resetDictionariesToDefaultAndSetNumberOfEntries() {
      this.dictionaries.each((dictionary) => {
        dictionary.shortLabel = this.shortLabelFor(dictionary);
        dictionary.enabled = dictionary.enabledInPreferences;
        dictionary.numberOfEntries = this.entries.count(
          (entry) => entry.dictionaryId == dictionary.id
        );
      });
    },
  },
};
