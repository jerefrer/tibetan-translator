import Storage from '../../services/storage';
import { clearGlossCache } from '../../services/glosses';

// The dictionaries as they bear on results: which are on, in which order
function dictionariesSignature() {
  return (Storage.get('dictionaries') || [])
    .filter((dictionary) => dictionary.enabled)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((dictionary) => dictionary.id)
    .join(',');
}

// Lookup's and Search's results, kept up to date with the dictionaries: when
// they were switched on or off or reordered, or packs installed or removed,
// while the page was away, `refreshKey` is bumped as it shows again, and the
// results read it to search again. `allTermsVersion` is bumped as soon as
// SqlDatabase.allTerms changes (it is not reactive).
export default {
  data() {
    return {
      allTermsVersion: 0,
      refreshKey: 0,
    };
  },
  created() {
    this.shownDictionaries = dictionariesSignature();
    this.packsChanged = false;
  },
  mounted() {
    this._onAllTermsUpdated = () => {
      this.allTermsVersion++;
      this.packsChanged = true;
    };
    this._onDictionariesUpdated = () => {
      this.packsChanged = true;
    };
    window.addEventListener('all-terms-updated', this._onAllTermsUpdated);
    window.addEventListener('dictionaries-updated', this._onDictionariesUpdated);
  },
  activated() {
    this.refreshIfStale();
  },
  beforeUnmount() {
    window.removeEventListener('all-terms-updated', this._onAllTermsUpdated);
    window.removeEventListener('dictionaries-updated', this._onDictionariesUpdated);
  },
  methods: {
    refreshIfStale() {
      const signature = dictionariesSignature();
      if (signature === this.shownDictionaries && !this.packsChanged) return;
      this.shownDictionaries = signature;
      this.packsChanged = false;
      clearGlossCache();
      this.refreshKey++;
    },
  },
};
