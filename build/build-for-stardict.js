const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { StringDecoder } = require('string_Decoder');
const utf8Decoder = new StringDecoder('utf8');

require('sugar');
const JSZip = require('jszip');
const rimraf = require('rimraf');
const ProgressBar = require('progress');
const { formatDuration } = require('date-fns');

const WylieToUnicode = require('../../wylie-to-unicode');

const { DICTIONARIES_DETAILS } = require('../src/services/dictionaries-details.umd.js');
const {
  cleanTerm,
  strictAndLoosePhoneticsFor,
  convertWylieButKeepNonTibetanParts
} = require('../src/utils.umd.js');


const outputFilename = 'dictionaries.zip';
const linesWithMissedWylieFilename = 'wylieLinesWithMistakesForStarDict.txt';

var StarDictTextFilesBuilder = {

  outputFolder: path.join(__dirname, 'stardict'),
  dictionariesFolder: path.join(__dirname, 'dictionaries'),
  linesWithMissedWylieForStarDictFilePath: path.join(__dirname, linesWithMissedWylieFilename),

  build () {
    this.startedAt = Date.now();
    this.printNewLineAtTheBeginning();
    this.cleanup();
    this.setupWylieToUnicodeWithLoggingOfMissedLines();
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
    if (fs.existsSync(this.linesWithMissedWylieForStarDictFilePath))
      fs.unlinkSync(this.linesWithMissedWylieForStarDictFilePath);
  },

  setupWylieToUnicodeWithLoggingOfMissedLines () {
    this.wylieToUnicode = new WylieToUnicode((source, converted) => {
      fs.appendFileSync(
        this.linesWithMissedWylieForStarDictFilePath,
        source + ' ===> ' + converted + '\n'
      )
    })
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
    this.dictionaries.each((dictionary, index) => {
      var text = utf8Decoder.write(fs.readFileSync(dictionary.path));
      var lines = text.split(/[\r][\n]/);
      dictionary.numberOfLines = lines.count();
      if (lines.last().trim() == '')
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
          if (fs.existsSync(_this.linesWithMissedWylieForStarDictFilePath)) {
            console.log(
              '\n'+
              'Some lines contained malformed Wylie that could not be properly ' +
              'converted to Unicode.\n' +
              `They were logged to "build/${linesWithMissedWylieFilename}".`);
          }
        }
      }
    );
  },

  insertEntries () {
    this.dictionaries.each((dictionary) => {
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