/**
 * The production build does not keep the reset's stylesheet first: the chunk
 * holding the src/ui styles (shared with the quick-lookup window) loads before
 * main.css, which holds the reset. A reset rule on `[type="button"]` then ties
 * with `.ui-button--solid` and wins by coming last, painting button text in
 * the page ink. Reset rules must therefore never compete with a class.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '../src/css/reset.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Top-level rules only; the @supports block holds element selectors
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, prelude, body]) => ({
  // Split on the commas of the list, not those inside :where(...)
  selectors: prelude.trim().split(/,(?![^(]*\))/).map((s) => s.trim()),
  body,
}));

// An attribute selector outside :where(...) weighs as much as a class
function hasBareAttribute(selector) {
  return /\[/.test(selector.replace(/:where\([^)]*\)/g, ''));
}

describe('reset.css', () => {
  it('should leave the colour of buttons to the components, whatever the stylesheet order', () => {
    const offending = rules
      .filter((rule) => /(^|;|\s)(color|cursor|outline-offset)\s*:/.test(rule.body))
      .flatMap((rule) => rule.selectors)
      .filter(hasBareAttribute);
    expect(offending).toEqual([]);
  });

  it('should keep [hidden] strong enough to hide what a class displays', () => {
    const hidden = rules.find((rule) => rule.selectors.includes('[hidden]'));
    expect(hidden?.body).toContain('display: none');
  });
});
