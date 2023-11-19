import TranslatePageMixins from '../src/components/TranslatePageMixins.js'

export default {
  name: 'TranslatePageMixins.everyCombinationsFor',
  method: (input) => TranslatePageMixins.methods.everyCombinationsFor(input),
  tests: [
    {
      input: 'པ་',
      expected: []
    },
    {
      input: 'བ་',
      expected: []
    },
    {
      input: 'དཔའ་',
      expected: ['དཔའ་']
    },
    {
      input: 'དཔར་',
      expected: ['དཔར་', 'དཔ་', 'དཔའ་']
    },
    {
      input: 'དཔས་',
      expected: ['དཔས་', 'དཔ་', 'དཔའ་']
    },
    {
      input: 'དཔའི་',
      expected: ['དཔའི་', 'དཔ་', 'དཔའ་']
    },
    {
      input: 'སེམས་དཔའ་',
      expected: ['སེམས་དཔའ་','སེམས་','དཔའ་']
    },
  ]
}
