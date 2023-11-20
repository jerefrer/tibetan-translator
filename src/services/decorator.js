import WylieToUnicode from './wylie-to-unicode'
var wylieToUnicode = new WylieToUnicode();

import SqlDatabase from './sql-database'
import DICTIONARIES_DETAILS from './dictionaries-details'
import DictionariesAbbreviations from './dictionaries-abbreviations'
import { substituteLinksWithATags, withTrailingTshek, replaceTibetanGroups } from '../utils'

export default {

  decorate (entry) {
    var definition = entry.definition;
    var dictionaryDetails = DICTIONARIES_DETAILS[entry.dictionary];
    if (entry.dictionary == 'Illuminator_x') {
      definition = this.substituteWylieVerbs(definition);
      definition = this.substituteWylieExamples(definition);
    }
    definition = this.prettify(definition);
    definition = this.breakIntoSections(definition);
    definition = this.highlightDictionarySpecificTerms(dictionaryDetails, definition);
    definition = this.addTagsForAbbreviations(dictionaryDetails, definition);
    if (dictionaryDetails.containsOnlyTibetan)
      definition = this.wrapWithTibetanSpan(definition);
    else {
      definition = this.wrapAllTibetanWithSpansAndAddTshekIfMissing(definition);
      definition = this.wrapDefinedTibetanWithLinks(definition);
    }
    return definition;
  },

  substituteWylieVerbs (definition) {
    return definition.replace(/(v\.[it]\. )(.*)\/\./g, (wholeMatch, before, verbs) => {
      return (
        before + '<br />' +
        ['<b>Past:</b>', '<b>Present:</b>', '<b>Future:</b>', '<b>Imperative:</b>'].zip(
          verbs
            .split('/')
            .map((verb) => wylieToUnicode.convert(verb.trim()))
        ).map((pair) => pair.join('')).join('<br />') +
        '<br />'
      )
    })
  },

  substituteWylieExamples (definition) {
    // e.g., rig pa ched du ma bsgrub pa
    // e.g., [TC] sgrub dang sun 'byin/ "proof and refutation"
    // E.g., [TC] sangs rgyas pa'i chos sgrub pa/ "to practice / accomplish the buddha's dharma"
    // As Padma Karpo explains: gang zag cig car ba dang /_thod brgal ba dang /_rim skyes pa dang gsum du nges pas/ "Persons are ascertained to be three types: sudden, leap over, and gradually produced, thus..."
    // This goes with what Thrulzhig Namkha’i Naljor said, go rim nges pa med par gang thod thod du brgal pas thod brgal zhes bya ba yin no/ “Given that there is no pre-determined sequence but that the person just leaps over at higher and higher levels, it is called “leap over"."
    return definition;
  },

  wrapTibetanWithSpansAndLinksIfDefined (text) {
    text = this.wrapAllTibetanWithSpansAndAddTshekIfMissing(text);
    text = this.wrapDefinedTibetanWithLinks(text);
    return text;
  },

  wrapAllTibetanWithSpansAndAddTshekIfMissing (text) {
    return replaceTibetanGroups(
      text,
      (tibetan) => {
        var tibetanWithEndingPunctuation = tibetan;
        if (!tibetanWithEndingPunctuation.match(/[་།༑༔ཿ༎]$/))
          tibetanWithEndingPunctuation = tibetanWithEndingPunctuation + '་';
        tibetanWithEndingPunctuation = tibetanWithEndingPunctuation.replace(/^་/g,''); // Cleans up tshek at the beginning, if more than one we might consider this is intentional. Consider moving this in the database initialization.
        return this.wrapWithTibetanSpan(tibetanWithEndingPunctuation)
      }
    );
  },

  wrapWithTibetanSpan (text) {
    return "<span class='tibetan'>" + text + '</span>';
  },

  wrapDefinedTibetanWithLinks (text) {
    return replaceTibetanGroups(
      text,
      (tibetan) => {
        var tibetanWithTrailingTshek = withTrailingTshek(tibetan);
        var tibetanActuallyExistsInDictionary = SqlDatabase.allTerms.includes(tibetanWithTrailingTshek);
        if (tibetanActuallyExistsInDictionary)
          return `<a href='#/define/${tibetanWithTrailingTshek}'>${tibetan}</a>`;
        else
          return tibetan;
      }
    );
  },

  addTagsForAbbreviations (dictionaryDetails, definition) {
    var identifier = dictionaryDetails.abbreviations;
    if (identifier)
      definition = DictionariesAbbreviations.processAbbreviations(identifier, definition);
    return definition;
  },

  highlightDictionarySpecificTerms (dictionaryDetails, definition) {
    var regexp = dictionaryDetails.highlight;
    if (regexp)
      definition = definition.replace(new RegExp(regexp, 'g'),'<b>$1</b>');
    return definition;
  },

  prettify (definition) {
    definition = definition.replace(/\\+n/g,'<br />');
    definition = definition.replace(/\\/g,'');
    definition = definition.replace(/([a-zA-Z0-9\.]){/g,'$1 {');
    definition = definition.replace(/}([a-zA-Z0-9])/g,'} $1');
    definition = definition.replace(/:([^\/])/g,': $1');
    definition = substituteLinksWithATags(definition);
    return definition;
  },

  breakIntoSections (definition) {
    if (definition.match(/([^0-9]|^)1[\.)]/) && definition.match(/([^0-9]|^)2[\.)]/)) {
      // break before numbers like "1." or "1)"
      definition = definition.replace(/([^-0-9(])([(]?[1-9][0-9]?[\.)] ?)([^0-9])/mg,'$1\n$2 $3');
      definition = definition.replace(/^([(]?[1-9][0-9]?[\.)] ?)([^0-9])/mg,'$1 $2');
    }
    return definition;
  }

}