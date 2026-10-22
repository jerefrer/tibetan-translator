/**
 * Subject tags for the dictionary catalog, so a dictionary can be found by what
 * it is for ("archaic", "spelling", "verbs") and not only by its title.
 *
 * Upstream has no such field, so the sync merges these in as the `keywords`
 * detail. Each tag is drawn from the dictionary's own description. Keep tags
 * lowercase unless they are proper names or terms, and prefer a few accurate
 * ones over many vague ones.
 */

const KEYWORDS = {
  // Core
  'Hopkins2015': ['comprehensive', 'Sanskrit equivalents'],
  'RangjungYeshe': ['comprehensive', 'Dharma terms'],
  'JimValby': ['translator glossary', 'Dharma terms'],
  'IvesWaldo': ['translator glossary', 'Dharma terms'],
  'DanMartin': ['archaic', 'obsolete usages', 'word index'],
  'TsepakRigdzin': ['Buddhist terms'],
  'RichardBarron': ['translator glossary', 'Dharma terms'],
  'Berzin': ['glossary', 'Sanskrit equivalents'],
  'Berzin-Def': ['definitions'],
  'Hackett-Def2015': ['definitions'],
  'Hopkins-Def2015': ['definitions'],
  'Hopkins-Comment': ['comments'],
  'Hopkins-Divisions2015': ['divisions', 'enumerations'],
  'Hopkins-Examples': ['examples'],
  'Hopkins-Synonyms1992': ['synonyms'],
  "Hopkins-others'English2015": ['English glosses'],
  'Verbinator': ['verbs', 'verb stems', 'conjugation', 'tenses'],
  'hotl1': ['learning', 'audio', 'textbook vocabulary'],
  'hotl2': ['learning', 'audio', 'textbook vocabulary'],
  'hotl3': ['learning', 'audio', 'textbook vocabulary'],
  'tibetanlanguage-school': ['learning', 'colloquial'],
  'Bialek': ['learning', 'classical Tibetan', 'textbook vocabulary'],
  '84000Dict': ['translation terminology', '84000'],
  '84000Definitions': ['definitions', '84000'],
  'ThomasDoctor': ['translator glossary'],
  'GatewayToKnowledge': ['glossary', 'Mipham'],
  'Gaeng,Wetzel': ['multilingual', 'Buddhist terms'],
  'CommonTerms-Lin': ['multilingual', 'Chinese', 'Buddhist terms'],
  'ComputerTerms': ['modern terms', 'computing'],
  'Misc': ['miscellaneous'],
  'ITLR': ['Sanskrit headwords', 'scholarly'],
  'sgra_bye_brag_tu_rtogs_byed_chen_mo': ['Mahāvyutpatti', 'Chinese', 'translation terminology'],
  'Jaeschke_Scan': ['scan', 'historical', 'classical'],
  'ChandraDas_Scan': ['scan', 'historical', 'classical'],
  'PadmakaraGlossary': ['multilingual', 'French', 'Portuguese', 'Spanish', 'Italian', 'German', 'Polish', 'translation terminology'],

  // Tibetan monolingual
  'tshig-mdzod-chen-mo-Tib': ['comprehensive', 'Chinese'],
  'dung-dkar-tshig-mdzod-chen-mo-Tib': ['comprehensive', 'encyclopedic'],
  'dag_tshig_gsar_bsgrigs-Tib': ['spelling', 'orthography'],
  'Hopkins-Divisions,Tib2015': ['divisions', 'enumerations'],
  'Hopkins-Examples,Tib': ['examples'],
  'Hopkins-TibetanSynonyms1992': ['synonyms'],
  'Hopkins-TibetanSynonyms2015': ['synonyms'],
  'Hopkins-TibetanDefinitions2015': ['definitions'],
  'Hopkins-TibetanTenses2015': ['verbs', 'tenses', 'conjugation'],
  'TibTermProject': ['standardised terms', 'terminology'],
  'LaineAbbreviations': ['abbreviations', 'contractions'],
  'Sera-Textbook-Definitions': ['definitions', 'Sera', 'debate textbooks'],
  '84000Synonyms': ['synonyms', '84000'],
  'bod_rgya_nang_don_rig_pai_tshig_mdzod': ['Buddhist terms', 'Chinese'],
  'brda_dkrol_gser_gyi_me_long': ['archaic', 'rare words'],
  'chos_rnam_kun_btus': ['enumerations', 'Dharma terms'],
  'li_shii_gur_khang': ['archaic', 'old terminology', 'new terminology'],
  'sgom_sde_tshig_mdzod_chen_mo': ['comprehensive', 'Sera Jey'],
  'sngas_rgyas_chos_gzhung_tshig_mdzod': ['Buddhist terms', 'Chinese'],
  'gangs_can_mkhas_grub_rim_byon_ming_mdzod': ['biographies', 'scholars', 'names'],
  'bod_yig_tshig_gter_rgya_mtsho': ['comprehensive'],

  // Sanskrit and academic
  'Hopkins-Skt1992': ['Sanskrit equivalents'],
  'Hopkins-Skt2015': ['Sanskrit equivalents'],
  'Mahavyutpatti-Skt': ['Mahāvyutpatti', 'translation terminology'],
  'Yoghacharabhumi-glossary': ['Yogācārabhūmi', 'Mahāvyutpatti'],
  '84000Skt': ['Sanskrit equivalents', '84000'],
  'LokeshChandraSkt': ['Sanskrit equivalents'],
  'NegiSkt': ['comprehensive', 'Sanskrit equivalents'],
  'Mahavyutpatti-Scan-1989': ['Mahāvyutpatti', 'Mongolian', 'scan'],
  'sgra-sbyor-bam-po-gnyis-pa': ['archaic', 'old commentary', 'Mahāvyutpatti', 'scan'],
};

export { KEYWORDS };
