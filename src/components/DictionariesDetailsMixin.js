import Decorator from '../services/decorator'
import DICTIONARIES_DETAILS from '../services/dictionaries-details'
import { substituteLinksWithATags } from '../utils'

export default {
  methods: {
    shortLabelFor(dictionary) {
      return this.dictionaryLabelFor(dictionary.name, { short: true });
    },
    dictionaryLabelFor (dictionaryName, options = {}) {
      var dictionaryName = DICTIONARIES_DETAILS[dictionaryName];
      var label;
      if (dictionaryName) {
        if (options.short && dictionaryName.shortLabel)
          label = dictionaryName.shortLabel;
        else
          label = dictionaryName.label;
      }
      if (label)
        return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(label);
      else
        return dictionaryName;
    },
    dictionaryAboutFor (dictionaryName) {
      var about = DICTIONARIES_DETAILS[dictionaryName]?.about;
      if (about) {
        var split = about.split('|');
        var title = split.first();
        var description = substituteLinksWithATags(split.from(1).join('<br />'));
        var formattedAbout = `<strong>${title}</strong><br />${description}`;
        return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(formattedAbout);
      }
    }
  }
}