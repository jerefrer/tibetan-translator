<script>
import { UiIcon } from '../ui';
import { isMacOS } from '../config/platform';

// How the Dictionaries menu works, for the Define, Search and Split help
// dialogs.
export default {
  name: 'DictionariesMenuHelp',
  components: { UiIcon },
  props: {
    // Phones get the long-press hint and no keyboard shortcuts
    isMobile: { type: Boolean, default: false },
  },
  data() {
    return { isMac: isMacOS() };
  },
  computed: {
    modifier() {
      return this.isMac ? '⌘' : 'Ctrl';
    },
    // keys: one or more alternatives, each a list of keys pressed together
    shortcuts() {
      return [
        { keys: [[this.modifier, 'B']], text: 'Opens the dictionary filter menu (B for Browse)' },
        { keys: [['Esc']], text: 'Closes the dictionary filter menu' },
        { keys: [[{ icon: 'arrow-up' }]], text: 'Highlights the previous dictionary in the list' },
        { keys: [[{ icon: 'arrow-down' }]], text: 'Highlights the next dictionary in the list' },
        { keys: [['Space']], text: 'Turns the highlighted dictionary on or off' },
        { keys: [[{ icon: 'corner-down-left' }]], text: 'Disables all dictionaries but the highlighted one' },
        {
          keys: [[{ icon: 'corner-down-left' }]],
          text: 'If none is highlighted, disables all dictionaries but those that are currently listed (same as below)',
        },
        {
          keys: [[{ icon: 'arrow-big-up' }, { icon: 'corner-down-left' }], ['Ctrl', { icon: 'corner-down-left' }]],
          text: 'Disables all dictionaries but those that are currently listed',
        },
        {
          keys: [[{ icon: 'arrow-big-up' }, 'A'], ['Ctrl', 'A']],
          html: 'Enables <u>a</u>ll dictionaries currently listed',
        },
        {
          keys: [[{ icon: 'arrow-big-up' }, 'N'], ['Ctrl', 'N']],
          html: 'Enables <u>n</u>one (disables all dictionaries currently listed)',
        },
        {
          keys: [[{ icon: 'arrow-big-up' }, 'R'], ['Ctrl', 'R']],
          html: '<u>R</u>estores the dictionaries as defined on the Settings page',
        },
      ];
    },
  },
};
</script>

<template>
  <div class="menu-help" data-testid="dictionaries-menu-help">
    <div class="menu-help__intro">
      <span class="menu-help__button" aria-hidden="true">
        Dictionaries · 21/36
        <ui-icon name="chevron-down" :size="12" :stroke-width="2.4" />
      </span>
      <p>
        The Dictionaries button lets you choose which dictionaries to show
        results from, even those disabled on the Settings page. The choice
        lasts for the current lookup.
      </p>
    </div>

    <ul class="menu-help__tips">
      <li>Clicking a dictionary turns it on or off. The switch on the right does the same.</li>
      <li v-if="!isMobile">
        <kbd class="help-key">{{ modifier }}</kbd> + click on a dictionary to select
        <strong>only</strong> that one and disable all others.
      </li>
      <li v-else>
        Long press on a dictionary to select <strong>only</strong> that one and
        disable all others.
      </li>
      <li>
        The filter is "fuzzy": typing <code>ry</code> matches
        <code>Rangjung Yeshe</code> and <code>rcb</code> matches
        <code>Richard Barron</code>.
      </li>
      <li v-if="!isMobile">
        For instance, to see only the results of Hopkins' dictionaries, press
        <kbd class="help-key">{{ modifier }}</kbd> <kbd class="help-key">B</kbd>
        to open the menu, type <code>hop</code>, then press
        <kbd class="help-key"><ui-icon name="corner-down-left" :size="14" /></kbd>.
      </li>
    </ul>

    <template v-if="!isMobile">
      <h3 class="help-heading">Keyboard shortcuts</h3>
      <table class="help-shortcuts">
        <tbody>
          <tr v-for="shortcut in shortcuts" :key="shortcut.text || shortcut.html">
            <td class="help-shortcuts__keys">
              <template v-for="(combination, index) in shortcut.keys" :key="index">
                <span v-if="index > 0" class="help-or">or</span>
                <kbd v-for="(key, keyIndex) in combination" :key="keyIndex" class="help-key">
                  <ui-icon v-if="key.icon" :name="key.icon" :size="14" />
                  <template v-else>{{ key }}</template>
                </kbd>
              </template>
            </td>
            <!-- eslint-disable-next-line vue/no-v-html -- static text above -->
            <td v-if="shortcut.html" v-html="shortcut.html" />
            <td v-else>{{ shortcut.text }}</td>
          </tr>
        </tbody>
      </table>
    </template>
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

.menu-help__button
  flex none
  display inline-flex
  align-items center
  gap 8px
  height 2.25rem
  padding 0 14px
  border 1.5px solid var(--line-strong)
  border-radius var(--radius-lg)
  background var(--surface)
  font-size var(--text-sm-plus)
  font-weight 500
  white-space nowrap

.menu-help__tips
  margin 0
  padding-left 20px
  display flex
  flex-direction column
  gap 8px
  line-height 1.6

code
  padding 1px 6px
  border-radius var(--radius-xs)
  background var(--soft)
  font-size 0.9em

@media (max-width: 600px)
  .menu-help__intro
    flex-direction column
    align-items flex-start
</style>
