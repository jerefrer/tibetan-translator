<script>
import SearchBuilderRow from './SearchBuilderRow.vue';

// Syntax definitions for each mode
const MODE_SYNTAX = {
  'contains': { prefix: '', suffix: '' },
  'wylie': { prefix: '(', suffix: ')' },
  'phonetic-strict': { prefix: '[', suffix: ']' },
  'phonetic-loose': { prefix: '{', suffix: '}' }
};

export default {
  components: {
    SearchBuilderRow
  },
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    visible: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue', 'update:visible', 'submit'],
  data() {
    return {
      rows: [{ term: '', mode: 'contains' }],
      isUpdatingFromText: false,
      isUpdatingFromRows: false
    };
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(newValue) {
        if (this.isUpdatingFromRows) return;
        this.isUpdatingFromText = true;
        this.parseQueryToRows(newValue);
        this.$nextTick(() => {
          this.isUpdatingFromText = false;
        });
      }
    },
    rows: {
      deep: true,
      handler() {
        if (this.isUpdatingFromText) return;
        this.isUpdatingFromRows = true;
        const query = this.rowsToQuery();
        this.$emit('update:modelValue', query);
        this.$nextTick(() => {
          this.isUpdatingFromRows = false;
        });
      }
    }
  },
  methods: {
    parseQueryToRows(query) {
      if (!query || !query.trim()) {
        this.rows = [{ term: '', mode: 'contains' }];
        return;
      }

      // Split by & and parse each term
      const terms = query.split('&').map(t => t.trim()).filter(t => t);

      if (terms.length === 0) {
        this.rows = [{ term: '', mode: 'contains' }];
        return;
      }

      this.rows = terms.map(term => this.parseTermToRow(term));
    },

    parseTermToRow(term) {
      // Check for phonetic strict: [term]
      const strictMatch = term.match(/^\[(.+)\]$/);
      if (strictMatch) {
        return { term: strictMatch[1], mode: 'phonetic-strict' };
      }

      // Check for phonetic loose: {term}
      const looseMatch = term.match(/^\{(.+)\}$/);
      if (looseMatch) {
        return { term: looseMatch[1], mode: 'phonetic-loose' };
      }

      // Check for wylie: (term)
      const wylieMatch = term.match(/^\((.+)\)$/);
      if (wylieMatch) {
        return { term: wylieMatch[1], mode: 'wylie' };
      }

      // Default: regular contains
      return { term: term, mode: 'contains' };
    },

    rowsToQuery() {
      const parts = this.rows
        .filter(row => row.term && row.term.trim())
        .map(row => {
          const syntax = MODE_SYNTAX[row.mode];
          return syntax.prefix + row.term.trim() + syntax.suffix;
        });

      return parts.join(' & ');
    },

    addRow() {
      this.rows.push({ term: '', mode: 'contains' });
    },

    removeRow(index) {
      if (this.rows.length > 1) {
        this.rows.splice(index, 1);
      } else {
        // If last row, just clear it
        this.rows[0] = { term: '', mode: 'contains' };
      }
    },

    updateRowTerm(index, term) {
      this.rows[index].term = term;
    },

    updateRowMode(index, mode) {
      this.rows[index].mode = mode;
    },

    hide() {
      this.$emit('update:visible', false);
    },

    handleSubmit() {
      this.$emit('submit');
    }
  }
};
</script>

<template>
  <v-expand-transition>
    <div v-if="visible" class="search-builder">
      <div class="search-builder-header">
        <span class="search-builder-title">Query Builder</span>
        <v-btn
          variant="text"
          size="small"
          color="grey"
          @click="hide"
        >
          Hide
        </v-btn>
      </div>

      <div class="search-builder-rows">
        <SearchBuilderRow
          v-for="(row, index) in rows"
          :key="index"
          :term="row.term"
          :mode="row.mode"
          :can-remove="rows.length > 1"
          @update:term="updateRowTerm(index, $event)"
          @update:mode="updateRowMode(index, $event)"
          @remove="removeRow(index)"
          @submit="handleSubmit"
        />
      </div>

      <div class="search-builder-actions">
        <v-btn
          variant="tonal"
          size="small"
          color="primary"
          @click="addRow"
        >
          <v-icon start size="small">mdi-plus</v-icon>
          Add condition
        </v-btn>
      </div>
    </div>
  </v-expand-transition>
</template>

<style scoped>
.search-builder {
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
  padding: 10px 16px;
  margin: 0;
  will-change: height;
  overflow: hidden;
}

.v-theme--dark .search-builder {
  background: #2a2a2a;
  border-bottom-color: #444;
}

.search-builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.search-builder-title {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
}

.v-theme--dark .search-builder-title {
  color: #999;
}

.search-builder-rows {
  margin-bottom: 8px;
}

.search-builder-actions {
  display: flex;
  justify-content: flex-end;
}

/* Mobile adjustments */
@media (max-width: 600px) {
  .search-builder {
    padding: 12px;
  }
}
</style>
