<script>
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui';
import UiIcon from './UiIcon.vue';

// Replaces <v-menu> + <v-list> for action menus. The default slot is the
// trigger (a single element). items: [{ key, label, description?, icon?,
// danger?, disabled? }] or { separator: true }. Emits `select` with the item.
// An item with a `description` shows it under its label, on a second line.
export default {
  name: 'UiMenu',
  components: {
    DropdownMenuRoot,
    DropdownMenuTrigger,
    DropdownMenuPortal,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    UiIcon,
  },
  props: {
    items: { type: Array, required: true },
    align: { type: String, default: 'start' },
    open: { type: Boolean, default: undefined },
  },
  emits: ['select', 'update:open'],
  computed: {
    described() {
      return this.items.some((item) => item.description);
    },
  },
};
</script>

<template>
  <dropdown-menu-root :open="open" @update:open="$emit('update:open', $event)">
    <dropdown-menu-trigger as-child><slot /></dropdown-menu-trigger>
    <dropdown-menu-portal>
      <dropdown-menu-content
        class="ui-menu"
        :class="{ 'ui-menu--described': described }"
        :align="align"
        :side-offset="6"
        data-testid="ui-menu"
      >
        <template v-for="(item, index) in items" :key="item.key ?? 'sep-' + index">
          <dropdown-menu-separator v-if="item.separator" class="ui-menu__separator" />
          <dropdown-menu-item
            v-else
            class="ui-menu__item"
            :class="{
              'ui-menu__item--danger': item.danger,
              'ui-menu__item--described': item.description,
            }"
            :disabled="item.disabled"
            :data-testid="'ui-menu-item-' + item.key"
            @select="$emit('select', item)"
          >
            <ui-icon v-if="item.icon" :name="item.icon" :size="18" />
            <span v-if="item.description" class="ui-menu__text">
              <span class="ui-menu__label">{{ item.label }}</span>
              <span class="ui-menu__description">{{ item.description }}</span>
            </span>
            <template v-else>{{ item.label }}</template>
          </dropdown-menu-item>
        </template>
      </dropdown-menu-content>
    </dropdown-menu-portal>
  </dropdown-menu-root>
</template>

<style>
.ui-menu {
  z-index: 3000;
  min-width: 11rem;
  padding: var(--space-1);
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-pop);
  font-family: var(--font-ui);
}
.ui-menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  min-height: var(--control-sm);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  cursor: pointer;
  outline: none;
  user-select: none;
}
.ui-menu__item[data-highlighted] { background: var(--soft); }
.ui-menu__item[data-disabled] { opacity: 0.45; cursor: not-allowed; }
.ui-menu__item--danger { color: var(--danger-ink); }
.ui-menu--described { min-width: 20rem; }
.ui-menu__item--described {
  align-items: flex-start;
  padding: 10px 14px;
}
.ui-menu__item--described .ui-icon { margin-top: 2px; }
.ui-menu__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ui-menu__label { font-size: var(--text-body); font-weight: 600; }
.ui-menu__description { font-size: var(--text-chip); color: var(--muted); }
.ui-menu__separator { height: 1px; margin: var(--space-1) 0; background: var(--line); }
</style>
