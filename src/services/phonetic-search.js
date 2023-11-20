import _ from "underscore";

import "../services/normalize";

export default {
  prepareTermForStrictMatching(term) {
    return _.compact(
      this.splitSyllables(term)
        .split(" ")
        .map((subterm) =>
          subterm
            .toLowerCase()
            .replace(/a'?i/g, "e")
            .replace(/[éèë]/g, "e")
            .replace(/w/, "p") // to match ba as wa
            .replace(/al$/, "el")
        )
    ).join(" ");
  },
  prepareTermForLooseMatching(term) {
    return _.compact(
      this.splitSyllables(term)
        .split(" ")
        .map((subterm) =>
          normalize(subterm) // will also take care of ö=>o and ü=>u
            .toLowerCase()
            .replace(/a'?i/g, "e")
            .replace(/^g/g, "k") // all that begins with 'g' becomes 'k'
            .replace(/([^n])g/g, "$1k") // all that ends with 'g' but not 'ng' becomes 'k'
            .replace(/ky/, "k") // to match ki/kyi/gyi
            .replace(/w/, "p") // to match ba as wa
            .replace(/j/g, "ch")
            .replace(/th/g, "t")
            .replace(/d/g, "t")
            .replace(/b/g, "p")
            .replace(/z/g, "s")
            .replace(/kh/g, "k")
            .replace(/dr/g, "tr")
            .replace(/lh/g, "l")
            .replace(/ph/g, "p")
            .replace(/p'/g, "p")
            .replace(/ch'/g, "ch")
            .replace(/an$/, "en")
            .replace(/al$/, "el")
        )
    ).join(" ");
  },
  splitSyllables(text) {
    var text = text
      .toLowerCase()
      .replace(/[-_"\?\!\.]/g, "")
      .replace(/ü/g, "ü");
    var result = "";
    while (text) {
      var match = text.match(
        /((?:siddhi)|(?:ut)|((?:dz)|(?:st)|(?:sv)|(?:ng)|(?:tn)|(?:ts)|(?:[dtjn]r)|(?:[tzsclkd]h)|(?:[kgntd][h]?y)|[jwpbmntdkglrcszyvwh])?[']?[aeiouöüéè][rmnkhpbl]?[g]?[']?[i]?)$/
      );
      if (match) {
        result = match[1] + " " + result.trim();
        text = text.to(match.index).trim();
      } else {
        // If the text is not valid phonetics we just return it as-is
        result = text + result.trim();
        text = "";
      }
    }
    return result;
  },
};
