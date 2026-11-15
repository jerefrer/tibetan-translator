import { describe, it, expect } from 'vitest'
import { entryAudio, highlightTerm } from '../src/services/entry-audio'

const SAMPLE =
  '[sound:1-135a.mp3]\nརྙིང་པ Old (Other meanings: Ancient. Antique. Aged.)\nSyllables: ...\n-----\n' +
  'Example: [sound:1-135c.mp3]\n འཛིན་ཁང་འདི་རྙིང་པ་རེད།  This classroom is old.'

const entry = (dictionary, definition) => ({ dictionary, definition })

describe('entryAudio', () => {
  it('should find the word, the example and the source when a Heart of Tibetan Language entry has them', () => {
    expect(entryAudio([entry('hotl1', SAMPLE.replace(/\n/g, '\\n'))])).toEqual({
      audioId: 'hotl1',
      label: 'Heart of Tibetan Language',
      word: '1-135a.mp3',
      example: { file: '1-135c.mp3', tibetan: 'འཛིན་ཁང་འདི་རྙིང་པ་རེད།', translation: 'This classroom is old.' }
    })
  })

  it('should read real newlines like literal ones', () => {
    const audio = entryAudio([entry('hotl1', SAMPLE)])
    expect(audio.word).toBe('1-135a.mp3')
    expect(audio.example.tibetan).toBe('འཛིན་ཁང་འདི་རྙིང་པ་རེད།')
  })

  it('should turn .wav into .mp3 when the markers name wav files', () => {
    const audio = entryAudio([entry('hotl2', '[sound:a.wav] x\nExample: [sound:b.WAV] རེད།  Yes.')])
    expect(audio.word).toBe('a.mp3')
    expect(audio.example.file).toBe('b.mp3')
  })

  it('should have no example when the entry has none', () => {
    expect(entryAudio([entry('hotl3', '[sound:a.mp3] word')]).example).toBeNull()
  })

  it('should have no example when the sentence has no translation', () => {
    expect(entryAudio([entry('hotl3', '[sound:a.mp3]\nExample: [sound:b.mp3] རེད།')]).example).toBeNull()
  })

  it('should return null when no entry is from an audio dictionary', () => {
    expect(entryAudio([entry('RangjungYeshe', '[sound:a.mp3] x')])).toBeNull()
    expect(entryAudio([])).toBeNull()
  })

  it('should return null when an audio dictionary entry has no recording', () => {
    expect(entryAudio([entry('hotl1', 'Old')])).toBeNull()
  })

  it('should use the first entry that has audio', () => {
    const audio = entryAudio([
      entry('RangjungYeshe', '[sound:z.mp3]'),
      entry('hotl2', 'no sound'),
      entry('hotl3', '[sound:c.mp3]'),
      entry('hotl1', '[sound:d.mp3]')
    ])
    expect(audio.audioId).toBe('hotl3')
    expect(audio.word).toBe('c.mp3')
  })

  it('should drop the volume number from the label', () => {
    expect(entryAudio([entry('hotl2', '[sound:a.mp3]')]).label).toBe('Heart of Tibetan Language')
  })
})

describe('highlightTerm', () => {
  it('should mark the term and the tsheg that follows it', () => {
    expect(highlightTerm('འདི་རྙིང་པ་རེད།', 'རྙིང་པ་')).toEqual([
      { text: 'འདི་', match: false },
      { text: 'རྙིང་པ་', match: true },
      { text: 'རེད།', match: false }
    ])
  })

  it('should return one plain part when the term is not in the sentence', () => {
    expect(highlightTerm('འདི་རེད།', 'རྙིང་པ་')).toEqual([{ text: 'འདི་རེད།', match: false }])
  })

  it('should mark the term when it ends the sentence', () => {
    expect(highlightTerm('འདི་རྙིང་པ', 'རྙིང་པ་')).toEqual([
      { text: 'འདི་', match: false },
      { text: 'རྙིང་པ', match: true }
    ])
  })
})
