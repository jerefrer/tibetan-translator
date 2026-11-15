/**
 * "A new look": the card Define's home shows once to people who used the app
 * before the redesign. `newLook` in Storage is 'pending' (to show), 'seen'
 * (dismissed, or a new user who has nothing to compare with), or absent
 * (not recorded yet).
 */

import Storage from './storage';
import { recentTerms } from './history';
import { savedTerms } from './saved-terms';

// Must run before the app writes anything of its own, or a first launch
// would look like a return.
export function recordReturningUser() {
  if (Storage.get('newLook') !== null) return;
  const returning =
    Storage.get('onboardingComplete') ||
    Storage.get('autoFillWords') !== null ||
    Storage.get('dictionaries') !== null ||
    recentTerms().length > 0 ||
    savedTerms().length > 0;
  Storage.set('newLook', returning ? 'pending' : 'seen');
}

export const newLookPending = () => Storage.get('newLook') === 'pending';

export const dismissNewLook = () => Storage.set('newLook', 'seen');
