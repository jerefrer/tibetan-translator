<script>
// Development-only page (route /ui-showcase, absent from production builds)
// that renders every component of src/ui in the light and dark themes side by
// side. Overlays (dialog, menu, select, tooltip, toast) open in the theme
// selected by the "Page theme" switch.
import {
  UiAccordion,
  UiAlert,
  UiBadge,
  UiButton,
  UiCard,
  UiCheckbox,
  UiChip,
  UiDialog,
  UiDivider,
  UiIcon,
  UiList,
  UiListItem,
  UiMenu,
  UiPagination,
  UiProgress,
  UiSelect,
  UiSlider,
  UiSpinner,
  UiSwitch,
  UiTable,
  UiTabs,
  UiTextField,
  UiTibetanField,
  UiToast,
  UiToolbar,
  UiTooltip,
} from './index';
import { ICONS } from './icons';
import { applyDocumentTheme } from '../services/theme';

export default {
  name: 'UiShowcasePage',
  components: {
    UiAccordion,
    UiAlert,
    UiBadge,
    UiButton,
    UiCard,
    UiCheckbox,
    UiChip,
    UiDialog,
    UiDivider,
    UiIcon,
    UiList,
    UiListItem,
    UiMenu,
    UiPagination,
    UiProgress,
    UiSelect,
    UiSlider,
    UiSpinner,
    UiSwitch,
    UiTable,
    UiTabs,
    UiTextField,
    UiTibetanField,
    UiToast,
    UiToolbar,
    UiTooltip,
  },
  data() {
    return {
      themes: ['light', 'dark'],
      pageTheme: document.documentElement.getAttribute('data-theme') || 'light',
      dialogOpen: false,
      persistentOpen: false,
      toastOpen: false,
      state: {
        text: 'ye shes',
        tibetan: 'ཡེ་ཤེས་',
        wylie: 'snying rje',
        multiline: 'A free-form note',
        selectValue: 'core',
        tab: 'one',
        on: true,
        checked: true,
        slider: 100,
        page: 3,
        chips: ['en'],
        pill: 'Any',
        tag: 'archaic',
        accordion: undefined,
      },
      selectOptions: [
        { value: 'core', label: 'Core Dictionaries' },
        { value: 'tibetan', label: 'Tibetan Monolingual' },
        { value: 'sanskrit', label: 'Sanskrit & Academic' },
      ],
      tabItems: [
        { value: 'one', label: 'Dictionaries filter', icon: 'book-open' },
        { value: 'two', label: 'Keyboard' },
        { value: 'three', label: 'Tips' },
      ],
      menuItems: [
        { key: 'copy', label: 'Copy', icon: 'copy' },
        { key: 'edit', label: 'Edit', icon: 'pencil' },
        { separator: true },
        { key: 'delete', label: 'Delete', icon: 'trash-2', danger: true },
      ],
      describedMenuItems: [
        { key: 'tibdict', label: 'Dictionary file', description: 'To share, or to reinstall later' },
        { key: 'xlsx', label: 'Spreadsheet', description: 'To edit in Excel and import back' },
      ],
      accordionItems: [{ value: 'a', title: '3 rows ignored' }],
      iconNames: Object.keys(ICONS),
    };
  },
  methods: {
    setPageTheme(theme) {
      this.pageTheme = applyDocumentTheme(theme);
    },
  },
};
</script>

<template>
  <div class="showcase" data-testid="ui-showcase">
    <header class="showcase__bar">
      <h1>UI components</h1>
      <span class="showcase__bar-label">Page theme (for overlays)</span>
      <ui-switch
        :model-value="pageTheme === 'dark'"
        label="Dark"
        @update:model-value="setPageTheme($event ? 'dark' : 'light')"
      />
      <ui-button variant="outline" size="sm" @click="dialogOpen = true">Dialog</ui-button>
      <ui-button variant="outline" size="sm" @click="persistentOpen = true">Destructive dialog</ui-button>
      <ui-button variant="outline" size="sm" @click="toastOpen = true">Toast</ui-button>
    </header>

    <div class="showcase__panes">
      <section v-for="theme in themes" :key="theme" class="showcase__pane" :data-theme="theme">
        <h2>{{ theme }}</h2>

        <h3>Button</h3>
        <div class="row">
          <ui-button>Solid</ui-button>
          <ui-button variant="outline">Outline</ui-button>
          <ui-button variant="ghost">Ghost</ui-button>
          <ui-button variant="danger">Danger</ui-button>
          <ui-button size="sm">Small</ui-button>
          <ui-button loading>Loading</ui-button>
          <ui-button disabled>Disabled</ui-button>
          <ui-button icon variant="outline" aria-label="Search"><ui-icon name="search" /></ui-button>
        </div>

        <h3>Icon</h3>
        <div class="row row--icons">
          <ui-tooltip v-for="name in iconNames" :key="name" :text="name">
            <span class="icon-cell"><ui-icon :name="name" :size="22" /></span>
          </ui-tooltip>
        </div>

        <h3>Chip</h3>
        <div class="row">
          <ui-chip>Hopkins 2015</ui-chip>
          <ui-chip tone="neutral">neutral</ui-chip>
          <ui-chip tone="amber">comprehensive</ui-chip>
          <ui-chip tone="amber" selected>archaic</ui-chip>
          <ui-chip outlined>Tibetan</ui-chip>
          <ui-chip removable>removable</ui-chip>
          <ui-chip
            v-for="language in [{ id: 'en', label: 'English' }, { id: 'skt', label: 'Sanskrit' }]"
            :key="language.id"
            clickable
            :selected="state.chips.includes(language.id)"
            @click="state.chips = state.chips.includes(language.id) ? [] : [language.id]"
          >{{ language.label }}</ui-chip>
        </div>
        <div class="row">
          <ui-chip
            v-for="option in ['Any', 'Tibetan only', 'English']"
            :key="option"
            clickable
            variant="pill"
            :selected="state.pill === option"
            @click="state.pill = option"
          >{{ option }}</ui-chip>
          <ui-chip
            v-for="tag in [{ label: 'archaic', count: 4 }, { label: 'synonyms', count: 4 }]"
            :key="tag.label"
            clickable
            variant="tag"
            tone="amber"
            :count="tag.count"
            :selected="state.tag === tag.label"
            @click="state.tag = state.tag === tag.label ? '' : tag.label"
          >{{ tag.label }}</ui-chip>
        </div>

        <h3>Alert</h3>
        <div class="stack">
          <ui-alert type="info" title="Heads up">Plain information.</ui-alert>
          <ui-alert type="success">Pack installed.</ui-alert>
          <ui-alert type="warning" dismissible>12 more entries are in packs you have not installed.</ui-alert>
          <ui-alert type="error">The download failed.</ui-alert>
        </div>

        <h3>Spinner, progress, badge</h3>
        <div class="row">
          <ui-spinner />
          <ui-spinner :size="40" />
          <div class="grow"><ui-progress :value="60" /></div>
          <div class="grow"><ui-progress /></div>
          <ui-badge content="3"><ui-icon name="library" :size="24" /></ui-badge>
          <ui-badge><ui-icon name="settings" :size="24" /></ui-badge>
        </div>

        <h3>Text field</h3>
        <div class="stack">
          <ui-text-field v-model="state.text" label="Label" clearable prepend-icon="search" placeholder="Search" hint="Helper text" />
          <ui-text-field v-model="state.tibetan" tibetan clearable />
          <ui-text-field v-model="state.text" label="With an error" error="This field is required" />
          <ui-text-field v-model="state.multiline" label="Multiline" multiline :rows="2" />
          <ui-text-field model-value="Disabled" disabled />
          <ui-tibetan-field v-model="state.wylie" label="Tibetan term (type Wylie, then a space)" />
        </div>

        <h3>Select, menu, tooltip</h3>
        <div class="row">
          <div class="grow"><ui-select v-model="state.selectValue" :options="selectOptions" label="Pack" /></div>
          <ui-menu :items="menuItems">
            <ui-button variant="outline">Menu <ui-icon name="chevron-down" :size="16" /></ui-button>
          </ui-menu>
          <ui-menu :items="describedMenuItems" align="end">
            <ui-button variant="outline">Export <ui-icon name="chevron-down" :size="16" /></ui-button>
          </ui-menu>
          <ui-tooltip text="A tooltip">
            <ui-button variant="ghost">Hover me</ui-button>
          </ui-tooltip>
        </div>

        <h3>Switch, checkbox, slider</h3>
        <div class="stack">
          <ui-switch v-model="state.on" label="Global lookup" />
          <ui-checkbox v-model="state.checked" label="Keep longest only" />
          <ui-slider v-model="state.slider" :min="80" :max="160" :step="5" label="Text size" />
        </div>

        <h3>Tabs</h3>
        <ui-tabs v-model="state.tab" :items="tabItems" grow>
          <template #panel-one>Filter the dictionaries a lookup searches.</template>
          <template #panel-two>Cmd or Ctrl plus D, S, T, G.</template>
          <template #panel-three>Spaces decide where words are split.</template>
        </ui-tabs>

        <h3>Card, toolbar, list, divider</h3>
        <ui-card title="Card title" subtitle="Card subtitle">
          Body text inside a card.
          <template #actions>
            <ui-button variant="ghost" size="sm">Cancel</ui-button>
            <ui-button size="sm">Save</ui-button>
          </template>
        </ui-card>
        <ui-divider />
        <ui-card flat>
          <ui-toolbar icon="notebook-text" title="My glossary" subtitle="3 entries">
            <ui-button variant="ghost" size="sm">Export</ui-button>
          </ui-toolbar>
          <ui-list>
            <ui-list-item title="Rangjung Yeshe" subtitle="comprehensive" icon="book-open" clickable />
            <ui-list-item title="Hopkins 2015" icon="book-open" clickable selected />
          </ui-list>
        </ui-card>

        <h3>Table</h3>
        <ui-table hover>
          <thead><tr><th>Dictionary</th><th>Entries</th></tr></thead>
          <tbody>
            <tr><td>Hopkins 2015</td><td>31 000</td></tr>
            <tr><td>Rangjung Yeshe</td><td>74 000</td></tr>
          </tbody>
        </ui-table>

        <h3>Pagination, accordion</h3>
        <div class="stack">
          <ui-pagination v-model="state.page" :length="12" />
          <ui-accordion v-model="state.accordion" :items="accordionItems">
            <template #item-a>Row 4, Row 9, Row 12</template>
          </ui-accordion>
        </div>
      </section>
    </div>

    <ui-dialog v-model="dialogOpen" title="What’s new in v1.12.0" description="Searchable catalog of dictionaries in Settings.">
      <template #actions>
        <ui-button variant="outline" @click="dialogOpen = false">Later</ui-button>
        <ui-button @click="dialogOpen = false">Restart now</ui-button>
      </template>
    </ui-dialog>
    <ui-dialog v-model="persistentOpen" persistent title="Remove pack?" description="Tibetan Monolingual and its 21 dictionaries will be removed from this device.">
      <template #actions>
        <ui-button variant="outline" @click="persistentOpen = false">Cancel</ui-button>
        <ui-button variant="danger" @click="persistentOpen = false">Remove</ui-button>
      </template>
    </ui-dialog>
    <ui-toast v-model="toastOpen">Update to v1.12.1 ready! Will install on restart.</ui-toast>
  </div>
</template>

<style>
.showcase {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  padding-bottom: var(--space-8);
}
.showcase__bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.showcase__bar h1 { margin: 0 var(--space-4) 0 0; font-size: var(--text-title); }
.showcase__bar-label { font-size: var(--text-sm); color: var(--muted); }
.showcase__panes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
}
.showcase__pane {
  box-sizing: border-box;
  padding: var(--space-5);
  background: var(--bg);
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}
.showcase__pane > h2 { margin: 0; text-transform: capitalize; font-size: var(--text-heading); }
.showcase__pane > h3 {
  margin: var(--space-4) 0 0;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.showcase .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.showcase .row--icons { gap: var(--space-2); }
.showcase .stack { display: flex; flex-direction: column; gap: var(--space-3); }
.showcase .grow { flex: 1; min-width: 8rem; }
.showcase .icon-cell {
  display: inline-flex;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--line);
}
</style>
