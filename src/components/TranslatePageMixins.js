import _ from 'underscore'
import { v4 as uuid } from 'uuid'
import TibetanNormalizer from 'tibetan-normalizer'

import Storage from '../services/storage'
import SqlDatabase from '../services/sql-database'
import {
  syllablesFor,
  arrayPositionInArray,
  tibetanWithPunctuationAsTsheks
} from '../utils'

export default {
  computed: {
    onlyOneEmptyLine() {
      return this.lines.length == 1 && this.lineIsEmpty(this.lines[0])
    }
  },
  methods: {
    splitTextIntoDefinedLines (text) {
      var translationLines = [];
      var promises = [];
      var translationLine = this.newTranslationLine();
      text.trim().split('\n').each((line) => {
        if (this.isSource(line)) {
          if (translationLine.source) {
            translationLines.push(translationLine);
            translationLine = this.newTranslationLine();
          }
          translationLine.source = TibetanNormalizer.normalize(line);
          var words = [];
          if (Storage.get('autoFillWords')) {
            translationLine.opened = true;
            translationLine.words =
              this.definedWordsAccordingToPreferenceFor(
                translationLine.source,
                { keepEveryCombination: !Storage.get('keepLongestOnly') }
              );
            promises.push(this.fillInTranslationWithFirstDefinitionFor(translationLine.words))
          }
        } else {
          if (translationLine.translation)
            translationLine.translation += "\n";
          translationLine.translation = (translationLine.translation || '') + line;
        }
      });
      if (translationLine.source)
        translationLines.push(translationLine);
      return new Promise((resolve, reject) => {
        Promise.all(promises).then(() => {
          resolve(translationLines);
        })
      });
    },
    fillInTranslationWithFirstDefinitionFor (words) {
      return new Promise((resolve, reject) => {
        Promise.all(words.map((definedWord) => {
          return this.fetchFirstDefinitionForTerm(definedWord.source).then(
            (definition) => definedWord.translation = definition
          )
        })).then(() => {
          resolve(words);
        })
      });
    },
    fetchFirstDefinitionForTerm (term) {
      return new Promise((resolve, reject) => {
        SqlDatabase.exec(`
          SELECT definition
          FROM entries
          INNER JOIN dictionaries ON dictionaries.id = dictionaryId
          WHERE term = ?
          AND dictionaries.enabled = 1
          ORDER BY dictionaries.position
          LIMIT 1`,
          [term]
        ).
        then((rows) => resolve(rows.first().definition)).
        catch((error)  => reject(error));
      })
    },
    isSource (text) {
      return text.match(/([†◌卍卐\u{f00}-\u{fda}\u{f021}-\u{f042}\u{f162}-\u{f588}]+)/iu);
    },
    definedWordsAccordingToPreferenceFor (source, options = {}) {
      if (options.keepEveryCombination)
        return this.everyDefinedWordsFor(source, options);
      else
        return this.longestDefinedWordsFor(source, options);
    },
    definedWordsWithoutSelfAccordingToPreferenceFor(source, options = {}) {
      var syllables = syllablesFor(source);
      if (syllables.length < 2)
        return [];
      var definedWords = this.definedWordsAccordingToPreferenceFor(
        source,
        Object.assign({}, options, { ignoreSelf: true })
      );
      var sourceWithoutEndingParticle = source.replace(/[པབམ][ོ]?་$/, '');
      if (definedWords.length == 1 && definedWords[0].source == sourceWithoutEndingParticle)
        // If there is only one word and it's the source without 'pa' or 'wa'
        // it wouldn't be so interesting to define it so we try breaking smaller
        return this.definedWordsWithoutSelfAccordingToPreferenceFor(sourceWithoutEndingParticle);
      else
        return definedWords;
    },
    longestDefinedWordsFor (source, options) {
      var words = [];
      var sourceWithPunctuationAsTsheks = tibetanWithPunctuationAsTsheks(source);
      var syllables = syllablesFor(source);
      var sourceBuffer = sourceWithPunctuationAsTsheks;
      var definedWords = this.everyDefinedWordsFor(source, options);
      var positionFor = (word) => {
        var indexOf = (text) => arrayPositionInArray(syllablesFor(text), syllables);
        var position = indexOf(word.source);
        if (position < 0)
          position = indexOf(word.source.replace(/་$/, 'ས་'));
        if (position < 0)
          position = indexOf(word.source.replace(/་$/, 'ར་'));
        if (position < 0)
          position = indexOf(word.source.replace(/་$/, 'འི་'));
        if (position < 0)
          position = indexOf(word.source.replace(/འ་$/, 'འི་'));;
        if (position < 0)
          position = indexOf(word.source.replace(/ར་$/, 'འ་'));
        if (position < 0)
          position = indexOf(word.source.replace(/ས་$/, 'འ་'));
        if (position < 0)
          position = 999999;
        return position;
      }
      var definedWordsLongestThenRightmost = definedWords
        .sortBy((word) => {
          var numberOfSyllables = syllablesFor(word.source).length;
          var positionInLine = positionFor(word);
          var pad = (number) => number.toString().padStart(6, '0');
          return [pad(numberOfSyllables), pad(positionInLine)];
        })
        .reverse();
      definedWordsLongestThenRightmost.each((word) => {
        var sourceWithoutTshek = this.withoutTshek(word.source);
        if (sourceBuffer.has(sourceWithoutTshek)) {
          sourceBuffer = sourceBuffer.replace(sourceWithoutTshek, '');
          words.push(word)
        }
      })
      return words.sortBy((word) => positionFor(word));
    },
    everyDefinedWordsFor (source, options = {}) {
      var definedWords = this.definedWordsFor(this.everyCombinationsFor(source));
      if (options.ignoreSelf)
        definedWords = _(definedWords).reject((word) => word.source == source)
      return definedWords;
    },
    definedWordsFor(sources) {
      return sources.map((source) => {
        if (SqlDatabase.allTerms.includes(source))
          return this.newWord(source, '')
      }).compact();
    },
    withoutTshek (source) {
      return source.replace(/་$/, '')
    },
    everyCombinationsFor (source) {
      var syllables = syllablesFor(source);
      var numberOfSyllables = syllables.length;
      var combinations = [];
      for (var i = 0; i < numberOfSyllables; i++) {
        for (var j = numberOfSyllables; j > 0; j--) {
          var slice = syllables.slice(i, j);
          if (slice.length) {
            var sliceText = slice.join('་') + '་';
            combinations.push(sliceText);
            if (sliceText.match(/འི་$/)) {
              combinations.push(sliceText.replace(/འི་$/, '་'));
              combinations.push(sliceText.replace(/འི་$/, 'འ་'));
            }
            var endsWithPaOrWaThenRaOrSa = /([པབ][ིོེུ]?)[རས]་$/;
            if (sliceText.match(endsWithPaOrWaThenRaOrSa)) {
              combinations.push(sliceText.replace(endsWithPaOrWaThenRaOrSa, '$1་'));
              combinations.push(sliceText.replace(endsWithPaOrWaThenRaOrSa, '$1འ་'));
            }
          }
        }
      }
      combinations = _(combinations).without('པ་', 'བ་');
      return combinations.unique();
    },
    newTranslationLine (source, translation, words, opened) {
      return {
        id: uuid(),
        color: '',
        source: source || '',
        translation: translation || '',
        words: words || this.emptyWords(),
        opened: opened || false,
        loading: false
      }
    },
    lineIsEmpty (line) {
      return !(
        line.source ||
        line.translation ||
        line.words.any((word) => word.source || word.translation)
      )
    },
    emptyWords () {
      return _(1).times(() => this.newWord());
    },
    newWord (source, translation) {
      return {
        id: uuid(),
        color: '',
        source: source || '',
        translation: translation || ''
      }
    }
  }
}