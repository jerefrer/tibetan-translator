import WylieToUnicode from './wylie-to-unicode'
var wylieToUnicode = new WylieToUnicode();

import SqlDatabase from './sql-database'
import DICTIONARIES_DETAILS from './dictionaries-details'
import DictionariesAbbreviations from './dictionaries-abbreviations'
import { substituteLinksWithATags, withTrailingTshek, replaceTibetanGroups } from '../utils'

export default {

  decorate (entry) {
    var definition = entry.definition;
    var dictionaryDetails = DICTIONARIES_DETAILS[entry.dictionary] || {};
    if (entry.dictionary == 'Illuminator_x') {
      definition = this.substituteWylieVerbs(definition);
    }
    definition = this.prettify(definition, entry.dictionary);
    definition = this.formatMultilingualSections(definition);
    definition = this.breakIntoSections(definition);
    definition = this.highlightDictionarySpecificTerms(dictionaryDetails, definition);
    definition = this.addTagsForAbbreviations(dictionaryDetails, definition);
    if (dictionaryDetails?.containsOnlyTibetan)
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
          return `<a href='/define/${tibetanWithTrailingTshek}'>${tibetan}</a>`;
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

  prettify (definition, dictKey) {
    definition = definition.replace(/\\+n/g,'<br />');
    definition = definition.replace(/\\/g,'');
    definition = definition.replace(/([a-zA-Z0-9\.]){/g,'$1 {');
    definition = definition.replace(/}([a-zA-Z0-9])/g,'} $1');
    definition = definition.replace(/:([^\/])/g,': $1');
    definition = substituteLinksWithATags(definition);

    // Replace [sound: filename] markers with full audio player
    definition = definition.replace(
      /\[sound:\s*([^\]]+)\]/g,
      (match, filename) => {
        // Convert .wav to .mp3 (audio files are re-encoded to mp3)
        const mp3Filename = filename.trim().replace(/\.wav$/i, '.mp3');
        const audioPath = `/audio/${dictKey}/${mp3Filename}`;
        // Use SVG for play/pause icons to avoid iOS emoji rendering
        const playIcon = `<svg class="play-icon" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
        const pauseIcon = `<svg class="pause-icon" viewBox="0 0 24 24" width="12" height="12" style="display:none"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        return `
          <div class="audio-player" data-audio="${audioPath}">
            <button class="audio-play-btn" title="Play audio">${playIcon}${pauseIcon}</button>
            <div class="audio-progress-container">
              <div class="audio-progress-bar">
                <div class="audio-progress-fill"></div>
                <div class="audio-progress-handle"></div>
              </div>
            </div>
            <span class="audio-time">0:00 / 0:00</span>
          </div>`;
      }
    );

    return definition;
  },

  formatMultilingualSections (definition) {
    // Detects definitions with language labels (e.g. "EN some text<br />FR du texte")
    // Only applies when the definition starts with a known language code.
    var langCodes = ['Skt', 'EN', 'FR', 'PT', 'ES', 'IT', 'DE', 'PL', 'ZH', 'JA'];
    var startsWithLang = langCodes.some(code => definition.startsWith(code + ' '));
    if (!startsWithLang) return definition;
    var langPattern = langCodes.join('|');
    var regex = new RegExp(`(?:^|<br \\/>)((?:${langPattern}) )`, 'g');
    // Split on <br /> boundaries where a lang code follows, then wrap each section
    var sections = definition.split(/<br \/>/);
    var langRegex = new RegExp(`^(${langPattern}) (.*)`);
    return sections.map(section => {
      var match = section.match(langRegex);
      if (match) {
        return `<span class="dict-lang-section"><span class="dict-lang-label">${match[1]}</span>${match[2]}</span>`;
      }
      return section;
    }).join('');
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