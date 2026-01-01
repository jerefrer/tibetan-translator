import Decorator from '../services/decorator'
import DICTIONARIES_DETAILS from '../services/dictionaries-details'
import { substituteLinksWithATags } from '../utils'

export default {
  methods: {
    shortLabelFor(dictionary) {
      return this.dictionaryLabelFor(dictionary.name, { short: true });
    },
    dictionaryLabelFor (dictionaryName, options = {}) {
      var dictionaryDetails = DICTIONARIES_DETAILS[dictionaryName];
      var label;
      if (dictionaryDetails) {
        if (options.short && dictionaryDetails.shortLabel)
          label = dictionaryDetails.shortLabel;
        else
          label = dictionaryDetails.label;
      }
      if (label)
        return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(label);
      else
        return dictionaryName; // Return original name if not in config
    },
    dictionaryAboutFor (dictionaryName) {
      var about = DICTIONARIES_DETAILS[dictionaryName]?.about;
      if (about) {
        var split = about.split('|');
        var title = split[0];
        var description = substituteLinksWithATags(split.slice(1).join('<br />'));
        var formattedAbout = `<strong>${title}</strong><br />${description}`;
        return Decorator.wrapAllTibetanWithSpansAndAddTshekIfMissing(formattedAbout);
      }
    }
  }
}