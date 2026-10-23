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
      // Read out politely after a move from the keyboard
      announcement: '',
      keysHintId: `dictionary-pref-keys-${this.$.uid}`,
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
    handleLabel(dictionary, index) {
      return `Move ${this.label(dictionary)}, position ${index + 1} of ${this.dictionaries.length}`;
    },
    // Alt+Up / Alt+Down on the focused handle: the keyboard way to drag
    onHandleKeydown(event, index) {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      const target = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (target < 0 || target >= this.dictionaries.length) return;
      const [dictionary] = this.dictionaries.splice(index, 1);
      this.dictionaries.splice(target, 0, dictionary);
      this.announcement = `${this.label(dictionary)} moved to position ${target + 1} of ${this.dictionaries.length}`;
      // The row was moved in the page: keep the focus on its handle
      this.$nextTick(() => {
        this.$el.querySelectorAll('.dictionary-pref__handle')[target]?.focus();
      });
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
          <span
            class="dictionary-pref__handle"
            role="button"
            tabindex="0"
            title="Drag to reorder, or Alt+Up / Alt+Down"
            :aria-label="handleLabel(dictionary, index)"
            :aria-describedby="keysHintId"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            data-testid="dictionary-pref-handle"
            @keydown="onHandleKeydown($event, index)"
          >
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
            :aria-label="label(dictionary)"
            class="dictionary-pref__switch"
            data-testid="dictionary-pref-switch"
          />
        </div>
      </template>
    </draggable>
    <span :id="keysHintId" class="ui-visually-hidden">Alt+Up or Alt+Down moves it up or down.</span>
    <div class="ui-visually-hidden" aria-live="polite" data-testid="dictionary-pref-announcement">{{ announcement }}</div>
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
  border-radius: var(--radius-sm);
}
.dictionary-pref__handle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
