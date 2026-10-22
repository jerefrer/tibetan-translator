/**
 * Remembers the Wylie a user typed into a Tibetan field, so the Define page
 * can echo it ("typed ye shes") after the field has turned it into Tibetan.
 *
 * The field converts as you type: "ye" + space becomes "ཡེ་", then
 * "ཡེ་shes" + space becomes "ཡེ་ཤེས་". Each conversion is recognised as a
 * Tibetan prefix we already know the Wylie of, followed by a Latin tail.
 * Anything else (a paste, an edit in the middle, a term picked from the list)
 * forgets the Wylie, since it can no longer be told from what is shown.
 *
 * Pure functions over a small state object, so the page keeps the state.
 */

const LATIN_TAIL = /^([ༀ-࿿]*)([^ༀ-࿿]+)$/;
const HAS_NON_TIBETAN = /[^ༀ-࿿\s]/;

export function initialTypedWylie() {
  return { tibetan: '', wylie: '', pending: null };
}

const join = (before, after) => (before ? `${before} ${after}` : after);

/** The state after the field's value changed to `value`. */
export function nextTypedWylie(state, value) {
  if (!value) return initialTypedWylie();

  const tail = value.match(LATIN_TAIL);
  if (tail) {
    const [, prefix, latin] = tail;
    // The Wylie of the Tibetan before the tail is known (or there is none)
    const known = prefix === '' || (prefix === state.tibetan && !!state.wylie);
    const typed = latin.trim();
    return {
      ...state,
      pending: { prefix, wylie: known && typed ? join(prefix ? state.wylie : '', typed) : null },
    };
  }

  // Latin in the middle of Tibetan: an edit we cannot follow
  if (HAS_NON_TIBETAN.test(value)) return { ...state, pending: null };

  const pending = state.pending;
  if (pending && pending.wylie && value !== pending.prefix && value.startsWith(pending.prefix)) {
    return { tibetan: value, wylie: pending.wylie, pending: null };
  }
  if (value === state.tibetan) return { ...state, pending: null };
  return { tibetan: value, wylie: '', pending: null };
}

/** The Wylie to show for the field's current value, or ''. */
export function typedWylieFor(state, value) {
  return value && state.tibetan === value ? state.wylie : '';
}
