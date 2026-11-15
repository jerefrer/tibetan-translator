<script>
import Storage from '../../services/storage';
import { mayNeedLegacyRepair } from '../../services/legacy-to-unicode';
import { tibetanRuns } from '../../services/glosses';
import { UiCollapse, UiIcon, UiTextField } from '../../ui';
import SearchBuilder from '../SearchBuilder.vue';

// Search's field: a plain field (nothing converted; legacy fonts repaired on
// paste), how the query was read under it, and the query builder behind
// its button.
export default {
  name: 'SearchField',
  components: { SearchBuilder, UiCollapse, UiIcon, UiTextField },
  props: {
    modelValue: { type: String, default: '' },
    // How the query was read, e.g. "Terms whose definitions say “wisdom” · 5 terms"
    readAs: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'keydown', 'clear', 'submit'],
  data() {
    return {
      // Behind its button: closed until the user opens it; the choice is kept
      builderVisible: Storage.get('searchBuilderVisible') === true,
    };
  },
  computed: {
    // Tibetan and no Latin letter: shown in the Tibetan colour, as in Define
    tibetanOnly() {
      const query = this.modelValue || '';
      return /[\u0F00-\u0FFF]/.test(query) && !/[A-Za-z]/.test(query);
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
    // The field converts nothing, so a paste in a pre-Unicode Tibetan font is
    // repaired and every other paste is left to the browser
    async onPaste(event) {
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
  <div class="search-field">
    <ui-text-field
      ref="input"
      :model-value="modelValue"
      class="search-field__input"
      :class="{ 'search-field__input--tibetan': tibetanOnly }"
      size="lg"
      placeholder="Search the definitions"
      aria-label="Search the definitions"
      enterkeyhint="search"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      autofocus
      clearable
      data-testid="search-field"
      @update:model-value="$emit('update:modelValue', $event)"
      @keydown="$emit('keydown', $event)"
      @paste="onPaste"
      @clear="$emit('clear')"
    />

    <div v-if="readAs" class="search-field__under" data-testid="search-read-as"><span class="search-field__read-as"><template v-for="(run, index) in tibetanRuns(readAs)" :key="index"><span v-if="run.tibetan" class="search-field__tibetan">{{ run.text }}</span><template v-else>{{ run.text }}</template></template></span></div>

    <!-- Gives way to the builder, which has its own Hide: one folds as the
         other unfolds, in one movement -->
    <ui-collapse>
      <div v-if="!builderVisible" class="search-field__under search-field__under--end">
        <button
          type="button"
          class="search-field__advanced"
          data-testid="search-advanced"
          @click="builderVisible = true"
        >
          <ui-icon name="sliders-horizontal" :size="15" :stroke-width="2" />
          Query builder
        </button>
      </div>
    </ui-collapse>

    <SearchBuilder
      :model-value="modelValue"
      v-model:visible="builderVisible"
      @update:model-value="$emit('update:modelValue', $event)"
      @submit="$emit('submit')"
    />
  </div>
</template>

<style scoped>
.search-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Tibetan typed or pasted reads at the size of Define's, Latin around it at
   the field's own; a query in Tibetan alone is in the Tibetan colour */
.search-field__input :deep(.ui-field__input) {
  font-family: var(--font-ui-tibetan);
}
.search-field__input--tibetan :deep(.ui-field__input) {
  color: var(--rubric);
}

.search-field__under {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  padding: 0 var(--space-1);
  font-size: var(--text-sm);
  color: var(--muted);
}

.search-field__under--end {
  justify-content: flex-end;
}

.search-field__tibetan {
  font-family: var(--font-tibetan);
  font-size: 1.15em;
  line-height: 1;
  color: var(--rubric);
}

.search-field__advanced {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: 500 var(--text-sm) var(--font-ui);
  cursor: pointer;
}
</style>
