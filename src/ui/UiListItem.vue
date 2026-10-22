<script>
import UiIcon from './UiIcon.vue';

// A row of <UiList>. `title` and `subtitle` replace v-list-item-title and
// -subtitle; `prepend` / `append` slots hold icons or actions. With
// `clickable` the row is a button and emits `click`.
export default {
  name: 'UiListItem',
  components: { UiIcon },
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    icon: { type: String, default: '' },
    clickable: { type: Boolean, default: false },
    selected: { type: Boolean, default: false },
  },
  emits: ['click'],
};
</script>

<template>
  <li class="ui-list-item" :class="{ 'is-selected': selected }" data-testid="ui-list-item">
    <component
      :is="clickable ? 'button' : 'div'"
      class="ui-list-item__row"
      :type="clickable ? 'button' : undefined"
      :aria-current="selected ? 'true' : undefined"
      @click="clickable && $emit('click', $event)"
    >
      <slot name="prepend"><ui-icon v-if="icon" :name="icon" :size="20" class="ui-list-item__icon" /></slot>
      <span class="ui-list-item__text">
        <span v-if="title || $slots.default" class="ui-list-item__title"><slot>{{ title }}</slot></span>
        <span v-if="subtitle" class="ui-list-item__subtitle">{{ subtitle }}</span>
      </span>
      <slot name="append" />
    </component>
  </li>
</template>

<style>
.ui-list-item { border-bottom: 1px solid var(--soft); }
.ui-list-item:last-child { border-bottom: 0; }
.ui-list-item__row {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 3rem;
  padding: var(--space-2) var(--space-4);
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: left;
  font: var(--text-base) var(--font-ui);
}
button.ui-list-item__row { cursor: pointer; }
button.ui-list-item__row:hover { background: var(--soft); }
button.ui-list-item__row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ui-list-item.is-selected .ui-list-item__row { background: var(--accent-soft); color: var(--accent); }
.ui-list-item__icon { color: var(--muted); }
.ui-list-item__text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ui-list-item__title { font-weight: 500; }
.ui-list-item__subtitle { font-size: var(--text-sm); color: var(--muted); }
</style>
