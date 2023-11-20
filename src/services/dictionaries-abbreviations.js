import _ from 'underscore'

import Decorator from './decorator'
import ABBREVIATIONS from './dictionaries-abbreviations-list'
import WylieToUnicode from './wylie-to-unicode'
const wylieToUnicode = new WylieToUnicode()

export default {

  ABBREV: {},

  getAbbreviations (dictionaryIdentifier) {
    if (!this.ABBREV[dictionaryIdentifier]) {
      var abbrev = ABBREVIATIONS[dictionaryIdentifier];
      var searchPattern = abbrev.match;
      var searchList = {};

      if ((typeof searchPattern) === "string")
        searchPattern = [searchPattern];

      for (var i in searchPattern) {
        var search = searchPattern[i];

        for (var abbr in abbrev.items) {
          var abbrEscaped = abbr.replace(/([\[\]\.\*\+\{\}])/g, '\\$1');
          var termSearch = search.replace("TERM", abbrEscaped);

          if (!searchList[abbr])
            searchList[abbr] = [];

          searchList[abbr].push({
            search: new RegExp(termSearch, "mg"),
            explanation: abbrev.items[abbr]
          });

          if (termSearch.indexOf(' ')>-1) {
            var abbrCondensed = abbrEscaped.replace(/ /g,'');
            var termSearch2 = search.replace("TERM",abbrCondensed);

            var abbrNoSpace = abbr.replace(/ /g,'')
            if (!searchList[abbrNoSpace])
                searchList[abbrNoSpace] = [];

            searchList[abbrNoSpace].push({
              search: new RegExp(termSearch2, "mg"),
              explanation: abbrev.items[abbr]
            });
          }
        }
      }

      this.ABBREV[dictionaryIdentifier] = searchList;
    }
    return this.ABBREV[dictionaryIdentifier];
  },

  processAbbreviations (dictionaryIdentifier, text) {
    var abbreviations = this.getAbbreviations(dictionaryIdentifier);
    _(abbreviations).each((items) => {
      _(items).each((item) => {
        var explanation = item.explanation.replace(/[|]/g, '<br />');
        explanation = wylieToUnicode.substituteCurlyBrackets(explanation);
        text = text.replace(
          item.search,
          '$1<abbr data-title="' + explanation + '">$2</abbr>$3'
        );
      })
    });
    return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(text);
  },

}