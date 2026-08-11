import { describe, it, expect } from 'vitest';
import {
  looksLegacyTibetan,
  htmlToRuns,
  convertLegacyPaste,
  mayNeedLegacyRepair,
  repairPasteInto,
  SEPARATOR_ENCODINGS,
} from '../src/services/legacy-to-unicode.js';

// Pre-Unicode Tibetan fonts encode each glyph as a Latin-1 byte, so a document
// set in one of them yields Latin gibberish when copied as plain text. These
// fixtures are ground truth, not invented:
//
//   CHOGYAL_* are round-trips through tibetan-ansi-to-unicode's convertToAnsi()
//   of real Tibetan, verified lossless in both directions.
//
//   EDEDRIS_PECHA is the literal plain-text concatenation of the first twelve
//   runs of tests/fixtures/thrangu-p1.rtf in the easy-tibetan-copy repository —
//   a real pecha whose font-aware conversion reads
//   ༄༅། །༧སྐྱབས་རྗེ་མཁན་ཆེན་ཁྲ་འགུ་རིན་པོ (Kyabje Khenchen Thrangu Rinpoche).
const CHOGYAL_SANGS_RGYAS = '<$<-{<-'; // སངས་རྒྱས་
const CHOGYAL_BYANG_CHUB = 'e$-&ß/-<è0<-+ý7-'; // བྱང་ཆུབ་སེམས་དཔའ་
const CHOGYAL_THAMS_CAD = '*0<-%+-0aè,-ý-'; // ཐམས་ཅད་མཁྱེན་པ་
const CHOGYAL_BKRA_SHIS = '/g-;Ü<-/+è-:è#<-'; // བཀྲ་ཤིས་བདེ་ལེགས་
const EDEDRIS_PECHA = '!, ,7*2?- eJ- 3#/- (J/- O- :$- <A/- 0R';

describe('looksLegacyTibetan', () => {
  describe('recognises real legacy-font text', () => {
    const legacy = {
      'Chogyal སངས་རྒྱས་': CHOGYAL_SANGS_RGYAS,
      'Chogyal བྱང་ཆུབ་སེམས་དཔའ་': CHOGYAL_BYANG_CHUB,
      'Chogyal ཐམས་ཅད་མཁྱེན་པ་': CHOGYAL_THAMS_CAD,
      'Chogyal བཀྲ་ཤིས་བདེ་ལེགས་': CHOGYAL_BKRA_SHIS,
      'Ededris pecha line': EDEDRIS_PECHA,
    };
    for (const [label, text] of Object.entries(legacy)) {
      it(`returns true for ${label}`, () => {
        expect(looksLegacyTibetan(text)).toBe(true);
      });
    }
  });

  describe('leaves Wylie alone', () => {
    // Wylie is the one thing that MUST keep flowing to convertWylieInText().
    // Converting it as legacy would silently break the app's main input path.
    const wylie = [
      'sangs rgyas',
      "'gro ba'i don du",
      'byang chub sems dpa',
      'thams cad mkhyen pa',
      "chos kyi dbyings kyi ye shes 'od gsal ba",
      'bkra shis bde legs//',
      'g.yag',
      'oM many pad+me hUM',
    ];
    for (const text of wylie) {
      it(`returns false for ${JSON.stringify(text)}`, () => {
        expect(looksLegacyTibetan(text)).toBe(false);
      });
    }
  });

  describe('leaves text that is already Unicode Tibetan alone', () => {
    for (const text of ['སངས་རྒྱས་', 'བྱང་ཆུབ་སེམས་དཔའ་', 'ༀ་མ་ཎི་པདྨེ་ཧཱུྃ']) {
      it(`returns false for ${text}`, () => {
        expect(looksLegacyTibetan(text)).toBe(false);
      });
    }
  });

  describe('leaves ordinary prose and transliteration alone', () => {
    const innocent = [
      'Le tibétain est une langue à part entière.',
      'Voilà — c’est déjà « corrigé » (à 100 %).',
      'Größe & Maß: 50 % über’m Durchschnitt…',
      'see: p. 42–43; cf. §7 (n. 2), "op. cit."',
      'prajñāpāramitā',
      'Śāntideva, Bodhicaryāvatāra',
      'Abhidharmakośabhāṣya (Vasubandhu)',
      'https://example.com/foo?bar=1&baz=2',
      '2024-01-15',
    ];
    for (const text of innocent) {
      it(`returns false for ${JSON.stringify(text)}`, () => {
        expect(looksLegacyTibetan(text)).toBe(false);
      });
    }
  });

  describe('refuses to guess on input too short to carry a signal', () => {
    // Punctuation-only scraps score 1.0 on the symbol ratio, so length is the
    // only thing standing between them and a confident wrong answer.
    for (const text of ['', '   ', '.', '...', '--', '(?!)', '?']) {
      it(`returns false for ${JSON.stringify(text)}`, () => {
        expect(looksLegacyTibetan(text)).toBe(false);
      });
    }
  });

  describe('requires a syllable separator', () => {
    it('returns false for symbol-dense text with no tsheg-encoding character', () => {
      // Same symbol density as legacy Tibetan, but the dashes are em dashes and
      // there is no character any BUDA table maps to ་, so it cannot be a pecha.
      expect(looksLegacyTibetan('A: 1 — B: 2 — C: 3 … (?!)')).toBe(false);
    });
  });

  it('tolerates null and undefined', () => {
    expect(looksLegacyTibetan(null)).toBe(false);
    expect(looksLegacyTibetan(undefined)).toBe(false);
  });
});

describe('htmlToRuns', () => {
  it('reads the font off an inline font-family', () => {
    const html = `<span style="font-family: TibetanChogyal;">&lt;$&lt;-{&lt;-</span>`;
    expect(htmlToRuns(html)).toEqual([
      { text: CHOGYAL_SANGS_RGYAS, font: 'TibetanChogyal' },
    ]);
  });

  it('unquotes a font name the way Word writes it', () => {
    const html = `<span style='font-family:"Ededris-a"'>abc</span>`;
    expect(htmlToRuns(html)).toEqual([{ text: 'abc', font: 'Ededris-a' }]);
  });

  it('keeps only the first family of a font stack', () => {
    const html = `<span style="font-family: Ededris-a, Helvetica, sans-serif">abc</span>`;
    expect(htmlToRuns(html)).toEqual([{ text: 'abc', font: 'Ededris-a' }]);
  });

  it('inherits the font from the nearest styled ancestor', () => {
    const html = `<div style="font-family: Ededris-a"><p><b>abc</b></p></div>`;
    expect(htmlToRuns(html)).toEqual([{ text: 'abc', font: 'Ededris-a' }]);
  });

  it('lets a nested element override its ancestor', () => {
    const html =
      `<div style="font-family: Ededris-a">ab` +
      `<span style="font-family: Ededris-vowa">J</span>cd</div>`;
    expect(htmlToRuns(html)).toEqual([
      { text: 'ab', font: 'Ededris-a' },
      { text: 'J', font: 'Ededris-vowa' },
      { text: 'cd', font: 'Ededris-a' },
    ]);
  });

  it('reads the font off a legacy <font face> attribute', () => {
    const html = `<font face="Ededris-a">abc</font>`;
    expect(htmlToRuns(html)).toEqual([{ text: 'abc', font: 'Ededris-a' }]);
  });

  it('reports an empty font when the markup carries none', () => {
    expect(htmlToRuns('<p>abc</p>')).toEqual([{ text: 'abc', font: '' }]);
  });

  it('drops style and script content rather than treating it as text', () => {
    // Word puts a full stylesheet in its clipboard HTML; its text nodes must
    // not end up in the converted output.
    const html = `<style>.MsoNormal {font-family:"Ededris-a";}</style><p>abc</p>`;
    expect(htmlToRuns(html)).toEqual([{ text: 'abc', font: '' }]);
  });

  it('returns nothing for markup with no text', () => {
    expect(htmlToRuns('<div></div>')).toEqual([]);
    expect(htmlToRuns('')).toEqual([]);
  });
});

// The first twelve runs of tests/fixtures/thrangu-p1.rtf, exactly as
// tibetan-ansi-to-unicode's rtfToRuns() reports them. Note that a single line
// of this pecha alternates between five fonts: the consonants sit in Ededris-a,
// the vowels in Ededris-vowa. Concatenating their text — which is all the
// plain-text clipboard flavour would give — is unrecoverable, because no single
// table decodes both.
const PECHA_RUNS = [
  { text: '!, ,7', font: 'Ededris-vowa' },
  { text: '*', font: 'Ededris-b' },
  { text: '2?- e', font: 'Ededris-a' },
  { text: 'J', font: 'Ededris-vowa' },
  { text: '- 3#/- (', font: 'Ededris-a' },
  { text: 'J', font: 'Ededris-vowa' },
  { text: '/- O- :', font: 'Ededris-a' },
  { text: '$', font: 'Ededris-a1' },
  { text: '- <', font: 'Ededris-a' },
  { text: 'A', font: 'Ededris-vowa' },
  { text: '/- 0', font: 'Ededris-a' },
  { text: 'R', font: 'Ededris-vowa' },
];
const PECHA_UNICODE = '༄༅། །༧སྐྱབས་རྗེ་མཁན་ཆེན་ཁྲ་འགུ་རིན་པོ';

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const runsToHtml = (runs) =>
  runs
    .map((run) => `<span style="font-family: ${run.font}">${escapeHtml(run.text)}</span>`)
    .join('');

describe('convertLegacyPaste', () => {
  describe('when the clipboard HTML names a legacy font', () => {
    it('rebuilds a real pecha line from its five interleaved fonts', async () => {
      const result = await convertLegacyPaste({
        text: PECHA_RUNS.map((run) => run.text).join(''),
        html: runsToHtml(PECHA_RUNS),
      });
      expect(result).toBe(PECHA_UNICODE);
    });

    it('leaves runs set in a non-legacy font untouched', async () => {
      // Converting these too would turn ordinary Latin text into Tibetan, which
      // is exactly the mangling this whole feature exists to undo.
      const result = await convertLegacyPaste({
        text: `Hello ${CHOGYAL_SANGS_RGYAS}`,
        html:
          `<span style="font-family: LucidaGrande">Hello </span>` +
          `<span style="font-family: TibetanChogyal">${escapeHtml(CHOGYAL_SANGS_RGYAS)}</span>`,
      });
      expect(result).toBe('Hello སངས་རྒྱས་');
    });
  });

  describe('when only plain text is available', () => {
    it('converts text that looks legacy using the default table', async () => {
      expect(await convertLegacyPaste({ text: CHOGYAL_BKRA_SHIS })).toBe(
        'བཀྲ་ཤིས་བདེ་ལེགས་'
      );
    });

    it('falls back to the plain text when the HTML names no legacy font', async () => {
      expect(
        await convertLegacyPaste({
          text: CHOGYAL_THAMS_CAD,
          html: `<span style="font-family: Helvetica">${escapeHtml(CHOGYAL_THAMS_CAD)}</span>`,
        })
      ).toBe('ཐམས་ཅད་མཁྱེན་པ་');
    });
  });

  describe('returns null so the caller keeps its normal behaviour', () => {
    const untouched = {
      Wylie: { text: 'sangs rgyas kyi bstan pa' },
      'Unicode Tibetan': { text: 'སངས་རྒྱས་' },
      prose: { text: 'Le tibétain est une langue à part entière.' },
      'empty text': { text: '' },
      'nothing at all': {},
      'HTML with no legacy font and innocent text': {
        text: 'sangs rgyas',
        html: '<span style="font-family: Helvetica">sangs rgyas</span>',
      },
    };
    for (const [label, payload] of Object.entries(untouched)) {
      it(`returns null for ${label}`, async () => {
        expect(await convertLegacyPaste(payload)).toBe(null);
      });
    }
  });
});

describe('the tsheg encodings the detector hard-codes', () => {
  // looksLegacyTibetan() needs the list of code points that encode a tsheg, but
  // reading it from the 430 KB font tables would defeat the point of keeping the
  // gate synchronous and import-free. This pins the literal against the tables
  // so a package update that adds an encoding fails here instead of silently
  // making the detector blind to a font.
  it('covers every code point the BUDA tables map to a tsheg', async () => {
    const { supportedFonts, convertRun } = await import('tibetan-ansi-to-unicode');
    const candidates = [];
    for (let cp = 0x20; cp <= 0xff; cp++) candidates.push(cp);
    for (let cp = 0xe100; cp <= 0xe1ff; cp++) candidates.push(cp);

    const found = new Set();
    for (const font of supportedFonts) {
      for (const cp of candidates) {
        const char = String.fromCodePoint(cp);
        if (convertRun(char, font) === '་') found.add(char);
      }
    }

    expect(found.size).toBeGreaterThan(0);
    // A handful of fonts encode the tsheg as a plain space. The detector counts
    // ratios over non-whitespace characters only, so such a separator carries no
    // signal for it either way — those fonts have to clear the symbol ratio on
    // their own. Everything else must be in the literal.
    const missing = [...found]
      .filter((char) => !/\s/.test(char))
      .filter((char) => !SEPARATOR_ENCODINGS.includes(char));
    expect(missing).toEqual([]);
  });
});

describe('a legacy fragment diluted in ordinary text', () => {
  // The symbol ratio of this paste as a whole is far below what blind
  // conversion accepts, so it only works because the markup names the font.
  const prefix = 'The colophon of the text reads as follows, in full: ';
  const html =
    `<span style="font-family: Helvetica">${prefix}</span>` +
    `<span style="font-family: TibetanChogyal">&lt;$&lt;-{&lt;-</span>`;

  it('is left alone when only plain text is available', async () => {
    expect(await convertLegacyPaste({ text: prefix + CHOGYAL_SANGS_RGYAS })).toBe(null);
  });

  it('is converted when the markup names the font', async () => {
    expect(await convertLegacyPaste({ text: prefix + CHOGYAL_SANGS_RGYAS, html })).toBe(
      `${prefix}སངས་རྒྱས་`
    );
  });
});

describe('mayNeedLegacyRepair', () => {
  // A paste handler has to decide whether to preventDefault() synchronously,
  // before the asynchronous conversion can possibly have an answer. This is
  // that decision, and it must agree with what convertLegacyPaste goes on to do.
  it('is true for text that looks legacy on its own', () => {
    expect(mayNeedLegacyRepair({ text: CHOGYAL_BKRA_SHIS })).toBe(true);
  });

  it('is true when markup names a font, however innocent the text looks', () => {
    expect(
      mayNeedLegacyRepair({
        text: 'The colophon reads: <$<-{<-',
        html: '<span style="font-family: TibetanChogyal">x</span>',
      })
    ).toBe(true);
  });

  it('is false for Wylie', () => {
    expect(mayNeedLegacyRepair({ text: 'sangs rgyas kyi bstan pa' })).toBe(false);
  });

  it('is false for text that is already Unicode Tibetan, fonts or not', () => {
    expect(mayNeedLegacyRepair({ text: 'སངས་རྒྱས་' })).toBe(false);
    expect(
      mayNeedLegacyRepair({
        text: 'སངས་རྒྱས་',
        html: '<span style="font-family: Jomolhari">སངས་རྒྱས་</span>',
      })
    ).toBe(false);
  });

  it('is false for unstyled plain-text markup', () => {
    expect(mayNeedLegacyRepair({ text: 'hello', html: '<p>hello</p>' })).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(mayNeedLegacyRepair({})).toBe(false);
    expect(mayNeedLegacyRepair()).toBe(false);
  });

  it('never says false where convertLegacyPaste would have converted', async () => {
    const pastes = [
      { text: CHOGYAL_SANGS_RGYAS },
      { text: CHOGYAL_BYANG_CHUB },
      { text: EDEDRIS_PECHA },
      { text: PECHA_RUNS.map((r) => r.text).join(''), html: runsToHtml(PECHA_RUNS) },
      { text: 'sangs rgyas' },
      { text: 'སངས་རྒྱས་' },
      { text: 'Le tibétain est une langue à part entière.' },
    ];
    for (const paste of pastes) {
      if ((await convertLegacyPaste(paste)) !== null) {
        expect(mayNeedLegacyRepair(paste)).toBe(true);
      }
    }
  });
});

describe('repairPasteInto', () => {
  // The Search page cannot use TibetanTextField: its query has a syntax of its
  // own, where Wylie is only converted inside parentheses. So it needs the
  // legacy repair WITHOUT the Wylie conversion that field applies, and it is far
  // too entangled with the database layer to mount in a test. This is that
  // handler's whole behaviour, extracted so it can be checked on its own.
  const selection = (value, start = value.length, end = start) => ({
    value,
    start,
    end,
  });

  it('returns null when the paste needs no repair', async () => {
    expect(
      await repairPasteInto({ text: 'sangs rgyas' }, selection(''))
    ).toBe(null);
  });

  it('leaves Wylie untouched so the query syntax survives', async () => {
    // Converting this to Tibetan would break "(sangs rgyas)" style queries.
    expect(await repairPasteInto({ text: '(sangs rgyas)' }, selection(''))).toBe(
      null
    );
  });

  it('splices the repaired text in at the caret', async () => {
    const result = await repairPasteInto(
      { text: CHOGYAL_SANGS_RGYAS },
      selection('ཨ་|ཡིག', 2, 2)
    );
    expect(result.value).toBe('ཨ་སངས་རྒྱས་|ཡིག');
  });

  it('replaces the selected range', async () => {
    const result = await repairPasteInto(
      { text: CHOGYAL_SANGS_RGYAS },
      selection('XXXX', 1, 3)
    );
    expect(result.value).toBe('Xསངས་རྒྱས་X');
  });

  it('reports the caret landing after the inserted text', async () => {
    const result = await repairPasteInto(
      { text: CHOGYAL_SANGS_RGYAS },
      selection('ཨ་ཡིག', 2, 2)
    );
    expect(result.value.slice(0, result.caret)).toBe('ཨ་སངས་རྒྱས་');
  });

  it('copes with the null value a clearable field holds when empty', async () => {
    const result = await repairPasteInto(
      { text: CHOGYAL_SANGS_RGYAS },
      { value: null, start: 0, end: 0 }
    );
    expect(result.value).toBe('སངས་རྒྱས་');
    expect(result.caret).toBe('སངས་རྒྱས་'.length);
  });

  it('uses the font-aware conversion when the markup carries one', async () => {
    const result = await repairPasteInto(
      { text: PECHA_RUNS.map((r) => r.text).join(''), html: runsToHtml(PECHA_RUNS) },
      selection('')
    );
    expect(result.value).toBe(PECHA_UNICODE);
  });
});
