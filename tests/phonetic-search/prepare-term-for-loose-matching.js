import PhoneticSearch from '../../src/services/phonetic-search.js'

export default {
  name: 'PhoneticSearch.prepareTermForLooseMatching',
  method: (input) => PhoneticSearch.prepareTermForLooseMatching(input),
  tests: [
    {
      input: 'aeiouäëïöüàèìòùé',
      expected: 'aeiouaeiouaeioue'
    },
    {
      input: 'gom',
      expected: 'kom'
    },
    {
      input: 'mi gom',
      expected: 'mi kom'
    },
    {
      input: 'zang gye',
      expected: 'sang ke'
    },
    {
      input: 'yang dag',
      expected: 'yang tak'
    },
    {
      input: "pa'i",
      expected: "pe"
    },
    {
      input: "pai",
      expected: "pe"
    },
    {
      input: "pé",
      expected: "pe"
    }
  ]
}