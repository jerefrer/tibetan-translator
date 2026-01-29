<script>
export default {
  props: {
    term: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'contains',
      validator: (v) => ['contains', 'wylie', 'phonetic-strict', 'phonetic-loose'].includes(v)
    },
    canRemove: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:term', 'update:mode', 'remove', 'submit'],
  data() {
    return {
      modes: [
        { value: 'contains', label: 'contains' },
        { value: 'wylie', label: 'contains (Wylie)' },
        { value: 'phonetic-strict', label: 'sounds precisely like' },
        { value: 'phonetic-loose', label: 'sounds more or less like' }
      ],
      isMobile: window.innerWidth <= 600
    };
  },
  computed: {
    localTerm: {
      get() { return this.term; },
      set(value) { this.$emit('update:term', value); }
    },
    localMode: {
      get() { return this.mode; },
      set(value) { this.$emit('update:mode', value); }
    },
    inputPlaceholder() {
      switch (this.mode) {
        case 'wylie': return 'sangs rgyas';
        case 'phonetic-strict': return 'sangye';
        case 'phonetic-loose': return 'sangye';
        default: return 'བོད་ཡིག་ or text';
      }
    }
  },
  methods: {
    handleResize() {
      this.isMobile = window.innerWidth <= 600;
    }
  },
  mounted() {
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }
};
</script>

<template>
  <div class="search-builder-row" :class="{ 'mobile': isMobile }">
    <div class="row-fields">
      <select v-model="localMode" class="mode-select">
        <option v-for="m in modes" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
      <div class="field-divider" />
      <input
        v-model="localTerm"
        type="text"
        :placeholder="inputPlaceholder"
        class="term-input tibetan"
        spellcheck="false"
        autocomplete="off"
        @keyup.enter="$emit('submit')"
      />
    </div>
    <v-btn
      v-if="canRemove"
      icon
      variant="text"
      size="small"
      color="grey"
      class="remove-btn"
      @click="$emit('remove')"
    >
      <v-icon size="small">mdi-minus-circle-outline</v-icon>
    </v-btn>
  </div>
</template>

<style scoped>
.search-builder-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-builder-row .row-fields {
  display: flex;
  align-items: center;
  flex: 1;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

.v-theme--dark .search-builder-row .row-fields {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.search-builder-row .row-fields:focus-within {
  border-color: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.v-theme--dark .search-builder-row .row-fields:focus-within {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.search-builder-row .mode-select {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  color: inherit;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23666' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  padding-right: 24px;
}

.v-theme--dark .search-builder-row .mode-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23aaa' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
}

.search-builder-row .term-input {
  flex: 1;
  min-width: 100px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
  color: inherit;
}

.search-builder-row .term-input::placeholder {
  color: #999;
  opacity: 1;
}

.v-theme--dark .search-builder-row .term-input::placeholder {
  color: #666;
}

.search-builder-row .field-divider {
  width: 1px;
  height: 24px;
  background: rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.v-theme--dark .search-builder-row .field-divider {
  background: rgba(255, 255, 255, 0.12);
}

.search-builder-row .remove-btn {
  flex: 0 0 auto;
}

/* Mobile: stack vertically */
.search-builder-row.mobile {
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  position: relative;
}

.search-builder-row.mobile .row-fields {
  flex-direction: column;
  align-items: stretch;
}

.search-builder-row.mobile .mode-select {
  width: 100%;
}

.search-builder-row.mobile .field-divider {
  width: 100%;
  height: 1px;
}

.search-builder-row.mobile .term-input {
  width: 100%;
  min-width: auto;
}

.search-builder-row.mobile .remove-btn {
  position: absolute;
  right: 0;
  top: 0;
}
</style>
