/**
 * Dictionary Pack Definitions
 *
 * Each pack contains a list of dictionary names (without the numeric prefix).
 * The dictionary name must match the folder name after removing the prefix (e.g., "01-Hopkins2015" -> "Hopkins2015")
 */

export const PACK_DEFINITIONS = {
  core: {
    id: 'core',
    name: 'Core Dictionaries',
    description: 'Essential Tibetan-English dictionaries for translation',
    required: true,
    dictionaries: [
      // Major comprehensive dictionaries
      'Hopkins2015',
      'RangjungYeshe',
      'JimValby',
      'IvesWaldo',
      'DanMartin',
      'TsepakRigdzin',
      'RichardBarron',

      // Berzin
      'Berzin',
      'Berzin-Def',

      // Hopkins supplements (English)
      'Hackett-Def2015',
      'Hopkins-Def2015',
      'Hopkins-Comment',
      'Hopkins-Divisions2015',
      'Hopkins-Examples',
      'Hopkins-Synonyms1992',
      "Hopkins-others'English2015",

      // Verb dictionary
      'Verbinator',

      // Learning resources
      'hotl1',
      'hotl2',
      'hotl3',
      'tibetanlanguage-school',
      'Bialek',

      // 84000 project
      '84000Dict',
      '84000Definitions',

      // Other English resources
      'ThomasDoctor',
      'GatewayToKnowledge',
      'Gaeng,Wetzel',
      'CommonTerms-Lin',
      'ComputerTerms',
      'Misc',

      // Multi-language with English
      'ITLR',
      'sgra_bye_brag_tu_rtogs_byed_chen_mo',

      // Scanned dictionaries (Tibetan-English)
      'Jaeschke_Scan',
      'ChandraDas_Scan',

      // Multilingual glossary
      'PadmakaraGlossary',
    ]
  },

  'tibetan-monolingual': {
    id: 'tibetan-monolingual',
    name: 'Tibetan Monolingual',
    description: 'Tibetan-to-Tibetan dictionaries for advanced users',
    required: false,
    dictionaries: [
      // Major Tibetan encyclopedic dictionaries
      'tshig-mdzod-chen-mo-Tib',
      'dung-dkar-tshig-mdzod-chen-mo-Tib',
      'dag_tshig_gsar_bsgrigs-Tib',

      // Hopkins Tibetan supplements
      'Hopkins-Divisions,Tib2015',
      'Hopkins-Examples,Tib',
      'Hopkins-TibetanSynonyms1992',
      'Hopkins-TibetanSynonyms2015',
      'Hopkins-TibetanDefinitions2015',
      'Hopkins-TibetanTenses2015',

      // Tibetan terminology
      'TibTermProject',
      'LaineAbbreviations',
      'Sera-Textbook-Definitions',
      '84000Synonyms',

      // Additional Tibetan dictionaries
      'bod_rgya_nang_don_rig_pai_tshig_mdzod',
      'brda_dkrol_gser_gyi_me_long',
      'chos_rnam_kun_btus',
      'li_shii_gur_khang',
      'sgom_sde_tshig_mdzod_chen_mo',
      'sngas_rgyas_chos_gzhung_tshig_mdzod',
      'gangs_can_mkhas_grub_rim_byon_ming_mdzod',
      'bod_yig_tshig_gter_rgya_mtsho',
    ]
  },

  'sanskrit-academic': {
    id: 'sanskrit-academic',
    name: 'Sanskrit & Academic',
    description: 'Sanskrit dictionaries and academic reference works',
    required: false,
    dictionaries: [
      // Sanskrit dictionaries
      'Hopkins-Skt1992',
      'Hopkins-Skt2015',
      'Mahavyutpatti-Skt',
      'Yoghacharabhumi-glossary',
      '84000Skt',
      'LokeshChandraSkt',
      'NegiSkt',

      // Scanned Sanskrit references
      'Mahavyutpatti-Scan-1989',
      'sgra-sbyor-bam-po-gnyis-pa',
    ]
  }
};

// Helper to get all dictionary names across all packs
export function getAllDictionaryNames() {
  const allNames = new Set();
  for (const pack of Object.values(PACK_DEFINITIONS)) {
    for (const name of pack.dictionaries) {
      allNames.add(name);
    }
  }
  return Array.from(allNames);
}

// Helper to find which pack a dictionary belongs to
export function getPackForDictionary(dictionaryName) {
  for (const [packId, pack] of Object.entries(PACK_DEFINITIONS)) {
    if (pack.dictionaries.includes(dictionaryName)) {
      return packId;
    }
  }
  return null;
}

export default PACK_DEFINITIONS;
