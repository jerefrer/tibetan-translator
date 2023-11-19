<script>
  export default {
    computed: {
      shorcuts () {
        return [
          { key: 'Spacebar',             ctrl: true, text: 'Opens the dictionary filter menu' },
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
              { key: 'E', shift: true },
              { key: 'E', ctrl: true }
            ],
            text: 'Enables all dictionaries <u>currently listed</u>'
          },
          {
            keys: [
              { key: 'D', shift: true },
              { key: 'D', ctrl: true }
            ],
            text: 'Disables all dictionaries <u>currently listed</u>'
          },
          {
            keys: [
              { key: 'R', shift: true },
              { key: 'R', ctrl: true }
            ],
            text: 'Restores the dictionaries as defined on the Configure page'
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
  <v-tab-item>

    <div class="d-flex align-center">
      <v-btn
        rounded
        height="32"
        class="mr-2 dictionaries-menu-button"
      >
        <v-icon
          class="ma-0"
          style="font-size: 21px"
        >
          mdi-book-multiple
        </v-icon>
        <span>21</span>
        <span class="caption grey--text text--darken-1">/36</span>
      </v-btn>
      <div>
        The dictionaries filter button allows you to choose which dictionaries
        to display results from, even those disabled in the Configure page.
      </div>
    </div>

    <v-alert
      text
      dense
      prominent
      type="info"
      class="caption mt-4"
    >
      Clicking a dictionary will show results only for this one dictionary.
      <br />
      Clicking the switch next to a dictionary will just switch it on and off
      without altering other dictionaries.
    </v-alert>

    <v-alert
      text
      dense
      prominent
      type="info"
      class="caption mt-4"
    >
      The search is "fuzzy", meaning that for example typing
      <code>ry</code> will match <code>Rangjung Yeshe</code> and
      <code>rcb</code> will match <code>Richard Barron</code>.
    </v-alert>

    <v-alert
      text
      dense
      prominent
      type="info"
      class="caption mt-4"
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
      <div class="d-flex align-center mt-2">
        <div class="keyboard-square">Ctrl</div>
        <div class="keyboard-square ml-1 mr-2">Spacebar</div>
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

    <div class="text-h6 mt-3 mb-2">
      Keyboard shortcuts
    </div>

    <v-simple-table>
      <tbody>
        <tr v-for="shortcut in shorcuts">
          <td
            class="pl-0"
          >
            <template
              v-for="(hotkey, index) in shortcut.keys"
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
              <v-icon v-if="hotkey.key.match('mdi')" class="keyboard-square">
                {{ hotkey.key }}
              </v-icon>
              <div v-else class="keyboard-square">
                {{ hotkey.key }}
              </div>
              <div
                v-if="index < shortcut.keys.length - 1"
                class="caption grey--text text--darken-1 d-inline-flex mx-2"
              >or</div>
            </template>
          </td>
          <td
            class="pl-4"
            v-html="shortcut.text"
          />
        </tr>
      </tbody>
    </v-simple-table>
  </v-tab-item>
</template>
