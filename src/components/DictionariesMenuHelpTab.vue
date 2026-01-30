<script>
  import { isMacOS } from '../config/platform'

  export default {
    data () {
      return {
        isMac: isMacOS()
      }
    },
    computed: {
      shorcuts () {
        const cmdOrCtrl = this.isMac
          ? { meta: true }
          : { ctrl: true };

        return [
          {
            keys: [{ key: 'B', ...cmdOrCtrl }],
            text: 'Opens the dictionary filter menu (B for Browse)'
          },
          { key: 'Esc',                              text: 'Closes the dictionary filter menu' },
          { key: 'mdi-arrow-up',                     text: 'Highlights the previous dictionary the list' },
          { key: 'mdi-arrow-down',                   text: 'Highlights the next dictionary in the list' },
          { key: 'mdi-keyboard-return',              text: 'Disables all dictionaries but the highlighted one' },
          { key: 'mdi-keyboard-return',              text: 'If none is highlighted, disables all dictionaries but those that are currently listed (same as below)' },
          {
            keys: [
              { key: 'mdi-keyboard-return', shift: true },
              { key: 'mdi-keyboard-return', ctrl: true }
            ],
            text: 'Disables all dictionaries but those that are currently listed'
          },
          {
            keys: [
              { key: 'A', shift: true },
              { key: 'A', ctrl: true }
            ],
            text: 'Enables <u>a</u>ll dictionaries currently listed'
          },
          {
            keys: [
              { key: 'N', shift: true },
              { key: 'N', ctrl: true }
            ],
            text: 'Enables <u>n</u>one (disables all dictionaries currently listed)'
          },
          {
            keys: [
              { key: 'R', shift: true },
              { key: 'R', ctrl: true }
            ],
            text: '<u>R</u>estores the dictionaries as defined on the Settings page'
          },
        ].map((shortcut) => {
          if (shortcut.key)
            shortcut.keys = [{
              key: shortcut.key,
              alt: shortcut.alt,
              ctrl: shortcut.ctrl,
              shift: shortcut.shift,
            }]
          return shortcut;
        })
      }
    }
  }
</script>

<template>
  <v-tabs-window-item>

    <div class="d-flex align-center">
      <v-btn
        rounded
        height="32"
        class="mr-2 dictionaries-menu-button"
      >
        <v-icon
          class="ma-0"
          style="font-size: 1.3125rem"
        >
          mdi-book-multiple
        </v-icon>
        <span>21</span>
        <span class="text-caption text-grey-darken-1">/36</span>
      </v-btn>
      <div>
        The dictionaries filter button allows you to choose which dictionaries
        to display results from, even those disabled in the Settings page.
      </div>
    </div>

    <v-alert
      variant="tonal"
      density="compact"
      prominent
      type="info"
      class="text-caption mt-4"
    >
      Clicking a dictionary toggles it on or off.
      <br />
      The switch on the right side does the same.
    </v-alert>

    <!-- Desktop: Ctrl/Cmd+click hint -->
    <v-alert
      variant="tonal"
      density="compact"
      prominent
      type="info"
      class="text-caption mt-4 d-none d-sm-flex"
      icon="mdi-gesture-tap"
    >
      <div class="d-flex align-center flex-wrap">
        <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
        <div v-else class="keyboard-square">Ctrl</div>
        <span class="ml-1">+ click on a dictionary to select <strong>only</strong> that one and disable all others.</span>
      </div>
    </v-alert>

    <!-- Mobile: Long press hint -->
    <v-alert
      variant="tonal"
      density="compact"
      prominent
      type="info"
      class="text-caption mt-4 d-sm-none"
      icon="mdi-gesture-tap-hold"
    >
      Long press on a dictionary to select <strong>only</strong> that one and disable all others.
    </v-alert>

    <v-alert
      variant="tonal"
      density="compact"
      prominent
      type="info"
      class="text-caption mt-4"
    >
      The search is "fuzzy", meaning that for example typing
      <code>ry</code> will match <code>Rangjung Yeshe</code> and
      <code>rcb</code> will match <code>Richard Barron</code>.
    </v-alert>

    <!-- Keyboard shortcuts section - hidden on mobile -->
    <v-alert
      variant="tonal"
      density="compact"
      prominent
      type="info"
      class="text-caption mt-4 d-none d-sm-flex"
      icon="mdi-lightbulb-on-outline"
    >
      <div>
        Using the keyboard shortcuts listed below you can very quickly get to
        just the results you're looking for.
      </div>
      <div class="mt-2">
        For instance to display only the results contained in any of Hopkins'
        dictionaries and hide results from all the others, you could do:
      </div>
      <div class="d-flex align-center flex-wrap mt-2">
        <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
        <div v-else class="keyboard-square">Ctrl</div>
        <div class="keyboard-square ml-1 mr-2">B</div>
        <div>
          to open the menu, then type <code>hop</code> and then
          press
        </div>
        <v-icon class="keyboard-square ml-1 mr-2">mdi-keyboard-return</v-icon>
        <div>
          to show only dictionaries matching <code>hop</code> and close the menu.
        </div>
      </div>
    </v-alert>

    <div class="text-h6 mt-3 mb-2 d-none d-sm-block">
      Keyboard shortcuts
    </div>

    <v-table class="d-none d-sm-table">
      <tbody>
        <tr v-for="shortcut in shorcuts" :key="shortcut.text">
          <td
            class="pl-0"
          >
            <template
              v-for="(hotkey, index) in shortcut.keys"
              :key="index"
            >
              <div v-if="hotkey.ctrl" class="keyboard-square">
                Ctrl
              </div>
              <div v-if="hotkey.alt" class="keyboard-square">
                Alt
              </div>
              <v-icon v-if="hotkey.shift" class="keyboard-square">
                mdi-apple-keyboard-shift
              </v-icon>
              <v-icon v-if="hotkey.meta" class="keyboard-square">
                mdi-apple-keyboard-command
              </v-icon>
              <v-icon v-if="hotkey.key.match('mdi')" class="keyboard-square">
                {{ hotkey.key }}
              </v-icon>
              <div v-else class="keyboard-square">
                {{ hotkey.key }}
              </div>
              <div
                v-if="index < shortcut.keys.length - 1"
                class="text-caption text-grey-darken-1 d-inline-flex align-center mx-2"
                style="height: 36px"
              >or</div>
            </template>
          </td>
          <td
            class="pl-4"
            v-html="shortcut.text"
          />
        </tr>
      </tbody>
    </v-table>
  </v-tabs-window-item>
</template>
