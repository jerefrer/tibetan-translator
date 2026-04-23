import { describe, it, expect } from 'vitest';
import { normalizeEntries } from '../build/lib/normalize-entries.js';

describe('normalizeEntries', () => {
  describe('basic mapping and cleanup', () => {
    it('maps non-reversed notes [fr, tib] to { term: tib, definition: fr }', () => {
      const out = normalizeEntries([['je ; moi', 'ང་།']], { reversed: false });
      expect(out).toEqual([{ term: 'ང་', definition: 'je ; moi' }]);
    });

    it('maps reversed notes [tib, fr] to { term: tib, definition: fr }', () => {
      const out = normalizeEntries([['ང་།', 'je ; moi']], { reversed: true });
      expect(out).toEqual([{ term: 'ང་', definition: 'je ; moi' }]);
    });

    it('strips trailing shads (།, ༑, ༔) from the term', () => {
      const out = normalizeEntries(
        [
          ['je', 'ང་།'],
          ['tu', 'ཁྱེད་རང་།'],
          ['école', 'སློབ་གྲྭ།'],
        ],
        { reversed: false }
      );
      expect(out.map((e) => e.term)).toEqual(['ང་', 'ཁྱེད་རང་', 'སློབ་གྲྭ་']);
    });

    it('replaces <br> and <br/> with newlines', () => {
      const out = normalizeEntries([['line1<br>line2<br/>line3', 'ང་']], { reversed: false });
      expect(out[0].definition).toBe('line1\nline2\nline3');
    });

    it('strips any HTML tags', () => {
      const out = normalizeEntries(
        [['<b>bold</b> <i>and</i> <span style="color:red">red</span>', 'ང་']],
        { reversed: false }
      );
      expect(out[0].definition).toBe('bold and red');
    });

    it('decodes HTML entities', () => {
      const out = normalizeEntries([['&nbsp;hello&amp;world&lt;&gt;&quot;&#39;', 'ང་']], { reversed: false });
      expect(out[0].definition).toBe('hello&world<>"\'');
    });

    it('trims surrounding whitespace', () => {
      const out = normalizeEntries([['   spaced   ', '   ང་   ']], { reversed: false });
      expect(out[0]).toEqual({ term: 'ང་', definition: 'spaced' });
    });

    it('skips entries with no Tibetan letters in either field', () => {
      const out = normalizeEntries([['fr', ''], ['fr', '   ']], { reversed: false });
      expect(out).toEqual([]);
    });

    it('deduplicates exact (term, definition) pairs', () => {
      const out = normalizeEntries(
        [
          ['je', 'ང་'],
          ['je', 'ང་'],
          ['moi', 'ང་'],
        ],
        { reversed: false }
      );
      expect(out).toHaveLength(2);
    });
  });

  describe('auto-flip of inverted entries', () => {
    it('swaps fields when Tibetan is in the fr position and French in the tib position', () => {
      const out = normalizeEntries(
        [['གུང་སྐྱིད་', 'vacances']],
        { reversed: false }
      );
      expect(out).toEqual([{ term: 'གུང་སྐྱིད་', definition: 'vacances' }]);
    });

    it('does not flip when both fields have Tibetan', () => {
      const out = normalizeEntries(
        [['ང་', 'ཁྱེད་རང་']],
        { reversed: false }
      );
      expect(out).toEqual([{ term: 'ཁྱེད་རང་', definition: 'ང་' }]);
    });
  });

  describe('grammar patterns', () => {
    it('skips terms containing " + "', () => {
      const out = normalizeEntries([['aller', 'V + ཀར་ + འགྲོ་བ་']], { reversed: false });
      expect(out).toEqual([]);
    });

    it('skips "V présent + ཐུབ་པ་"', () => {
      const out = normalizeEntries([['pouvoir', 'V présent + ཐུབ་པ་']], { reversed: false });
      expect(out).toEqual([]);
    });
  });

  describe('annotations', () => {
    it('moves register tag (H) from term to end of definition', () => {
      const out = normalizeEntries([['venir', 'ཕེབས་པ་ (H)']], { reversed: false });
      expect(out).toEqual([{ term: 'ཕེབས་པ་', definition: 'venir (H)' }]);
    });

    it('applies the register tag to all alternatives when there are several terms', () => {
      const out = normalizeEntries([['père', 'པ་ཕ་   པཱ་ལགས་ (H)']], { reversed: false });
      expect(out).toEqual([
        { term: 'པ་ཕ་', definition: 'père (H)' },
        { term: 'པཱ་ལགས་', definition: 'père (H)' },
      ]);
    });

    it('moves multi-character phonetic annotation from term to definition', () => {
      const out = normalizeEntries([['enfant', 'ཕྲུ་གུ་ (phugu)']], { reversed: false });
      expect(out).toEqual([{ term: 'ཕྲུ་གུ་', definition: 'enfant (phugu)' }]);
    });

    it('moves slash-delimited phonetic /bètte/ from term to definition', () => {
      const out = normalizeEntries([['Complètement', 'རྦད་དེ་   /bètte/']], { reversed: false });
      expect(out).toEqual([{ term: 'རྦད་དེ་', definition: 'Complètement /bètte/' }]);
    });

    it('keeps annotations appended even when the French is empty', () => {
      const out = normalizeEntries([['', 'ཕེབས་པ་ (H)']], { reversed: false });
      expect(out).toEqual([{ term: 'ཕེབས་པ་', definition: '(H)' }]);
    });
  });

  describe('space-separated alternatives', () => {
    it('produces one entry per Tibetan alternative', () => {
      const out = normalizeEntries(
        [["l'an prochain", 'དུས་སང་   ལོ་རྗེས་མ་']],
        { reversed: false }
      );
      expect(out).toEqual([
        { term: 'དུས་སང་', definition: "l'an prochain" },
        { term: 'ལོ་རྗེས་མ་', definition: "l'an prochain" },
      ]);
    });

    it('supports three alternatives', () => {
      const out = normalizeEntries(
        [['Potala', 'པོ་ཏ་ལ་  རྩེ་པོ་ཏ་ལ་  རྩེ་ཕོ་བྲང་']],
        { reversed: false }
      );
      expect(out.map((e) => e.term)).toEqual(['པོ་ཏ་ལ་', 'རྩེ་པོ་ཏ་ལ་', 'རྩེ་ཕོ་བྲང་']);
    });
  });

  describe('optional parens ༼...༽', () => {
    it('generates both variants for a middle optional part', () => {
      const out = normalizeEntries([['manger', '༼ཁ་ལག་༽ཟ་བ་']], { reversed: false });
      expect(out.map((e) => e.term).sort()).toEqual(['ཁ་ལག་ཟ་བ་', 'ཟ་བ་'].sort());
    });

    it('cartesian expansion with "/" inside the parens', () => {
      const out = normalizeEntries(
        [['ouvrir (une porte/une boite)', '༼སྒོ་/ཁ་༽ཕྱེ་བ་']],
        { reversed: false }
      );
      expect(out.map((e) => e.term).sort()).toEqual(
        ['སྒོ་ཕྱེ་བ་', 'ཁ་ཕྱེ་བ་', 'ཕྱེ་བ་'].sort()
      );
    });

    it('drops "(…)" placeholder at start', () => {
      const out = normalizeEntries(
        [['que veut dire …', '༼་་་༽ཟེར་ན་ག་རེ་རེད་']],
        { reversed: false }
      );
      expect(out.map((e) => e.term)).toEqual(['ཟེར་ན་ག་རེ་རེད་']);
    });

    it('drops "(…)" placeholder at end', () => {
      const out = normalizeEntries(
        [['Drepung', 'འབྲས་སྤུངས་༼་་་༽']],
        { reversed: false }
      );
      expect(out.map((e) => e.term)).toEqual(['འབྲས་སྤུངས་']);
    });

    it('keeps "(…)" placeholder when it sits between two Tibetan parts', () => {
      const out = normalizeEntries(
        [['professeur ...', 'རྒན་༼་་་༽ལགས།']],
        { reversed: false }
      );
      // Trailing shad is stripped as usual; the placeholder itself is preserved.
      expect(out.map((e) => e.term)).toEqual(['རྒན་༼་་་༽ལགས་']);
    });

    it('collapses consecutive tshegs when an optional middle is removed', () => {
      // Source has a trailing tsheg after the closing paren — dropping the optional
      // inside should yield a single tsheg at the end, not two in a row.
      const out = normalizeEntries([['Drepung', 'འབྲས་སྤུངས་༼དགོན་པ།༽་']], { reversed: false });
      expect(out.map((e) => e.term).sort()).toEqual(
        ['འབྲས་སྤུངས་', 'འབྲས་སྤུངས་དགོན་པ་'].sort()
      );
    });

    it('combines space-alternatives with optional parens', () => {
      const out = normalizeEntries(
        [['après', 'རྗེས་༼ལ༽།   གཞུག་༼ལ༽།   གཞུག་གུ༼ར༽།']],
        { reversed: false }
      );
      // Tsheg-before-shad is the convention used throughout the app's existing packs
      // (see ང་, ཁྱེད་རང་, etc.) so we preserve it when removing the optional part.
      expect(out.map((e) => e.term).sort()).toEqual(
        ['རྗེས་ལ་', 'རྗེས་', 'གཞུག་ལ་', 'གཞུག་', 'གཞུག་གུར་', 'གཞུག་གུ་'].sort()
      );
    });
  });
});
