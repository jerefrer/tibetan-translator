<script>
import draggable from 'vuedraggable';

import Storage from '../../services/storage';
import DictionariesDetails from '../../services/dictionaries-details';
import { UiButton, UiIcon, UiSwitch } from '../../ui';
import SettingsCard from './SettingsCard.vue';

const LANGUAGE_NAMES = {
  tib: 'Tib',
  en: 'En',
  skt: 'Skt',
  zh: 'Zh',
  fr: 'Fr',
  pt: 'Pt',
  es: 'Es',
  it: 'It',
  de: 'De',
  pl: 'Pl',
};

/** "Tib ↔ En" from a details entry's language, e.g. ["tib", "<->", "en"]. */
export function languageLabel(details) {
  if (!details || !Array.isArray(details.language)) return '';
  return details.language
    .filter((part) => !['<->', '->', '<-'].includes(part))
    .map((code) => LANGUAGE_NAMES[code] || code)
    .join(' ↔ ');
}

function storedDictionaries() {
  return (Storage.get('dictionaries') || []).slice().sort((a, b) => a.position - b.position);
}

// The order dictionaries appear in results, and which ones are switched off.
// `bare` drops the card header, for the phone sub-screen that has its own.
export default {
  name: 'DictionaryPreferencesCard',
  components: { draggable, SettingsCard, UiButton, UiIcon, UiSwitch },
  inject: ['snackbar'],
  props: {
    bare: { type: Boolean, default: false },
  },
  data() {
    return {
      dictionaries: storedDictionaries(),
    };
  },
  watch: {
    dictionaries: {
      deep: true,
      handler(dictionaries) {
        Storage.set(
          'dictionaries',
          dictionaries.map((dictionary, index) => ({ ...dictionary, position: index + 1 }))
        );
      },
    },
  },
  created() {
    // After a pack is installed, updated or removed
    this.onDictionariesUpdated = () => {
      this.dictionaries = storedDictionaries();
    };
    window.addEventListener('dictionaries-updated', this.onDictionariesUpdated);
  },
  unmounted() {
    window.removeEventListener('dictionaries-updated', this.onDictionariesUpdated);
  },
  methods: {
    details(dictionary) {
      return DictionariesDetails[dictionary.name] || {};
    },
    label(dictionary) {
      return this.details(dictionary).label || dictionary.name;
    },
    languages(dictionary) {
      return languageLabel(this.details(dictionary));
    },
    showInfo(dictionary) {
      const scrollTop = document.documentElement.scrollTop || window.scrollY;
      const details = this.details(dictionary);
      if (!details.about) {
        this.snackbar.open(`<strong>${dictionary.name}</strong><br>No additional information available.`);
      } else {
        const aboutHtml = details.about.split('|').join('<br>');
        this.snackbar.open(`<strong>${details.label || dictionary.name}</strong><br><br>${aboutHtml}`);
      }
      // Blur the button so focus does not scroll the list, and keep the position
      document.activeElement?.blur?.();
      setTimeout(() => {
        document.documentElement.scrollTop = scrollTop;
        window.scrollTo(0, scrollTop);
      }, 0);
    },
  },
};
</script>

<template>
  <settings-card
    :title="bare ? '' : 'Dictionary preferences'"
    :subtitle="bare ? '' : 'Drag to reorder, switch off the ones you do not want'"
    class="dictionary-preferences"
    :class="{ 'dictionary-preferences--bare': bare }"
    data-testid="dictionary-preferences"
  >
    <draggable
      v-model="dictionaries"
      handle=".dictionary-pref__handle"
      item-key="id"
      class="dictionary-preferences__list"
      tag="div"
    >
      <template #item="{ element: dictionary, index }">
        <div
          class="dictionary-pref"
          :class="{ 'is-disabled': !dictionary.enabled }"
          data-testid="dictionary-pref"
        >
          <span class="dictionary-pref__handle" title="Drag to reorder" data-testid="dictionary-pref-handle">
            <ui-icon name="equal" :size="18" :stroke-width="2" />
          </span>
          <span class="dictionary-pref__index">{{ index + 1 }}.</span>
          <span class="dictionary-pref__name">
            {{ label(dictionary) }}
            <span v-if="languages(dictionary)" class="dictionary-pref__languages">
              ({{ languages(dictionary) }})
            </span>
          </span>
          <ui-button
            icon
            size="sm"
            variant="ghost"
            class="dictionary-pref__info"
            :aria-label="'About ' + label(dictionary)"
            data-testid="dictionary-pref-info"
            @click.stop.prevent="showInfo(dictionary)"
          >
            <ui-icon name="info" :size="17" />
          </ui-button>
          <ui-switch
            v-model="dictionary.enabled"
            class="dictionary-pref__switch"
            data-testid="dictionary-pref-switch"
          />
        </div>
      </template>
    </draggable>
  </settings-card>
</template>

<style>
.dictionary-preferences__list {
  display: flex;
  flex-direction: column;
}
/* Bare (phone sub-screen): the card holds only the rows */
.dictionary-preferences--bare.settings-card.ui-card {
  padding-top: 0;
  padding-bottom: 0;
}
.dictionary-preferences--bare .dictionary-pref:first-child {
  border-top: 0;
}
/* Mockup: 44px rows, a soft rule above each */
.dictionary-pref {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 2.75rem;
  border-top: 1px solid var(--soft);
  user-select: none;
  background: var(--surface);
}
.dictionary-pref__handle {
  flex: none;
  display: inline-flex;
  color: var(--faint);
  cursor: move;
  touch-action: none;
}
.dictionary-pref__index {
  flex: none;
  width: 1.375rem;
  font-size: var(--text-sm);
  color: var(--muted);
}
.dictionary-pref__name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-body);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s, opacity 0.3s;
}
.dictionary-pref__languages {
  font-size: var(--text-xs);
  color: var(--muted);
}
.dictionary-pref__info.ui-button--ghost {
  flex: none;
  color: var(--faint);
}
.dictionary-pref__info.ui-button--ghost:hover:not(:disabled) {
  color: var(--ink);
  background: var(--soft);
}
.dictionary-pref__switch {
  flex: none;
}
.dictionary-pref.is-disabled .dictionary-pref__name {
  color: var(--muted);
  opacity: 0.6;
}
.dictionary-pref.sortable-ghost {
  opacity: 0.4;
}
@media (max-width: 600px) {
  .dictionary-pref { gap: 10px; }
  .dictionary-pref__languages { display: none; }
}
</style>
