import { EwtsConverter } from "tibetan-ewts-converter";
import TibetanNormalizer from "tibetan-normalizer";

export default function () {
  return {
    ewts: new EwtsConverter(),

    substituteCurlyBrackets(text) {
      return text.replace(/{[^}]+}/g, (tibetan) =>
        this.convert(tibetan.replace(/[{}]/g, ""))
      );
    },

    convert(text) {
      return this.ewts.to_unicode(TibetanNormalizer.normalize(text));
    },

    get_warnings() {
      return this.ewts.get_warnings();
    }
  };
}
