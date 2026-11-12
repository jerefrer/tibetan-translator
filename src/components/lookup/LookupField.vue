<script>
import Storage from '../../services/storage';
import { mayNeedLegacyRepair } from '../../services/legacy-to-unicode';
import { tibetanRuns } from '../../services/glosses';
import { UiIcon, UiSegmented, UiTextField, UiTibetanField } from '../../ui';
import SearchBuilder from '../SearchBuilder.vue';

const MODE_OPTIONS = [
  { value: 'bo', label: 'བོད', ariaLabel: 'Tibetan', tibetan: true },
  { value: 'en', label: 'EN', ariaLabel: 'English' },
];

// Lookup's one field and its བོད / EN switch (boards ModeTibetan,
// ModeEnglish, UnifiedToggle).
// བོད: Define's Tibetan field, unchanged (Wylie converted on space, tsheg,
// Enter, paste and drop; legacy fonts repaired; a second tsheg refused), with
// the "typed …" echo under it on every screen size.
// EN: Search's plain field (no conversion; legacy fonts repaired on paste),
// with today's query builder behind Advanced.
export default {
  name: 'LookupField',
  components: { SearchBuilder, UiIcon, UiSegmented, UiTextField, UiTibetanField },
  props: {
    mode: { type: String, default: 'bo' },
    modelValue: { type: String, default: '' },
    typedWylie: { type: String, default: '' },
    // How the input was read, e.g. "Wylie bcom → བཅོམ་ · 5 terms"
    readAs: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'update:mode', 'keydown', 'clear', 'submit'],
  data() {
    return {
      modeOptions: MODE_OPTIONS,
      // Behind Advanced: closed until the user opens it; the choice is kept
      builderVisible: Storage.get('searchBuilderVisible') === true,
    };
  },
  computed: {
    isTibetan() {
      return this.mode !== 'en';
    },
    showTyped() {
      return this.isTibetan && !!this.typedWylie;
    },
  },
  watch: {
    builderVisible(value) {
      Storage.set('searchBuilderVisible', value);
    },
  },
  methods: {
    tibetanRuns,
    focus() {
      this.$refs.input?.focus();
    },
    toggleBuilder() {
      this.builderVisible = !this.builderVisible;
    },
    // As SearchPage.onPaste: the English field converts nothing, so a paste
    // in a pre-Unicode Tibetan font is repaired and every other paste is
    // left to the browser
    async onEnglishPaste(event) {
      const clipboard = {
        text: event.clipboardData?.getData('text/plain') || '',
        html: event.clipboardData?.getData('text/html') || '',
      };
      if (!mayNeedLegacyRepair(clipboard)) return;

      event.preventDefault();
      const input = event.target;
      const start = input.selectionStart ?? this.modelValue.length;
      const end = input.selectionEnd ?? this.modelValue.length;
      const current = this.modelValue || '';

      const { repairPasteInto } = await import('../../services/legacy-to-unicode');
      const result = (await repairPasteInto(clipboard, { value: current, start, end })) || {
        value: current.substring(0, start) + clipboard.text + current.substring(end),
        caret: start + clipboard.text.length,
      };
      this.$emit('update:modelValue', result.value);
      this.$nextTick(() => input.setSelectionRange?.(result.caret, result.caret));
    },
  },
};
</script>

<template>
  <div class="lookup-field" :class="{ 'is-tibetan': isTibetan }">
    <div class="lookup-field__row">
      <ui-tibetan-field
        v-if="isTibetan"
        ref="input"
        :model-value="modelValue"
        class="lookup-field__input"
        prepend-icon="search"
        placeholder="Type Tibetan or Wylie"
        aria-label="Term to look up"
        enterkeyhint="search"
        autofocus
        clearable
        data-testid="lookup-field"
        @update:model-value="$emit('update:modelValue', $event)"
        @keydown="$emit('keydown', $event)"
        @clear="$emit('clear')"
      />
      <ui-text-field
        v-else
        ref="input"
        :model-value="modelValue"
        class="lookup-field__input"
        prepend-icon="search"
        placeholder="Search the definitions"
        aria-label="Search the definitions"
        enterkeyhint="search"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        autofocus
        clearable
        data-testid="lookup-field"
        @update:model-value="$emit('update:modelValue', $event)"
        @keydown="$emit('keydown', $event)"
        @paste="onEnglishPaste"
        @clear="$emit('clear')"
      />
      <ui-segmented
        :model-value="mode"
        :options="modeOptions"
        label="Typing"
        data-testid="lookup-mode"
        @update:model-value="$emit('update:mode', $event)"
      />
    </div>

    <div v-if="showTyped || readAs || !isTibetan" class="lookup-field__under">
      <span v-if="showTyped" class="lookup-field__typed" data-testid="lookup-typed">typed <b>{{ typedWylie }}</b></span>
      <span v-if="readAs" class="lookup-field__read-as" data-testid="lookup-read-as"><template v-for="(run, index) in tibetanRuns(readAs)" :key="index"><span v-if="run.tibetan" class="lookup-field__tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span>
      <button
        v-if="!isTibetan"
        type="button"
        class="lookup-field__advanced"
        :aria-expanded="builderVisible ? 'true' : 'false'"
        data-testid="lookup-advanced"
        @click="toggleBuilder"
      >
        <ui-icon name="sliders-horizontal" :size="15" :stroke-width="2" />
        Advanced
      </button>
    </div>

    <SearchBuilder
      v-if="!isTibetan"
      :model-value="modelValue"
      v-model:visible="builderVisible"
      @update:model-value="$emit('update:modelValue', $event)"
      @submit="$emit('submit')"
    />
  </div>
</template>

<style scoped>
.lookup-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lookup-field__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.lookup-field__input {
  flex: 1;
  min-width: 0;
}

.lookup-field.is-tibetan .lookup-field__input :deep(.ui-field__input) {
  color: var(--rubric);
}

/* Empty, the Tibetan field reads like an ordinary one */
.lookup-field__input :deep(.ui-field__input:placeholder-shown) {
  font: var(--text-md) var(--font-ui);
}

.lookup-field__under {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  padding: 0 var(--space-1);
  font-size: var(--text-sm);
  color: var(--muted);
}

.lookup-field__typed b {
  font-weight: 600;
  color: var(--ink);
}

.lookup-field__tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
  color: var(--rubric);
}

.lookup-field__advanced {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: 500 var(--text-sm) var(--font-ui);
  cursor: pointer;
}
</style>
