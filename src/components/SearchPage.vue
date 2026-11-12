<script>
import _ from 'underscore';

import TibetanRegExps from 'tibetan-regexps';

import {
  MAX_ENTRIES_PER_REQUEST,
  SEARCH_GROUPS_BATCH_SIZE,
  SEARCH_OPEN_DEFINITIONS_LIMIT,
  MAX_PREVIOUS_QUERIES,
  INFINITE_SCROLL_ROOT_MARGIN_LARGE,
} from '../config/constants';
import Decorator from '../services/decorator';
import PhoneticSearch from '../services/phonetic-search';
import SqlDatabase from '../services/sql-database';
import Storage from '../services/storage';
import { mayNeedLegacyRepair } from '../services/legacy-to-unicode';
import { supportsModularPacks } from '../config/platform';
import {
  convertWylieInParentheses,
  phoneticsLooseFor,
  phoneticsStrictFor,
  replaceTibetanGroups,
  syllablesFor,
} from '../utils.js';
import { UiButton, UiIcon, UiSpinner, UiTextField, UiTooltip } from '../ui';
import DictionariesMenuMixin from './DictionariesMenuMixin';
import InfiniteScrollMixin from './mixins/InfiniteScrollMixin';
import MobileResponsiveMixin from './mixins/MobileResponsiveMixin';

import DictionaryAboutDialog from './DictionaryAboutDialog.vue';
import QuickAddDialog from './QuickAddDialog.vue';
import UninstalledPacksNotice from './UninstalledPacksNotice.vue';
import ResultsAndPaginationAndDictionaries from './ResultsAndPaginationAndDictionaries.vue';
import TermEntries from './TermEntries.vue';
import SearchBuilder from './SearchBuilder.vue';
import { getScanInfo } from '../services/scan-service';

// tibetanGroups carries the g flag, so its test() resumes where the previous
// call stopped and answers false every other time on the same text. A copy
// without it gives the same answer each time.
const TIBETAN = new RegExp(TibetanRegExps.tibetanGroups.source, 'iu');

// Board "B · Search" (and its Empty, query builder, Dictionaries and Phone
// variants): the query field on top, the query builder under it when shown,
// then the results in one card, or the recent searches before any search.
function initialBuilderVisible() {
  const stored = Storage.get('searchBuilderVisible');
  if (stored === true || stored === false) return stored;
  return window.innerWidth > 600;
}

export default {
  mixins: [DictionariesMenuMixin, InfiniteScrollMixin, MobileResponsiveMixin],
  components: {
    DictionaryAboutDialog,
    QuickAddDialog,
    UninstalledPacksNotice,
    ResultsAndPaginationAndDictionaries,
    SearchBuilder,
    TermEntries,
    UiButton,
    UiIcon,
    UiSpinner,
    UiTextField,
    UiTooltip,
  },
  data() {
    return {
      loading: false,
      entries: undefined,
      // Counted in terms (groups of definitions), not in definitions
      displayedCount: SEARCH_GROUPS_BATCH_SIZE,
      batchSize: SEARCH_GROUPS_BATCH_SIZE,
      // The rows opened, until the next search. All start collapsed: an open
      // first row with long definitions hid the other terms
      openTerms: {},
      // The terms with more definitions than an open row shows, unfolded
      // with "Show N more", until the next search
      expandedTerms: {},
      searchQuery: this.$route.params.query,
      previousQueries: Storage.get('previousQueries', []),
      // Cached highlight terms - only updated on search, not on input change
      cachedRegularTerms: [],
      cachedPhoneticsStrictTerms: [],
      cachedPhoneticsLooseTerms: [],
      // Search builder state
      // Open by default, except on a phone (a third of the screen) until the
      // user has chosen; an explicit choice is remembered
      builderVisible: initialBuilderVisible(),
      quickAddOpen: false,
      // The query whose route this page pushed itself (see the route watcher)
      pushedQuery: null,
      aboutDictionary: '',
      aboutOpen: false,
    };
  },
  watch: {
    '$route.params.query'(value) {
      // Only update searchQuery if we're still on the search route
      // (prevents clearing when navigating to other pages like /define)
      if (!this.$route.path.startsWith('/search')) return;

      this.searchQuery = value;
      Storage.set('searchQuery', value);
      // A search from the page pushes its own route: it has run already
      const pushedQuery = this.pushedQuery;
      this.pushedQuery = null;
      if (value && value === pushedQuery) return;
      // Back from another page to the query already shown: its results, and
      // their scroll, stay as they were unless they are out of date
      if (value && value === this.shownQuery && !this.shownResultsAreStale()) return;
      if (value) this.performSearch({ query: value, fromNavigation: true });
    },
    previousQueries(value) {
      Storage.set('previousQueries', value);
    },
    builderVisible(value) {
      // The help promises the choice is remembered
      Storage.set('searchBuilderVisible', value);
      // Hide and "Query builder" each disappear when pressed: carry the
      // focus over to the other one's side instead of losing it
      this.$nextTick(() => {
        const active = document.activeElement;
        const lost = !active || active === document.body;
        if (value) {
          if (lost) this.$refs.builder?.focusFirstRow();
        } else if (lost || active.closest?.('[data-testid="search-builder"]')) {
          this.$refs.builderToggle?.focus();
        }
      });
    },
    displayedCount() {
      // A new observer reports at once if the sentinel is still in view
      this.setupInfiniteScroll();
    },
    isMobile() {
      // The scrolling element changes with the layout
      this.setupInfiniteScroll();
    },
  },
  beforeRouteEnter(to, from, next) {
    var query = Storage.get('searchQuery');
    if (!to.params.query && query) next('/search/' + query);
    else next();
  },
  beforeRouteUpdate(to, from, next) {
    // When navigating back to search page without a query param (e.g., via tabs),
    // restore the stored query if available
    if (to.path.startsWith('/search') && !to.params.query) {
      var query = Storage.get('searchQuery');
      if (query) {
        next('/search/' + encodeURIComponent(query));
        return;
      }
    }
    next();
  },
  computed: {
    canAddToLexicon() {
      return supportsModularPacks();
    },
    /** The current query, or '' when it isn't a single plain Tibetan term
     *  (multi-term '&' queries and phonetic [..]/{..} syntax stay editable
     *  in the dialog's own field instead of being pre-filled here). */
    quickAddTerm() {
      const trimmed = (this.searchQuery || '').trim();
      if (!trimmed || trimmed.includes('&') || /[[\]{}]/.test(trimmed)) return '';
      return this.containsTibetan(trimmed) ? trimmed : '';
    },
    // InfiniteScrollMixin configuration
    infiniteScrollRootMargin() {
      return INFINITE_SCROLL_ROOT_MARGIN_LARGE;
    },
    // The results card scrolls on a desktop, the whole page on a phone
    infiniteScrollRoot() {
      return this.isMobile ? 'page' : 'resultsList';
    },
    canSearch() {
      return !!this.searchQuery?.trim();
    },
    // Entries in any dictionary, on or off: the header and its Dictionaries
    // button stay while every dictionary is turned off, or the menu would
    // close under the user the moment they press None
    hasEntries() {
      return !!this.entries?.length;
    },
    hasMore() {
      return this.displayedCount < this.groups.length;
    },
    // The entries grouped by Tibetan term. The groups come most relevant
    // first; inside a group the entries follow the user's dictionary order.
    groups() {
      // Use cached terms to avoid re-sorting on input change (only on search)
      const searchTermLower = this.cachedRegularTerms[0]?.toLowerCase() || '';

      // Read the user's customised dictionary order from localStorage (the same
      // order that drives DefinePage and the settings drag-drop). The SQL row's
      // `dictionaryPosition` is the build-time order, which doesn't reflect
      // user preferences.
      const userDictPositions = {};
      for (const d of this.dictionaries) userDictPositions[d.id] = d.position;

      const pad = (x) => x.toString().padStart(10, '0');
      const byTerm = new Map();
      for (const entry of this.entriesForEnabledDictionaries) {
        if (!byTerm.has(entry.term)) byTerm.set(entry.term, []);
        byTerm.get(entry.term).push(entry);
      }

      const groups = [];
      for (const [term, entries] of byTerm) {
        // Dictionary position first, so reordering dictionaries in Settings
        // reorders the definitions; then BM25 rank (negative, closer to 0 =
        // better; offset to stay positive for string comparison)
        const sorted = _.sortBy(entries, (entry) =>
          [userDictPositions[entry.dictionaryId] || 999, (entry.rank || 0) + 1000].map(pad)
        );
        groups.push({
          term,
          entries: sorted,
          bestRank: Math.min(...entries.map((entry) => entry.rank || 0)),
        });
      }

      // Looking up a Tibetan word (typed in Tibetan, or by its sound) wants
      // the terms that ARE that word first, then terms that contain it, and
      // only then terms found through their definitions; within each, shorter
      // terms before BM25 rank, which otherwise favours terms with many
      // definitions. Searching English words in the definitions is ranked by
      // BM25 first.
      const tibetanQueries = this.cachedRegularTerms.filter((term) => this.containsTibetan(term));
      const { strict, loose } = this.termPhoneticVariants;
      const lookingUpTibetan = tibetanQueries.length > 0 || strict.length > 0 || loose.length > 0;

      // 0: the term starts with the query, 1: contains it, 2: neither
      const termMatch = (group) => {
        const [entry] = group.entries;
        const candidates = [
          ...tibetanQueries.map((query) => [group.term, query]),
          ...strict.map((variant) => [entry.termPhoneticsStrict || '', variant]),
          ...loose.map((variant) => [entry.termPhoneticsLoose || '', variant]),
        ];
        if (candidates.some(([text, query]) => text.startsWith(query))) return 0;
        if (candidates.some(([text, query]) => text.includes(query))) return 1;
        return 2;
      };

      return _.sortBy(groups, (group) => {
        const startsWithBonus = group.term.toLowerCase().startsWith(searchTermLower) ? 0 : 1;
        const rank = group.bestRank + 1000;
        const length = group.term.length;
        return (lookingUpTibetan ? [termMatch(group), length, rank] : [startsWithBonus, rank, length]).map(pad);
      });
    },
    // The phonetic queries of the last search, prepared the way performSearch
    // matches them against termPhoneticsStrict / termPhoneticsLoose
    termPhoneticVariants() {
      const prepare = (terms, prepareTerm) =>
        terms.flatMap((raw) =>
          (raw.includes(' ') ? [raw] : PhoneticSearch.processSpacelessPhoneticSearch(raw)).map((variant) =>
            prepareTerm.call(PhoneticSearch, variant)
          )
        ).filter(Boolean);
      return {
        strict: prepare(this.cachedPhoneticsStrictTerms, PhoneticSearch.prepareTermForStrictMatching),
        loose: prepare(this.cachedPhoneticsLooseTerms, PhoneticSearch.prepareTermForLooseMatching),
      };
    },
    visibleGroups() {
      // Decorate here, not in the template: a computed only re-runs when its
      // dependencies change, whereas template method calls re-ran on every
      // keystroke (searchQuery is a render dependency). This depends on the
      // cached terms (frozen at search time), never on searchQuery.
      //
      // Only the groups shown, and in them the definitions shown, are
      // decorated, each once per search: loading the next batch only
      // decorates the new ones.
      const terms = [this.cachedRegularTerms, this.cachedPhoneticsStrictTerms, this.cachedPhoneticsLooseTerms];
      if (!this._decorated || terms.some((list, i) => list !== this._decoratedFor[i])) {
        this._decorated = new WeakMap();
        this._decoratedTerms = new Map();
        this._decoratedFor = terms;
      }
      const limit = SEARCH_OPEN_DEFINITIONS_LIMIT;
      return this.groups.slice(0, this.displayedCount).map((group) => {
        const open = !!this.openTerms[group.term];
        let decoratedTerm = this._decoratedTerms.get(group.term);
        if (decoratedTerm === undefined) {
          decoratedTerm = this.highlightSearchTerms(group.term);
          this._decoratedTerms.set(group.term, decoratedTerm);
        }
        // Only a term with definitions held back can unfold
        const expanded = !!this.expandedTerms[group.term] && group.entries.length > limit;
        // A collapsed row only needs its first definition, for the preview;
        // an open one the definitions shown
        return {
          term: group.term,
          decoratedTerm,
          open,
          preview: open ? null : this.decoratedEntry(group.entries[0]),
          entries: open ? group.entries.slice(0, expanded ? undefined : limit).map((entry) => this.decoratedEntry(entry)) : [],
          totalEntries: group.entries.length,
          expanded,
        };
      });
    },
    totalNumberOfEntriesForEnabledDictionaries() {
      return this.entriesForEnabledDictionaries?.length || 0;
    },
    searchTerms() {
      if (!this.searchQuery) return [];
      else
        return _.compact(
          this.substituteWylieTerms(this.searchQuery)
            .split('&')
            .map((t) => t.trim())
        );
    },
    regularSearchTerms() {
      return this.searchTerms.filter((term) => !term.match(/^[\[\{].*[\]\}]$/));
    },
    phoneticsStrictSearchTerms() {
      // Return raw terms - spaceless processing happens in performSearch
      return this.phoneticsTerms(/^\[.*\]$/, phoneticsStrictFor);
    },
    phoneticsLooseSearchTerms() {
      // Return raw terms - spaceless processing happens in performSearch
      return this.phoneticsTerms(/^\{.*\}$/, phoneticsLooseFor);
    },
  },
  methods: {
    decoratedEntry(entry) {
      let decorated = this._decorated.get(entry);
      if (!decorated) {
        // Scanned dictionaries keep their page number as the definition
        const decoratedDefinition = this.isScannedDictionary(entry)
          ? ''
          : this.highlightSearchTerms(Decorator.decorate(entry));
        decorated = {
          ...entry,
          decoratedDefinition,
          definition: this.isScannedDictionary(entry) ? entry.definition : decoratedDefinition,
        };
        this._decorated.set(entry, decorated);
      }
      return decorated;
    },
    openTerm(term) {
      this.$router.push('/define/' + encodeURIComponent(term));
    },
    toggleOpen(term) {
      this.openTerms = { ...this.openTerms, [term]: !this.openTerms[term] };
    },
    toggleTerm(term) {
      this.expandedTerms = { ...this.expandedTerms, [term]: !this.expandedTerms[term] };
    },
    containsTibetan(text) {
      // Check if text contains any Tibetan Unicode characters
      return TIBETAN.test(text);
    },
    substituteWylieTerms(text) {
      return convertWylieInParentheses(text);
    },
    phoneticsTerms(regexp, convert) {
      return _.chain(this.searchTerms.map((term) => term.match(regexp)))
        .compact()
        .flatten()
        .value()
        .map((term) => term.slice(1, -1))
        .map((term) =>
          replaceTibetanGroups(term, (tibetan) => convert(tibetan) + ' ')
        );
    },
    wrapAllTibetanWithSpansAndAddTshekIfMissing(definition) {
      return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(definition);
    },
    highlightSearchTerms(definition) {
      // Split by HTML tags - the regex captures tags so they're included in the result
      const parts = definition.split(/(<[^>]+>)/);

      return parts
        .map((part) => {
          // Skip HTML tags - only process text nodes
          if (part.startsWith('<') && part.endsWith('>')) {
            return part;
          }
          // Apply highlighting to text nodes only
          // Use cached terms (frozen at search time) to avoid re-rendering on input change
          let highlighted = part;
          this.cachedRegularTerms.forEach((term) => {
            var escapedTerm = this.escapeForRegExp(term);
            var regexp = new RegExp('(' + escapedTerm + ')', 'ig');
            highlighted = highlighted.replace(regexp, '<em>$1</em>');
          });
          this.cachedPhoneticsStrictTerms.forEach((term) => {
            highlighted = this.highlightTibetanMatchingPhonetics(
              highlighted,
              term,
              phoneticsStrictFor
            );
          });
          this.cachedPhoneticsLooseTerms.forEach((term) => {
            highlighted = this.highlightTibetanMatchingPhonetics(
              highlighted,
              term,
              phoneticsLooseFor
            );
          });
          return highlighted;
        })
        .join('');
    },
    highlightTibetanMatchingPhonetics(definition, term, convert) {
      var numberOfSyllablesForTerm = term.split(' ').length;
      return replaceTibetanGroups(definition, (group) => {
        var combinations = this.everySyllablesCombinationsOfGivenLengthFor(
          group,
          numberOfSyllablesForTerm
        );
        var match = combinations.find((subgroup) => {
          var groupInPhonetics = convert(subgroup);
          return groupInPhonetics.includes(term);
        });
        if (match) {
          var matchWithoutEndingTshek = match.replace(/་$/, '');
          return group.replace(
            new RegExp(`(${matchWithoutEndingTshek}[་།༎༑༔]?)`, 'g'),
            '<em>$1</em>'
          );
        } else return group;
      });
    },
    everySyllablesCombinationsOfGivenLengthFor(
      source,
      numberOfSyllablesForTerm
    ) {
      var syllables = syllablesFor(source);
      var numberOfSyllables = syllables.length;
      var combinations = [];
      for (var i = 0; i + numberOfSyllablesForTerm <= numberOfSyllables; i++) {
        var slice = syllables.slice(i, i + numberOfSyllablesForTerm);
        combinations.push(slice.join('་') + '་');
      }
      return _.chain(combinations).uniq().sortBy('length').value();
    },
    escapeForRegExp(text) {
      return (
        text
          .replace(/([\[\]\{\}\.\*\?])/g, '\\$1')
          // Treat ASCII apostrophe and curly right-single-quote as interchangeable
          // so "d'après" highlights "d'après" in the text and vice-versa.
          .replace(/['’]/g, "['’]")
      );
    },
    async onPaste(event) {
      const clipboard = {
        text: event.clipboardData?.getData('text/plain') || '',
        html: event.clipboardData?.getData('text/html') || '',
      };
      // Text set in a pre-Unicode Tibetan font arrives as Latin gibberish. This
      // field deliberately applies no Wylie conversion — the query syntax only
      // converts Wylie inside parentheses — so repairing is all it does, and
      // every other paste is left to the browser.
      if (!mayNeedLegacyRepair(clipboard)) return;

      event.preventDefault();
      const input = event.target;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const current = this.searchQuery || '';

      const { repairPasteInto } = await import('../services/legacy-to-unicode');
      // The repair can still decline once the font tables are loaded — styled
      // text in an ordinary font reaches this far. preventDefault() has already
      // happened by then, so the raw text has to be inserted by hand.
      const result = (await repairPasteInto(clipboard, {
        value: current,
        start,
        end,
      })) || {
        value: current.substring(0, start) + clipboard.text + current.substring(end),
        caret: start + clipboard.text.length,
      };

      this.searchQuery = result.value;
      this.$nextTick(() => input.setSelectionRange(result.caret, result.caret));
    },
    // The enabled dictionaries in Settings, to tell whether they changed
    // since the results shown were searched
    enabledDictionariesInSettings() {
      return (Storage.get('dictionaries') || [])
        .filter((dictionary) => dictionary.enabled)
        .map((dictionary) => dictionary.id)
        .sort()
        .join(',');
    },
    shownResultsAreStale() {
      return (
        this.entries == undefined ||
        this.packsChangedSinceSearch ||
        this.shownDictionaries !== this.enabledDictionariesInSettings()
      );
    },
    clear() {
      this.shownQuery = null;
      this.searchQuery = '';
      Storage.delete('searchQuery');
      this.pushRoute();
      this.entries = undefined;
      this.cachedRegularTerms = [];
      this.cachedPhoneticsStrictTerms = [];
      this.cachedPhoneticsLooseTerms = [];
    },
    clearPreviousQueries() {
      this.previousQueries = [];
      this.focusInput();
    },
    // The recent searches give way to the results: the focus goes to the
    // field rather than being lost with the button
    searchRecent(query) {
      this.performSearch({ query });
      this.focusInput();
    },
    onLexiconEntrySaved() {
      // Re-run the current search so the new definition shows immediately.
      if (this.searchQuery) this.performSearch({ query: this.searchQuery, fromNavigation: true });
    },
    focusInput(options) {
      this.$refs.input?.focus(options);
    },

    prepareTerm(term) {
      return `"${term.replace(/'/g, "''").replace(/"/g, '""')}"`;
    },
    prepareTermForLike(term) {
      // Escape special SQL LIKE characters and single quotes
      return term.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
    },
    storeQuery() {
      this.previousQueries = this.previousQueries.filter(
        (query) => query != this.searchQuery
      );
      this.previousQueries.unshift(this.searchQuery);
      if (this.previousQueries.length > MAX_PREVIOUS_QUERIES)
        this.previousQueries = this.previousQueries.slice(0, MAX_PREVIOUS_QUERIES);
    },
    pushRoute({ searched = false } = {}) {
      var path = '/search/' + encodeURIComponent(this.searchQuery);
      if (path != this.$route.path) {
        if (searched) this.pushedQuery = this.searchQuery;
        // A push that goes nowhere (same route) never reaches the watcher
        this.$router.push({ path: path }).then((failure) => {
          if (failure) this.pushedQuery = null;
        });
      }
    },
    performSearch(options = {}) {
      this.searchQuery = options.query || this.searchQuery;
      if (this.searchQuery?.trim()) {
        this.loading = true;
        this.shownQuery = this.searchQuery;
        this.shownDictionaries = this.enabledDictionariesInSettings();
        this.packsChangedSinceSearch = false;
        if (!options.fromNavigation) {
          this.storeQuery();
          this.pushRoute({ searched: true });
        }
        // Cache highlight terms at search time to avoid re-rendering on input changes
        this.cachedRegularTerms = [...this.regularSearchTerms];
        this.cachedPhoneticsStrictTerms = [...this.phoneticsStrictSearchTerms];
        this.cachedPhoneticsLooseTerms = [...this.phoneticsLooseSearchTerms];

        var params = [];

        // Hybrid search: FTS for English/phonetics, LIKE for Tibetan
        // FTS unicode61 tokenizer strips Tibetan combining characters, causing incorrect matches
        // LIKE preserves exact Tibetan text for accurate results

        // Split regular terms into Tibetan and non-Tibetan
        const tibetanRegularTerms = this.regularSearchTerms.filter((t) =>
          this.containsTibetan(t)
        );
        const nonTibetanRegularTerms = this.regularSearchTerms.filter(
          (t) => !this.containsTibetan(t)
        );

        // Build FTS conditions for non-Tibetan regular terms
        var ftsConditions = [];
        nonTibetanRegularTerms.forEach((term) => {
          ftsConditions.push(
            `(entries_fts MATCH 'term:${this.prepareTerm(
              term
            )} OR definition:${this.prepareTerm(term)}')`
          );
        });

        // Add phonetic search conditions to FTS
        this.phoneticsStrictSearchTerms.forEach((rawTerm) => {
          // First generate spaceless variants if input has no spaces
          const variants = rawTerm.includes(' ')
            ? [rawTerm]
            : PhoneticSearch.processSpacelessPhoneticSearch(rawTerm);

          // Then apply prepareTermForStrictMatching to each variant and build OR conditions
          const termConditions = variants
            .map((variant) => PhoneticSearch.prepareTermForStrictMatching(variant))
            .map((prepared) => `termPhoneticsStrict:${this.prepareTerm(prepared)}`)
            .join(' OR ');

          ftsConditions.push(
            `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWordsStrict:${this.prepareTerm(
              PhoneticSearch.prepareTermForStrictMatching(rawTerm)
            )}')`
          );
        });
        this.phoneticsLooseSearchTerms.forEach((rawTerm) => {
          // First generate spaceless variants if input has no spaces
          const variants = rawTerm.includes(' ')
            ? [rawTerm]
            : PhoneticSearch.processSpacelessPhoneticSearch(rawTerm);

          // Then apply prepareTermForLooseMatching to each variant and build OR conditions
          const termConditions = variants
            .map((variant) => PhoneticSearch.prepareTermForLooseMatching(variant))
            .map((prepared) => `termPhoneticsLoose:${this.prepareTerm(prepared)}`)
            .join(' OR ');

          ftsConditions.push(
            `(entries_fts MATCH '(${termConditions}) OR definitionPhoneticsWordsLoose:${this.prepareTerm(
              PhoneticSearch.prepareTermForLooseMatching(rawTerm)
            )}')`
          );
        });

        // Build LIKE conditions for Tibetan terms (searches both term and definition)
        var likeConditions = [];
        tibetanRegularTerms.forEach((term) => {
          const escaped = this.prepareTermForLike(term);
          likeConditions.push(
            `(entries.term LIKE '%${escaped}%' ESCAPE '\\' OR entries.definition LIKE '%${escaped}%' ESCAPE '\\')`
          );
        });

        // Build the appropriate query based on what types of conditions we have
        const hasFtsConditions = ftsConditions.length > 0;
        var query;

        if (!hasFtsConditions && likeConditions.length > 0) {
          // Pure Tibetan search - use LIKE only (no FTS join needed)
          // Sort by term length (shorter = more specific match) and dictionary position
          query = `
            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition, 0 AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            WHERE ${likeConditions.join(' AND ')}
            ORDER BY length(entries.term), dictionaryPosition
            LIMIT ${MAX_ENTRIES_PER_REQUEST}
          `;
        } else if (hasFtsConditions) {
          // Has FTS conditions - use FTS with optional LIKE additions for mixed searches
          // BM25 column weights: term(10), termPhoneticsStrict(8), termPhoneticsLoose(8),
          // definition(1), definitionPhoneticsWordsStrict(1), definitionPhoneticsWordsLoose(1)
          // Higher weights = more important for ranking. Term matches weighted 10x over definition.
          const allConditions = [...ftsConditions, ...likeConditions];
          query = `
            SELECT entries.*, dictionaries.name AS dictionary, dictionaries.position AS dictionaryPosition,
                   bm25(entries_fts, 10.0, 8.0, 8.0, 1.0, 1.0, 1.0) AS rank
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = entries.dictionaryId
            INNER JOIN entries_fts ON entries.id = entries_fts.rowid
            WHERE ${allConditions.join(' AND ')}
            ORDER BY rank
            LIMIT ${MAX_ENTRIES_PER_REQUEST}
          `;
        } else {
          // No valid search terms
          this.entries = [];
          this.loading = false;
          return;
        }
        SqlDatabase.exec(query, params)
          .then((rows) => {
            this.entries = rows;
            this.displayedCount = this.batchSize; // Reset to initial batch
            this.expandedTerms = {};
            this.openTerms = {};
            this.resetDictionariesToDefaultAndSetNumberOfEntries();
          })
          .finally(() => {
            this.$nextTick(() => {
              this.loading = false;
              this.setupInfiniteScroll();
            });
          });
      } else this.clear();
    },
    loadMore() {
      if (this.hasMore) {
        this.displayedCount += this.batchSize;
      }
    },
    openDictionaryAbout(dictionary) {
      this.aboutDictionary = dictionary;
      this.aboutOpen = true;
    },
    isScannedDictionary(entry) {
      return !!getScanInfo(entry.dictionary);
    },
    showBuilder() {
      this.builderVisible = true;
    },
  },
  mounted() {
    this._onPacksChanged = () => { this.packsChangedSinceSearch = true; };
    window.addEventListener('all-terms-updated', this._onPacksChanged);
    window.addEventListener('dictionaries-updated', this._onPacksChanged);
    if (this.searchQuery) this.performSearch();
  },
  activated() {
    // The Dictionaries menu was just read again from Settings, without the
    // counts of the results kept from before
    if (this.entries && !this.loading) this.resetDictionariesToDefaultAndSetNumberOfEntries();
    // Without scrolling: on a phone the field scrolls with the results kept
    this.$nextTick(() => this.focusInput({ preventScroll: true }));
  },
  beforeUnmount() {
    window.removeEventListener('all-terms-updated', this._onPacksChanged);
    window.removeEventListener('dictionaries-updated', this._onPacksChanged);
  },
};
</script>


<template>
  <div
    ref="page"
    class="search-page"
    :class="{ 'is-phone': isMobile }"
    data-testid="search-page"
  >
    <h1 class="ui-visually-hidden">Search</h1>
    <div class="search-top">
      <ui-text-field
        ref="input"
        v-model="searchQuery"
        class="search-field"
        :class="{ 'has-tibetan': containsTibetan(searchQuery || '') }"
        placeholder="Type your query"
        aria-label="Search query"
        enterkeyhint="search"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        autofocus
        clearable
        :loading="loading"
        data-testid="search-field"
        @clear="clear"
        @paste="onPaste"
        @keyup.enter="performSearch()"
      >
        <template #append>
          <button
            type="button"
            class="search-button"
            aria-label="Search"
            title="Search"
            :disabled="!canSearch"
            data-testid="search-button"
            @click="performSearch()"
          >
            <ui-icon name="search" :size="20" :stroke-width="2.2" />
          </button>
        </template>
      </ui-text-field>

      <button
        v-if="!builderVisible"
        ref="builderToggle"
        type="button"
        class="builder-toggle"
        data-testid="search-builder-show"
        @click="showBuilder"
      >
        <ui-icon name="sliders-horizontal" :size="16" :stroke-width="2" />
        Query builder
      </button>
    </div>

    <SearchBuilder
      ref="builder"
      v-model="searchQuery"
      v-model:visible="builderVisible"
      @submit="performSearch()"
    />

    <!-- Results count, Dictionaries menu and Add my definition -->
    <div v-if="hasEntries" class="results-header">
      <span class="results-count" data-testid="search-count">
        Showing <b>{{ visibleGroups.length }}</b> of
        <b>{{ groups.length }}</b> {{ groups.length === 1 ? 'term' : 'terms' }}
        &middot; <b>{{ totalNumberOfEntriesForEnabledDictionaries }}</b>
        {{ totalNumberOfEntriesForEnabledDictionaries === 1 ? 'definition' : 'definitions' }}
      </span>
      <div class="ui-spacer" />
      <ResultsAndPaginationAndDictionaries
        :dictionaries="dictionariesForCurrentResults"
        :totalNumberOfEntries="entries.length"
        :hidePagination="true"
        @close:dictionariesMenu="focusInput"
      />
      <template v-if="canAddToLexicon && searchQuery">
        <ui-tooltip v-if="isMobile" text="Add my definition">
          <button
            type="button"
            class="header-button header-button--icon"
            aria-label="Add my definition"
            data-testid="search-add"
            @click="quickAddOpen = true"
          >
            <ui-icon name="book-plus" :size="20" />
          </button>
        </ui-tooltip>
        <button
          v-else
          type="button"
          class="header-button"
          data-testid="search-add"
          @click="quickAddOpen = true"
        >
          Add my definition
        </button>
      </template>
    </div>

    <template v-if="!loading">
      <!-- Before any search: recent searches and what can be searched -->
      <div v-if="entries == undefined" class="search-start" data-testid="search-start">
        <section
          v-if="previousQueries.length > 0"
          class="card recent-searches"
          aria-label="Recent searches"
          data-testid="search-recent"
        >
          <div class="card-header">
            <ui-icon name="history" :size="18" :stroke-width="2" />
            <span class="card-title">Recent searches</span>
            <div class="ui-spacer" />
            <button
              type="button"
              class="link-button"
              data-testid="search-clear-history"
              @click="clearPreviousQueries"
            >
              Clear history
            </button>
          </div>

          <transition-group name="ui-fade" tag="div" class="recent-list">
            <button
              v-for="query in previousQueries"
              :key="query"
              type="button"
              class="recent-query"
              data-testid="search-recent-query"
              @click="searchRecent(query)"
              v-html="wrapAllTibetanWithSpansAndAddTshekIfMissing(query)"
            />
          </transition-group>
        </section>

        <section class="card search-tips" aria-label="What you can search" data-testid="search-tips">
          <span class="card-title">What you can search</span>
          <div class="tips">
            <div class="tip">
              <span class="tip-title">Tibetan or Wylie</span>
              <span class="tip-text">
                Find entries where a headword or a definition contains it.
                Put Wylie in parentheses: (ye shes).
              </span>
            </div>
            <div class="tip">
              <span class="tip-title">English words</span>
              <span class="tip-text">
                Find every entry that mentions a word, in any dictionary you search.
              </span>
            </div>
            <div class="tip">
              <span class="tip-title">How it sounds</span>
              <span class="tip-text">
                Use the query builder to match terms that sound like a spelling.
              </span>
            </div>
          </div>
        </section>
      </div>

      <div
        v-else-if="visibleGroups.length"
        ref="resultsList"
        class="results-list"
        data-testid="search-results"
      >
        <term-entries
          v-for="group in visibleGroups"
          :key="group.term"
          :term="group.decoratedTerm"
          :open="group.open"
          :preview="group.preview"
          :entries="group.entries"
          :total="group.totalEntries"
          :expanded="group.expanded"
          title-testid="search-group-term"
          entry-testid="search-result"
          testid-prefix="search-group"
          data-testid="search-group"
          @toggle-open="toggleOpen(group.term)"
          @open-term="openTerm(group.term)"
          @toggle-more="toggleTerm(group.term)"
          @show-about="openDictionaryAbout"
        />
        <!-- Sentinel for infinite scroll -->
        <div ref="loadMoreSentinel" class="load-more-sentinel" data-testid="search-sentinel">
          <ui-spinner v-if="hasMore" :size="22" label="Loading more results" />
          <span v-else>All {{ groups.length }} {{ groups.length === 1 ? 'term' : 'terms' }} loaded</span>
        </div>
      </div>

      <div v-else class="card no-results" data-testid="search-no-results">No entries</div>

      <UninstalledPacksNotice
        v-if="entries != undefined"
        :result-count="totalNumberOfEntriesForEnabledDictionaries"
      />
    </template>

    <DictionaryAboutDialog v-model="aboutOpen" :dictionary="aboutDictionary" />

    <!-- Mounted at page level (not inside .results-header) so it survives
         that div's own v-if — e.g. entries clearing or a result count
         dropping to zero — while open, instead of being torn down and
         losing whatever the user typed. -->
    <QuickAddDialog
      v-model="quickAddOpen"
      :term="quickAddTerm"
      @saved="onLexiconEntrySaved"
    />
  </div>
</template>

<style lang="stylus" scoped>
.search-page
  box-sizing border-box
  height 100%
  display flex
  flex-direction column
  gap 18px
  padding 28px 40px 0
  overflow hidden
  background var(--bg)
  color var(--ink)
  font-family var(--font-ui)
  font-size var(--text-base)

.card
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.link-button
  border 0
  background none
  padding 8px
  color var(--accent)
  font 600 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    text-decoration underline

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-sm)

// One column: the field, the builder, the results header and the results
// share their left and right edges. Wide, as the results' own columns (term,
// dictionary, definition) keep the definitions' lines short enough to read.
// Centred on a wider window.
.search-page > :not(.ui-visually-hidden)
  width 100%
  max-width 80rem
  margin-inline auto

// The field: 60px, accent ring when focused (UiTextField does the focus)
.search-top
  flex none
  display flex
  align-items center
  gap 16px

.search-field
  flex 1

  :deep(.ui-field__control)
    min-height var(--control-lg)
    padding 0 8px 0 18px
    border-radius var(--radius-card)

  // Latin in Source Serif; Tibetan falls through to DDC Uchen
  :deep(.ui-field__input)
    font-family 'Source Serif 4', var(--font-tibetan)
    font-size 1.375rem
    line-height 1.5

  :deep(.ui-field__input::placeholder)
    font-family var(--font-serif)

  // DDC Uchen reads small at the Latin size
  &.has-tibetan :deep(.ui-field__input)
    font-size var(--text-tibetan-lg)

.search-button
  flex none
  display inline-flex
  align-items center
  justify-content center
  width 2.75rem
  height 2.75rem
  border 0
  border-radius var(--radius-lg)
  background var(--accent)
  color var(--on-accent)
  cursor pointer

  &:hover:not(:disabled)
    opacity 0.9

  &:disabled
    opacity 0.45
    cursor default

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.builder-toggle
  flex none
  display inline-flex
  align-items center
  gap 6px
  padding 8px
  border 0
  background none
  color var(--accent)
  font 600 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    text-decoration underline

  &:focus-visible
    outline 2px solid var(--accent)
    border-radius var(--radius-sm)

// "Showing 12 of 147 results", Dictionaries, Add my definition
.results-header
  flex none
  display flex
  align-items center
  gap 14px
  margin-bottom -4px

.results-count
  font-size var(--text-base)
  color var(--muted)

  b
    color var(--ink)
    font-weight 600

.header-button
  box-sizing border-box
  display inline-flex
  align-items center
  justify-content center
  height 2.25rem
  padding 0 14px
  border 1.5px solid var(--line-strong)
  border-radius var(--radius-lg)
  background var(--surface)
  color var(--ink)
  font 500 var(--text-sm-plus) var(--font-ui)
  cursor pointer

  &:hover
    border-color var(--accent)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 2px

.header-button--icon
  width 2.75rem
  height 2.75rem
  padding 0

// Before any search
.search-start
  flex 1
  min-height 0
  display flex
  flex-direction column
  gap 18px
  overflow-y auto
  padding-bottom 28px

.recent-searches,
.search-tips
  flex none
  padding 20px 24px

.card-header
  display flex
  align-items center
  gap 10px
  margin -8px 0
  color var(--muted)

  .link-button
    margin-right -8px

.card-title
  font-size var(--text-xs)
  font-weight 600
  letter-spacing 0.08em
  text-transform uppercase
  color var(--muted)

.recent-list
  display flex
  flex-wrap wrap
  gap 10px
  margin-top 16px

.recent-query
  box-sizing border-box
  min-height 2.5rem
  max-width 100%
  padding 0 16px
  border 1px solid var(--line)
  border-radius var(--radius-lg)
  background var(--surface)
  color var(--ink)
  font-family var(--font-serif)
  font-size 1.0625rem
  text-align left
  overflow-wrap anywhere
  cursor pointer

  &:hover
    border-color var(--line-strong)
    background var(--soft)

  &:focus-visible
    outline 2px solid var(--accent)
    outline-offset 1px

  // Tibetan, wrapped in spans by the decorator
  :deep(.tibetan)
    font-family var(--font-tibetan)
    font-size 1.25rem
    line-height 1.9

.tips
  display grid
  grid-template-columns repeat(3, 1fr)
  gap 24px
  margin-top 14px

.tip
  display flex
  flex-direction column
  gap 4px

.tip-title
  font-size 0.9375rem
  font-weight 600

.tip-text
  font-size var(--text-sm-plus)
  line-height 1.5
  color var(--muted)

// Results: one card of rows that unfold (TermEntries), which scrolls on a desktop
.results-list
  flex 0 1 auto
  min-height 0
  display flex
  flex-direction column
  margin-bottom 28px
  overflow-y auto
  overscroll-behavior contain
  background var(--surface)
  border 1px solid var(--line)
  border-radius var(--radius-card)
  box-shadow var(--shadow-card)

.load-more-sentinel
  display flex
  justify-content center
  align-items center
  min-height 3.75rem
  padding 0 24px
  font-size var(--text-xs)
  color var(--muted)

.no-results
  flex none
  padding 16px 18px
  font-size var(--text-base)
  color var(--muted)

.search-page :deep(.uninstalled-notice)
  margin 0 0 28px

// Phone (board "B · Search on a phone"): the whole page scrolls, each
// term is a row of the results card.
.search-page.is-phone
  gap 14px
  // Room for the floating help button after the last result
  padding 16px 16px var(--phone-help-clearance)
  overflow-y auto
  -webkit-overflow-scrolling touch

  .search-field
    :deep(.ui-field__control)
      min-height 3.375rem
      padding 0 6px 0 16px

    :deep(.ui-field__input)
      font-size 1.25rem

    &.has-tibetan :deep(.ui-field__input)
      font-size var(--text-tibetan-md)

  // The toggle goes under the field, which keeps the whole width
  .search-top
    flex-wrap wrap
    gap 4px

  .search-field
    flex-basis 100%

  .builder-toggle
    padding 6px 0
    margin-bottom -6px

  .results-header
    gap 8px
    margin-bottom 0

  .results-count
    font-size var(--text-sm-plus)

  .search-start
    flex none
    overflow visible
    padding-bottom 16px

  .recent-searches,
  .search-tips
    padding 16px

  .tips
    grid-template-columns 1fr
    gap 14px

  .results-list
    flex none
    margin-bottom 0
    overflow visible

  .load-more-sentinel
    min-height 3rem

  :deep(.uninstalled-notice)
    margin 0 0 16px

  .no-results
    margin-bottom 16px
</style>
