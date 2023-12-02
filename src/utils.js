import _ from 'underscore'
import TibetanRegExps from 'tibetan-regexps'
import { TibetanToPhonetics, Settings } from 'tibetan-to-phonetics'

import { Tokenizer } from './services/tokenizer'

export const phoneticsForGroups = function (setting, groups) {
  return groups.map((group) => {
    return (
      setting == 'strict'
      ? phoneticsStrictFor(group)
      : phoneticsLooseFor(group)
    )
  }).join(' === ')
}

export const strictAndLoosePhoneticsFor = function (text) {
  var tibetanGroups = text.match(TibetanRegExps.tibetanGroups) || [];
  return [
    phoneticsForGroups('strict', tibetanGroups),
    phoneticsForGroups('loose', tibetanGroups)
  ];
}

export const phoneticsStrictFor = function(text) {
  var setting = Settings.find('english-semi-strict');
  _.extend(setting.rules, {
    drengbu: 'e',
    aKikuI: 'e',
    baAsWa: 'p'
  })
  return phoneticsFor(setting, text);
}
export const phoneticsLooseFor = function(text) {
  return phoneticsFor('english-super-loose', text);
}

export const phoneticsFor = function(setting, text) {
  var phonetics = new TibetanToPhonetics({ setting: setting });
  return syllablesFor(text).map(
    (syllable) => phonetics.convert(syllable)
  ).join(' ')
}

export const convertWylieButKeepNonTibetanParts = function (text, wylieToUnicode) {
  var result = '';
  var tokenizer = new Tokenizer(
    [
      /{[^}]*}/,        // Everything between {} (rules are reversed in tibetan only dictionaries)
      /\([A-Z:,\d]+\)/, // Things like (1234) or (WP:1,194)
    ],
    (chunk, isSeparator) => {
      if (isSeparator)
        result += chunk;
      else
        result += wylieToUnicode.convert(chunk);
    }
  );
  tokenizer.parse(text);
  return result;
}

export const tibetanWithPunctuationAsTsheks = function (tibetan) {
  return tibetan.replace(TibetanRegExps.punctuation, '་').replace(/་+/g, '་');
}

export const replaceTibetanGroups = function (text, handler) {
  return text.replace(TibetanRegExps.tibetanGroups, handler);
}

export const syllablesFor = function (tibetan) {
  return _.compact(tibetanWithPunctuationAsTsheks(tibetan).split('་'));
}

export const cleanTerm = function (text) {
  return text
    .replace(/\"/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/­/g, '')     // Deletes zero-width non-joiner
    .replace(/\s+/g, ' ') // Removes consecutive spaces
    .trim();
}

export const withTrailingTshek = function (tibetan) {
  return tibetan.replace(TibetanRegExps.endPunctuation, '') + '་';
}

export const arrayPositionInArray = function (termArray, array) {
  var firstElement = termArray[0];
  var indexesForFirstElement = array.reduce((indexes, value, index) => {
    if (value == firstElement)
      indexes.push(index);
    return indexes;
  }, []);
  var position = indexesForFirstElement.find((index) => {
    return _.isEqual(
      termArray,
      array.slice(index).slice(0, termArray.length)
    );
  });
  if (position >= 0)
    return position;
  else
    return -1;
}

export const substituteLinksWithATags = function(text) {
  return text.replace(
    /((?:https?:\/\/)|(?:www\.))+([-0-9a-zA-Z\/\.\?=&#%_]+)/g,
    (wholeMatch, httpAndWWW, domain) => {
      if (!httpAndWWW.match(/https?:\/\//))
        httpAndWWW = 'http://' + httpAndWWW;
      return `<a target="_blank" href="${httpAndWWW}${domain}">${domain}</a>`;
    }
  )
}