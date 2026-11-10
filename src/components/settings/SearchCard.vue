<script>
import Storage from '../../services/storage';
import { UiSelect } from '../../ui';
import SettingsCard from './SettingsCard.vue';

// UiSelect values are strings; the stored preference is a number, or 'all'
export const DEFINITIONS_PER_TERM_OPTIONS = [
  { value: '1', label: '1' },
  { value: '3', label: '3' },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: 'all', label: 'All' },
];

// How many definitions Search shows under each term before "N more in Define".
export default {
  name: 'SearchCard',
  components: { SettingsCard, UiSelect },
  data() {
    return {
      options: DEFINITIONS_PER_TERM_OPTIONS,
      definitionsPerTerm: String(Storage.get('searchDefinitionsPerTerm')),
    };
  },
  watch: {
    definitionsPerTerm(value) {
      Storage.set('searchDefinitionsPerTerm', value === 'all' ? 'all' : Number(value));
    },
  },
};
</script>

<template>
  <settings-card
    title="Search"
    subtitle="Every matching term is listed. This only sets how many of its definitions show at first; the rest stay one tap away in Define."
    class="search-card"
    data-testid="search-card"
  >
    <ui-select
      v-model="definitionsPerTerm"
      :options="options"
      label="Definitions per term in Search"
      class="search-card__select"
      data-testid="search-definitions-select"
    />
  </settings-card>
</template>

<style>
.search-card__select {
  max-width: 14rem;
}
</style>
