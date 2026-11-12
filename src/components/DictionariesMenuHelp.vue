<script>
import { UiIcon } from '../ui';
import { isMacOS } from '../config/platform';

// How to choose the dictionaries shown, for the Lookup, Search and Reader help
// dialogs ("Dictionaries filter" tab): the dictionary tabs of an entry
// (TermEntry's DictionaryTabs) and the dictionary preferences in Library. The
// file keeps the name it had when it explained the Dictionaries menu of the
// former Define, Search and Split pages.
export default {
  name: 'DictionariesMenuHelp',
  components: { UiIcon },
  props: {
    // Phones get no keyboard hint
    isMobile: { type: Boolean, default: false },
  },
  data() {
    return { isMac: isMacOS() };
  },
  computed: {
    // The key DictionaryPreferencesCard moves a dictionary with (altKey)
    moveModifier() {
      return this.isMac ? '⌥ Option' : 'Alt';
    },
  },
};
</script>

<template>
  <div class="menu-help" data-testid="dictionaries-menu-help">
    <div class="menu-help__intro">
      <span class="menu-help__tabs" aria-hidden="true">
        <span class="menu-help__tab menu-help__tab--active">All · 49</span>
        <span class="menu-help__tab">Hopkins 2015</span>
        <span class="menu-help__tab">More…</span>
      </span>
      <p>
        An entry shows its definitions dictionary by dictionary. The tabs above
        them choose which ones you see.
      </p>
    </div>

    <ul class="menu-help__tips">
      <li><strong>All</strong> shows every definition, with how many there are.</li>
      <li>
        A dictionary's tab shows only its definitions. The dictionaries that do
        not fit on the row are under <strong>More…</strong>. Copy then copies
        only that dictionary.
      </li>
      <li>The choice lasts for the term: the next term opens on <strong>All</strong>.</li>
      <li>
        In the Reader, the panel shows the first three dictionaries;
        <strong>Open entry</strong> shows the whole entry in Lookup.
      </li>
    </ul>

    <h3 class="help-heading">Which dictionaries, in which order</h3>
    <ul class="menu-help__tips">
      <li>
        In <strong>Library</strong>, under Settings, <strong>Dictionary preferences</strong>
        lists every dictionary. Switch one off to leave it out of Lookup and the
        Reader; drag it by its handle to change the order the tabs and definitions follow.
      </li>
      <li v-if="!isMobile">
        From the keyboard: focus a dictionary's handle, then press
        <kbd class="help-key">{{ moveModifier }}</kbd>
        <kbd class="help-key"><ui-icon name="arrow-up" :size="14" /></kbd> or
        <kbd class="help-key">{{ moveModifier }}</kbd>
        <kbd class="help-key"><ui-icon name="arrow-down" :size="14" /></kbd>
        to move it.
      </li>
    </ul>
  </div>
</template>

<style lang="stylus" scoped>
.menu-help
  display flex
  flex-direction column
  gap 14px

.menu-help__intro
  display flex
  align-items center
  gap 16px

  p
    margin 0

.menu-help__tabs
  flex none
  display inline-flex
  align-items center
  gap 4px
  white-space nowrap

.menu-help__tab
  display inline-flex
  align-items center
  height 2rem
  padding 0 10px
  border-radius var(--radius-md)
  color var(--ink)
  font-size var(--text-sm)
  font-weight 500

.menu-help__tab--active
  background var(--soft)

.menu-help__tips
  margin 0
  padding-left 20px
  display flex
  flex-direction column
  gap 8px
  line-height 1.6

@media (max-width: 600px)
  .menu-help__intro
    flex-direction column
    align-items flex-start
</style>
