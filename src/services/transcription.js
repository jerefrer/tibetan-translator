import { EwtsConverter } from 'tibetan-ewts-converter';
import TibetanNormalizer from 'tibetan-normalizer';

import { phoneticsForWord } from '../utils';

const ewts = new EwtsConverter();

// EWTS of a Tibetan term, without the trailing tsheg's "/" or space.
export function wylieFor(tibetan) {
  return ewts.to_ewts(TibetanNormalizer.normalize(tibetan)).trim().replace(/[/\s]+$/, '');
}

// One-word phonetics of a term (བཅོམ་ལྡན་འདས་ -> a single run of letters).
export function phoneticsForTerm(tibetan) {
  return phoneticsForWord('default', tibetan).replace(/\s+/g, '');
}
