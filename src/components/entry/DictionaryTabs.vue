<script>
import { UiMenu } from '../../ui';

// The dictionaries that have the term, as tabs: `All · N`, then as many
// dictionaries as fit the width, then More… (a menu with the rest). Choosing
// one filters the definitions; `modelValue` is its id, null for All.
//
// What fits is measured: a hidden copy of every tab sits beside the real ones
// and its widths are compared with the width of the row, again whenever the
// row resizes or the dictionaries change. A row that has no width (not laid
// out yet) shows every tab.
export default {
  name: 'DictionaryTabs',
  components: { UiMenu },
  props: {
    // [{ id, label (HTML, short name), text (plain, for the menu) }]
    dictionaries: { type: Array, default: () => [] },
    modelValue: { default: null },
    total: { type: Number, default: 0 }
  },
  emits: ['update:modelValue'],
  data() {
    return { fitCount: null };
  },
  computed: {
    visible() {
      return this.fitCount === null ? this.dictionaries : this.dictionaries.slice(0, this.fitCount);
    },
    hidden() {
      return this.fitCount === null ? [] : this.dictionaries.slice(this.fitCount);
    },
    moreItems() {
      return this.hidden.map((dictionary) => ({
        key: `dict-${dictionary.id}`,
        label: dictionary.text,
        icon: dictionary.id === this.modelValue ? 'check' : undefined,
        dictionary
      }));
    },
    moreIsActive() {
      return this.hidden.some((dictionary) => dictionary.id === this.modelValue);
    }
  },
  watch: {
    dictionaries: {
      deep: true,
      handler() {
        this.fitCount = null;
        this.$nextTick(() => this.measure());
      }
    }
  },
  mounted() {
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this._observer = new ResizeObserver(() => this.measure());
      this._observer.observe(this.$refs.root);
    }
  },
  beforeUnmount() {
    this._observer?.disconnect();
  },
  methods: {
    choose(id) {
      this.$emit('update:modelValue', id);
    },
    measure() {
      const root = this.$refs.root;
      const ruler = this.$refs.ruler;
      if (!root || !ruler) return;
      const available = root.clientWidth;
      const widths = [...ruler.children].map((el) => el.offsetWidth);
      // The ruler holds All, each dictionary, then More…
      const [allWidth, ...rest] = widths;
      const moreWidth = rest.pop() || 0;
      if (!available || widths.length < 2) {
        this.fitCount = this.dictionaries.length;
        return;
      }
      const gap = parseFloat(getComputedStyle(root).columnGap) || 0;
      const everything = allWidth + rest.reduce((sum, width) => sum + gap + width, 0);
      if (everything <= available) {
        this.fitCount = this.dictionaries.length;
        return;
      }
      let used = allWidth + gap + moreWidth;
      let count = 0;
      for (const width of rest) {
        if (used + gap + width > available) break;
        used += gap + width;
        count += 1;
      }
      this.fitCount = count;
    }
  }
};
</script>

<template>
  <div ref="root" class="dict-tabs" role="tablist" aria-label="Dictionaries" data-testid="entry-tabs">
    <button
      type="button"
      role="tab"
      class="dict-tab"
      :class="{ 'is-active': modelValue === null }"
      :aria-selected="modelValue === null"
      data-testid="entry-tab-all"
      @click="choose(null)"
    >All · {{ total }}</button>
    <button
      v-for="dictionary in visible"
      :key="dictionary.id"
      type="button"
      role="tab"
      class="dict-tab"
      :class="{ 'is-active': modelValue === dictionary.id }"
      :aria-selected="modelValue === dictionary.id"
      data-testid="entry-tab"
      @click="choose(dictionary.id)"
      v-html="dictionary.label"
    />
    <ui-menu v-if="hidden.length" :items="moreItems" align="end" @select="choose($event.dictionary.id)">
      <button
        type="button"
        class="dict-tab"
        :class="{ 'is-active': moreIsActive }"
        data-testid="entry-tabs-more"
      >More…</button>
    </ui-menu>

    <!-- Hidden twin of every tab, to measure -->
    <div ref="ruler" class="dict-tabs__ruler" aria-hidden="true">
      <span class="dict-tab">All · {{ total }}</span>
      <span v-for="dictionary in dictionaries" :key="dictionary.id" class="dict-tab" v-html="dictionary.label" />
      <span class="dict-tab">More…</span>
    </div>
  </div>
</template>

<style scoped>
.dict-tabs {
  position: relative;
  display: flex;
  column-gap: 2px;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--line-soft);
  overflow: hidden;
}
.dict-tab {
  flex: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  min-height: 1.875rem;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink);
  font: 500 var(--text-sm) / 1 var(--font-ui);
  white-space: nowrap;
  cursor: pointer;
}
button.dict-tab:hover {
  background: var(--soft);
}
button.dict-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.dict-tab.is-active,
button.dict-tab.is-active:hover {
  background: var(--ink);
  color: var(--bg);
}
.dict-tab :deep(.tibetan) {
  font-size: 1.15em;
}

.dict-tabs__ruler {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  column-gap: 2px;
  width: max-content;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

/* Phone: separate pills on the grouped ground */
@media (max-width: 600px) {
  .dict-tabs {
    column-gap: 6px;
    padding-bottom: 0;
    border-bottom: 0;
  }
  .dict-tabs__ruler {
    column-gap: 6px;
  }
  .dict-tab {
    min-height: 2rem;
    padding: 0 12px;
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  button.dict-tab:hover {
    background: var(--surface);
  }
}
</style>
