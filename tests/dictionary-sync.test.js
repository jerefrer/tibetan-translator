import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { PACK_DEFINITIONS } from '../src/config/pack-definitions.js';
import { KEYWORDS } from '../scripts/lib/dictionary-keywords.js';
import {
  canonicalName,
  matchLocalName,
  extractObjectLiteral,
  parseDictlist,
  parseAbbreviations,
  remapKeys,
  diffDetails,
  applyOverrides,
  isIgnored,
  mergeOverrides,
} from '../scripts/lib/dictionary-sync-core.js';

const LOCAL = [
  '01-Hopkins2015',
  "20-Hopkins-others'English2015",
  '22-Yoghacharabhumi-glossary',
  '38-Gaeng,Wetzel',
  '12-Hopkins-Divisions,Tib2015',
];

describe('canonicalName', () => {
  it('should ignore the numeric prefix, case and punctuation', () => {
    expect(canonicalName("20-Hopkins-others'English2015")).toBe(
      'hopkinsothersenglish2015'
    );
  });
});

describe('matchLocalName', () => {
  it('should keep the local name when upstream dropped a comma', () => {
    expect(matchLocalName('38-GaengWetzel', LOCAL)).toBe('38-Gaeng,Wetzel');
  });

  it('should keep the local name when upstream dropped an apostrophe', () => {
    expect(matchLocalName('20-Hopkins-othersEnglish2015', LOCAL)).toBe(
      "20-Hopkins-others'English2015"
    );
  });

  it('should follow an alias when upstream fixed a spelling', () => {
    expect(matchLocalName('22-Yogacharabhumi-glossary', LOCAL)).toBe(
      '22-Yoghacharabhumi-glossary'
    );
  });

  it('should match prefixless names such as dictlist keys', () => {
    expect(matchLocalName('Hopkins-DivisionsTib2015', LOCAL)).toBe(
      '12-Hopkins-Divisions,Tib2015'
    );
  });

  it('should return null when no local dictionary corresponds', () => {
    expect(matchLocalName('01-JongbokYi', LOCAL)).toBeNull();
  });

  it('should prefer an exact match over a canonical one', () => {
    expect(matchLocalName('01-Hopkins2015', LOCAL)).toBe('01-Hopkins2015');
  });
});

describe('extractObjectLiteral', () => {
  it('should return the balanced literal after the marker', () => {
    const src = 'const A = { a: { b: 1 }, c: 2 } as const;\nconst B = {};';
    expect(extractObjectLiteral(src, /const A[^=]*=/)).toBe(
      '{ a: { b: 1 }, c: 2 }'
    );
  });

  it('should ignore braces inside strings', () => {
    const src = `export const X: T = { a: "}{", b: 'it\\'s }', c: \`{\` };`;
    expect(extractObjectLiteral(src, /export const X[^=]*=/)).toBe(
      `{ a: "}{", b: 'it\\'s }', c: \`{\` }`
    );
  });

  it('should ignore braces inside comments', () => {
    const src = 'const X = { a: 1, // }\n b: 2 /* } */ };';
    expect(extractObjectLiteral(src, /const X\s*=/)).toBe(
      'const X = { a: 1, // }\n b: 2 /* } */ };'.slice(10, -1)
    );
  });

  it('should return null when the marker is absent', () => {
    expect(extractObjectLiteral('const Y = {};', /const X\s*=/)).toBeNull();
  });
});

describe('parseDictlist', () => {
  const source = `
    interface Foo { a: string }
    export const GROUPED_DICTLIST: GroupedDictListType = {
      "Solo": { label: 'So&shy;lo', public: true, language: ["tib"] },
      "_Group": {
        type: 'group',
        label: 'Group',
        items: {
          "Child": { label: 'Child', public: true, language: ["en"] }
        }
      }
    } as const;
    export let DICTLIST = {};
  `;

  it('should flatten groups into their items', () => {
    expect(Object.keys(parseDictlist(source))).toEqual(['Solo', 'Child']);
  });

  it('should strip soft hyphen markers from labels', () => {
    expect(parseDictlist(source).Solo.label).toBe('Solo');
  });

  it('should throw when the dictionary list is missing', () => {
    expect(() => parseDictlist('const nothing = 1')).toThrow(/GROUPED_DICTLIST/);
  });
});

describe('parseAbbreviations', () => {
  it('should read a typed ABBREVIATIONS constant', () => {
    const source = `
      export interface AbbreviationSet { match: string }
      export const ABBREVIATIONS: AbbreviationsType = {
        Hopkins: { match: "TERM", items: { "n.": "noun" } }
      };
    `;
    expect(parseAbbreviations(source)).toEqual({
      Hopkins: { match: 'TERM', items: { 'n.': 'noun' } },
    });
  });
});

describe('remapKeys', () => {
  it('should rename upstream keys to the local dictionary names', () => {
    const out = remapKeys(
      { GaengWetzel: { label: 'G' }, JongbokYi: { label: 'J' } },
      ['38-Gaeng,Wetzel']
    );
    expect(Object.keys(out)).toEqual(['Gaeng,Wetzel', 'JongbokYi']);
  });
});

describe('diffDetails', () => {
  it('should report added, removed and changed keys', () => {
    const before = { a: { x: 1 }, b: { x: 1 }, c: { x: 1 } };
    const after = { a: { x: 1 }, b: { x: 2 }, d: { x: 1 } };
    expect(diffDetails(before, after)).toEqual({
      added: ['d'],
      removed: ['c'],
      changed: ['b'],
    });
  });
});

describe('applyOverrides', () => {
  it('should drop a field when its override is undefined', () => {
    const out = applyOverrides(
      { Scan: { label: 'Scan', webOnly: true } },
      { Scan: { webOnly: undefined } }
    );
    expect(out.Scan).toEqual({ label: 'Scan' });
  });

  it('should set a field when its override has a value', () => {
    const out = applyOverrides({ A: { label: 'A' } }, { A: { label: 'Ours' } });
    expect(out.A.label).toBe('Ours');
  });

  it('should ignore overrides for dictionaries that are not present', () => {
    expect(applyOverrides({ A: {} }, { Missing: { x: 1 } })).toEqual({ A: {} });
  });

  it('should not mutate its input', () => {
    const input = { A: { webOnly: true } };
    applyOverrides(input, { A: { webOnly: undefined } });
    expect(input.A.webOnly).toBe(true);
  });
});

describe('isIgnored', () => {
  it('should match an ignored dictionary by canonical name', () => {
    expect(isIgnored('01-JongbokYi', ['JongbokYi'])).toBe(true);
  });

  it('should not match a dictionary that is not listed', () => {
    expect(isIgnored('01-Hopkins2015', ['JongbokYi'])).toBe(false);
  });
});

describe('KEYWORDS', () => {
  const details = new Function(
    readFileSync('src/services/dictionaries-details.js', 'utf8').replace(
      'export default',
      'return'
    )
  )();
  const packed = Object.values(PACK_DEFINITIONS).flatMap((p) => p.dictionaries);

  it('should only name dictionaries that exist', () => {
    expect(Object.keys(KEYWORDS).filter((name) => !details[name])).toEqual([]);
  });

  it('should tag every dictionary that ships in a pack', () => {
    expect(packed.filter((name) => !KEYWORDS[name]?.length)).toEqual([]);
  });
});

describe('mergeOverrides', () => {
  it('should keep both sets of fields when a dictionary appears in each', () => {
    const merged = mergeOverrides(
      { Scan: { webOnly: undefined } },
      { Scan: { keywords: ['scan'] }, Other: { keywords: ['x'] } }
    );
    expect(Object.keys(merged.Scan)).toEqual(['webOnly', 'keywords']);
    expect(merged.Other).toEqual({ keywords: ['x'] });
  });
});
