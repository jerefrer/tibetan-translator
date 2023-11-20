import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { StringDecoder } from 'string_decoder';
const utf8Decoder = new StringDecoder('utf8');

import Sugar from 'sugar';
Sugar.extend();

import rimraf from 'rimraf';
import ProgressBar from 'progress';
import { formatDuration } from 'date-fns';

import DICTIONARIES_DETAILS from '../src/services/dictionaries-details.js';
import {
  cleanTerm,
  convertWylieButKeepNonTibetanParts
} from '../src/utils.js';

const linesWithMissedWylieFilename = 'wylieLinesWithMistakesForStarDict.txt';

var StarDictTextFilesBuilder = {

  outputFolder: path.join(__dirname, 'stardict'),
  dictionariesFolder: path.join(__dirname, 'dictionaries'),

  build () {
    this.startedAt = Date.now();
    this.printNewLineAtTheBeginning();
    this.cleanup();
    this.loadDictionaries();
    this.computeNumberOfLines();
    this.setupProgressBar();
    this.insertEntries();
  },

  printNewLineAtTheBeginning () {
    console.log();
  },

  cleanup () {
    rimraf.sync(this.outputFolder);
    fs.mkdirSync(this.outputFolder);
  },

  loadDictionaries () {
    this.dictionaries =
      fs.readdirSync(this.dictionariesFolder).map((filename, index) => {
        return {
          id: index + 1,
          filename: filename,
          name: filename.replace(/^\d+-/, ''),
          path: this.dictionariesFolder + '/' + filename,
        }
      });
  },

  computeNumberOfLines () {
    console.log('Calculating total number of lines to process ...');
    this.totalNumberOfLines = 0;
    this.dictionaries.forEach((dictionary) => {
      var text = utf8Decoder.write(fs.readFileSync(dictionary.path));
      var lines = text.split(/[\r][\n]/);
      dictionary.numberOfLines = lines.length;
      if (_.last(lines).trim() == '')
        dictionary.numberOfLines -= 1;
      this.totalNumberOfLines += dictionary.numberOfLines;
    });
  },

  setupProgressBar () {
    var _this = this;
    this.progressBar = new ProgressBar(
      'Generating database (:percent) [:bar] :elapseds since starting [:current/:total]',
      {
        incomplete: ' ',
        width: 30,
        total: this.totalNumberOfLines,
        callback () {
          // if (this.isComplete)
          //   return
          // this.isComplete = true;
          var totalTime = formatDuration(Date.now(), _this.startedAt);
          console.log(
            '\n' +
            'Done !\n' +
            `StarDict files generated in "stardict/" in ${totalTime}`
          );
        }
      }
    );
  },

  insertEntries () {
    this.dictionaries.forEach((dictionary) => {
      this.eachLineForFile(dictionary.path, (line) => {
        this.processLine(dictionary, line);
        this.progressBar.tick();
      })
    })
  },

  processLine (dictionary, line) {
    line = line.trim();

    if (!line)
      return;

    var split = line.split('|');
    var wylieTerm = cleanTerm(split[0]);
    var definitionWithMaybeWylie = split[1] && split[1].trim();

    if (line.match(/^#/) || !definitionWithMaybeWylie)
      return;

    var term = this.wylieToUnicode.convert(wylieTerm).replace(/་$/, '');
    var definition;
    var dictionaryDetails = DICTIONARIES_DETAILS[dictionary.name];
    if (dictionaryDetails && dictionaryDetails.containsOnlyTibetan) {
      definition = convertWylieButKeepNonTibetanParts(definitionWithMaybeWylie, this.wylieToUnicode);
    } else
      definition = this.wylieToUnicode.substituteCurlyBrackets(definitionWithMaybeWylie, (englishPart) => {
        englishPart = englishPart.replace(/([,\.]) */g,'$1 ');
        englishPart = englishPart.replace(/ *- */g,' - ');
        return englishPart;
      });
    var statement = term + '	' + definition + '\n';
    var textFilePath = path.join(this.outputFolder, dictionary.filename + '.txt');
    fs.appendFileSync(textFilePath, statement);
  },

  eachLineForFile(filepath, callback) {
    const rl = readline.createInterface({
      input: fs.createReadStream(filepath),
      crlfDelay: Infinity
    });
    rl.on('line', (line) => {
      var utf8Line = utf8Decoder.write(line);
      callback(utf8Line);
    });
  }

}

StarDictTextFilesBuilder.build();