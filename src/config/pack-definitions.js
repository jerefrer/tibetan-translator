/**
 * Dictionary Pack Definitions (Frontend)
 *
 * This mirrors the build config and provides pack metadata for the UI
 */

/**
 * Schema version this app supports
 * Must match the schemaVersion in pack-manifest.json
 * Bump this when database structure changes require app updates
 */
export const SUPPORTED_SCHEMA_VERSION = 1;

export const PACK_DEFINITIONS = {
  core: {
    id: 'core',
    name: 'Core Dictionaries',
    description: 'All Tibetan-English dictionaries',
    required: true,
    included: true, // Bundled with the app
    icon: 'mdi-book-open-variant',
    estimatedSize: '146 MB installed',
    dictionaries: [
      'Hopkins2015',
      'RangjungYeshe',
      'JimValby',
      'IvesWaldo',
      'DanMartin',
      'TsepakRigdzin',
      'RichardBarron',
      'Berzin',
      'Berzin-Def',
      'Hackett-Def2015',
      'Hopkins-Def2015',
      'Hopkins-Comment',
      'Hopkins-Divisions2015',
      'Hopkins-Examples',
      'Hopkins-Synonyms1992',
      "Hopkins-others'English2015",
      'Verbinator',
      'hotl1',
      'hotl2',
      'hotl3',
      'tibetanlanguage-school',
      'Bialek',
      '84000Dict',
      '84000Definitions',
      'ThomasDoctor',
      'GatewayToKnowledge',
      'Gaeng,Wetzel',
      'CommonTerms-Lin',
      'ComputerTerms',
      'Misc',
      'ITLR',
      'sgra_bye_brag_tu_rtogs_byed_chen_mo',
      'Jaeschke_Scan',
      'ChandraDas_Scan',
    ],
  },

  'tibetan-monolingual': {
    id: 'tibetan-monolingual',
    name: 'Tibetan Monolingual',
    description: 'Tibetan-to-Tibetan dictionaries for advanced users',
    required: false,
    icon: 'tibetan-ka', // Special icon - Tibetan letter KA
    estimatedSize: '65 MB download, 285 MB installed',
    dictionaries: [
      'tshig-mdzod-chen-mo-Tib',
      'dung-dkar-tshig-mdzod-chen-mo-Tib',
      'dag_tshig_gsar_bsgrigs-Tib',
      'Hopkins-Divisions,Tib2015',
      'Hopkins-Examples,Tib',
      'Hopkins-TibetanSynonyms1992',
      'Hopkins-TibetanSynonyms2015',
      'Hopkins-TibetanDefinitions2015',
      'Hopkins-TibetanTenses2015',
      'TibTermProject',
      'LaineAbbreviations',
      'Sera-Textbook-Definitions',
      '84000Synonyms',
      'bod_rgya_nang_don_rig_pai_tshig_mdzod',
      'brda_dkrol_gser_gyi_me_long',
      'chos_rnam_kun_btus',
      'li_shii_gur_khang',
      'sgom_sde_tshig_mdzod_chen_mo',
      'sngas_rgyas_chos_gzhung_tshig_mdzod',
      'gangs_can_mkhas_grub_rim_byon_ming_mdzod',
      'bod_yig_tshig_gter_rgya_mtsho',
    ],
  },

  'sanskrit-academic': {
    id: 'sanskrit-academic',
    name: 'Sanskrit & Academic',
    description: 'Sanskrit dictionaries and academic reference works',
    required: false,
    icon: 'mdi-school',
    estimatedSize: '26 MB download, 109 MB installed',
    dictionaries: [
      'Hopkins-Skt1992',
      'Hopkins-Skt2015',
      'Mahavyutpatti-Skt',
      'Yoghacharabhumi-glossary',
      '84000Skt',
      'LokeshChandraSkt',
      'NegiSkt',
      'Mahavyutpatti-Scan-1989',
      'sgra-sbyor-bam-po-gnyis-pa',
    ],
  },
};

/**
 * Get pack definition by ID
 */
export function getPackDefinition(packId) {
  return PACK_DEFINITIONS[packId] || null;
}

/**
 * Get all pack definitions as an array
 */
export function getAllPackDefinitions() {
  return Object.values(PACK_DEFINITIONS);
}

/**
 * Get required pack IDs
 */
export function getRequiredPackIds() {
  return Object.entries(PACK_DEFINITIONS)
    .filter(([_, def]) => def.required)
    .map(([id, _]) => id);
}

/**
 * Get optional pack IDs
 */
export function getOptionalPackIds() {
  return Object.entries(PACK_DEFINITIONS)
    .filter(([_, def]) => !def.required)
    .map(([id, _]) => id);
}

export default PACK_DEFINITIONS;
