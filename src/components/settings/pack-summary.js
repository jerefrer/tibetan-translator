/**
 * Counts behind the "Dictionary packs" card and the phone's Dictionaries row:
 * how many packs are installed, out of how many, and how many dictionaries
 * those installed packs hold.
 */
import { PACK_DEFINITIONS, getRequiredPackIds, getOptionalPackIds } from '../../config/pack-definitions';

/** Every pack definition, required ones first, as the pack list shows them. */
export function orderedPackDefinitions() {
  return [...getRequiredPackIds(), ...getOptionalPackIds()]
    .map((id) => PACK_DEFINITIONS[id])
    .filter(Boolean);
}

export function isPackInstalled(definition, installedPackIds) {
  return !!definition.included || (installedPackIds || []).includes(definition.id);
}

/** { installed, total, dictionaries } for the given installed pack ids. */
export function packSummary(installedPackIds) {
  const packs = orderedPackDefinitions();
  const installed = packs.filter((pack) => isPackInstalled(pack, installedPackIds));
  return {
    installed: installed.length,
    total: packs.length,
    dictionaries: installed.reduce((sum, pack) => sum + (pack.dictionaries || []).length, 0),
  };
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
