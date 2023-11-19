import PhoneticSearch from '../../src/services/phonetic-search.js'

export default {
  name: 'PhoneticSearch.splitSyllables',
  method: (input) => PhoneticSearch.splitSyllables(input),
  tests: [
    {
      input: 'sanggye',
      expected: 'sang gye'
    },
    {
      input: 'kutseshappeten',
      expected: 'ku tse shap pe ten'
    },
    {
      input: 'jomolari',
      expected: 'jo mo la ri'
    },
  ]
}