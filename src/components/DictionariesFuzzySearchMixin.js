import fuzzysort from 'fuzzysort'

export default {
  data () {
    return {
      term: ''
    }
  },
  computed: {
    fuzzyMatchedDictionaries () {
      if (this.term)
        return fuzzysort.go(this.term, this.dictionaries, {
          key: 'shortLabel',
          allowTypo: false
        }).map((result) => result.obj);
      else
        return this.dictionaries;
    }
  },
  methods: {
    fuzzyDisplayFor (dictionary) {
      if (this.term)
        return fuzzysort.highlight(
          fuzzysort.single(this.term, dictionary.shortLabel),
          '<b><u>',
          '</u></b>'
        );
      else
        return dictionary.shortLabel;
    }
  }
}