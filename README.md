# TibetanTranslator

An attempt at providing access to the best Tibetan dictionaries in a pleasant
interface for all devices.

## Features

* Unicode Tibetan display
* Wylie support
* Two modes of phonetic search: strict (`[chomdende]`) and loose (`{jomtenté}`)
* Assisted sentence splitting
* Queries can be refined using `&` (and) operator
* Dictionaries filtering
* Keyboard shortcuts
* Works offline

## TODO

### Quick fixes

* Fix highlighting + linking bugs:
  * Search "[sang gye] & tibet" to see the problem:
    <span class="<em>tibet</em>an"><span class="<em>tibet</em>an"><a href="#/define/གཏེར་སྟོན་">གཏེར་སྟོན་</a></span></span>
* Fix the double performSearch on SearchPage
* Find an elegant way to explain that the SQL query returned too much results
  * "Too much results, please narrow down your query."
* Add last definitions on DefinePage when empty
* Add substitution of Illuminator verbs in TranslatePage autocompletes
* Prevents things like ཚངས་སྤྱོད་འདི་ལ་ལེགས་སྤྱད་ཅིང་། /ལམ་ལའང་ལེགས་པར་བསྒོམས་པ་ནི།།
  with the / not being processed
* Take spaces in consideration for PhoneticSearch:
  * [ang gye] should match སངས་རྒྱས་
  * [ ang gye] should not
* Consider having the scrollbar start after the top bars
* Add limiting the query to either the term or the definition
  * by adding "TERM:" or "DEF[INITION]:" in front?
* Understand why:
  CSS `grid-template-columns: repeat(auto-fill, minmax( min(360px, 100%), 1fr ));`
  When put in a `<style lang="stylus">` will yield
  `grid-template-columns: repeat(auto-fill, minmax(100%, 1fr ));`
  (see `ResultsAndPaginationAndDictionaries.vue`)
* Have pu'o be matched on TranslatePage:
  `དངོས་གཞི་ལས་ཀྱི་བྱང་བུའོ༔`

### More complex

* Maybe compress the DB to take much less space ?
  https://github.com/phiresky/sqlite-zstd
  Or try to get rid of the regular entries table to have only a fts5 table?
  What is actually the benefit of having the regular table?
* Have another column in the DB for loose phonetics with merged syllables
  to search against so that `sangye` will match even if we don't put two `p`s.
  => Already tried and almost working in `phoneticSearchWithMergedSyllables`
     branch but remains the question of what to do with the syllables splitting.
     `sangye` searches for `san gye` so either we don't split syllables at all
     or we have merged syllables support. Is there a way to have both?
* Refactor getAbbreviations
* [C,MV] is not matched as two abbreviations, only C:
  * Hopkins 1992 for ཀུན་འབྱུང་གི་བདེན་པ་
* When using the prev/next navigation, continue showing the loader until the
  results shown are for the term actually chosen. If possible just abort other
  requests as we change the page, otherwise just show the loader until the
  right one has finished.
* If we can't find a result using square brackets, after showing no results
  try using curly brackets and if there are matches show a message saying we
  found N matches with curly matches, hit ENTER again to show them.
* Have a popup appear with the definitions when we highlight some Tibetan
* When doing a loose phonetic search, if there are results that would also
  match a strict phonetic search, show them first.
* Find a way to match ལྟ་བ་ཡིས། when looking for ལྟ་བ་ཡིས་
* Make `npm run build:database` multi-threaded to speed up the process
* Find a way to prevent the freezes when having a lot of Tibetan in a search:
  * {selwar} & vivid => yields a lot of Negi results, therefore much time spent
    trying to find matches for the phonetic {selwar}.
    * Maybe make the highlighting asynchronous and entry by entry so that the first
      one will show up immediately and by the time the user starts scrolling the
      others are ready.
* Consider treating "nyi" as "ni" (yi > i) in loose phonetic search
* Consider being able to use wildcards (%)
  * For instance I needed to find something that starts with དབྱིངས་ and ends
    with ཡེ་ཤེས་, but doing དབྱིངས་ & ཡེ་ཤེས་ yields too much results, including
    ཡེ་ཤེས་དབྱིངས་ which is the inverse of what I'm looking for.
* Scroll 0 when changing step in the tutorial
* Fix size of Tibetan in tutorial last step alert info
* Maybe reverse to Roboto mixed with DDC_Uchen in TranslatePage autocomplete results
* Add CTRL+Z feature on TranslatePage
* Add support for 'ang and 'am in word splitting?
  * Add both in `positionFor` and `everyCombinationsFor`
  * Maybe increase by 1 the number of syllables of combinations for SearchPage?

## Possible optimizations

* Before trying to add `ra` or `'i`, check that it's an open vowel

## To report on Christian Steiner's github

* Two things to fix about the conversion of Negi:
  * Everything that is "g}\.{y" should be just "g.y" (1351 occurences)
  * Groups like this one should only be one single chunk:
    {mos dang nga rgyal dga' dang dor/} /{lhur len dbang bsgyur stobs kyis ni/} /{brtson 'grus spel phyir 'bad par bya//}
* Other dictionaries fixes:
  * ac06315
  * The two commits later

## Credits

Infinite gratitude ...
* to my teachers for revealing what is possible
* to the people behind all these incredible dictionaries
* to the people behind THL Dictionary and Tibthop, and to Christian Steiner
  for giving me the inspiration to start this project
* and to the people behind Vue.js, Vuetify, Google Chrome, Material Design,
  SQLite, DevDocs.io and all the other tools that make developing beautiful
  apps so easy and enjoyable.