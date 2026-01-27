<script>
  import DictionariesMenuHelpTab from './DictionariesMenuHelpTab.vue'
  import { isMacOS } from '../config/platform'

  export default {
    components: {
      DictionariesMenuHelpTab
    },
    data () {
      return {
        dialog: false,
        tab: 0,
        isMobile: window.innerWidth <= 600,
        isMac: isMacOS()
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
  }
</script>

<template>
  <v-dialog
    scrollable
    v-model="dialog"
    content-class="help-dialog"
    max-width="1024px"
    scrim-opacity="0.99"
  >

    <template v-slot:activator="{ props }">
      <v-fab-transition appear>
        <v-btn
          v-if="$route.path.includes('/search')"
          icon
          variant="text"
          size="large"
          v-bind="props"
          class="help-button text-grey-darken-2"
          @click.stop.prevent
        >
          <v-icon>mdi-help-circle</v-icon>
        </v-btn>
      </v-fab-transition>
    </template>

    <v-card>

      <v-toolbar
        height="54"
        class="mb-1"
      >

        <v-toolbar-title>
          <v-icon>mdi-help-circle</v-icon>
          How to use the search page
        </v-toolbar-title>

        <template v-slot:extension>
          <v-tabs
            v-model="tab"
            grow
          >
            <v-tab :value="0">
              Examples
            </v-tab>
            <v-tab :value="1">
              Phonetic search
            </v-tab>
            <v-tab :value="2">
              Wylie support
            </v-tab>
            <v-tab :value="3">
              Dictionaries filter
            </v-tab>
            <v-tab v-if="!isMobile" :value="4">
              Navigation
            </v-tab>
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-4">

        <v-tabs-window
          v-model="tab"
        >

          <v-tabs-window-item>
            <table>
              <tbody>
                <tr>
                  <td><code>seven</code></td>
                  <td>
                    Matches everything that contains "seven" regardless
                    of case.
                    <span class="text-caption text-grey ml-2">
                      ("SeVeN" will be matched as well)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><code>seven limbs of enlightenment</code></td>
                  <td>
                    Matches everything that contains the exact expression
                    "seven limbs of enlightenment".
                  </td>
                </tr>
                <tr>
                  <td><code>seven & limbs & enlightenment</code></td>
                  <td>
                    Matches everything that contains "seven" <b>and</b>
                    "limbs" <b>and</b> "enlightenment" but not necessarily
                    following one another nor in that particular order.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>
                      enlightenment & <span class="tibetan ml-2">དགའ་བ་</span>
                    </code>
                  </td>
                  <td>
                    Matches everything that contains "enlightenment" and
                    <span class="tibetan">དགའ་བ་</span> in any order.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>enlightenment & [trenpa]</code>
                  </td>
                  <td>
                    Matches everything that contains "enlightenment" as well
                    as any Tibetan word that <b>sounds like</b>
                    <span class="mr-2">"trenpa".</span>
                    <span class="text-caption text-grey nowrap">
                      (See
                        <a @click="tab=1">Phonetic search</a>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>{trenpa}</code>
                  </td>
                  <td>
                    Matches everything that contains any Tibetan word that
                    <b>sounds more or less like</b>
                    <span class="mr-2">"trenpa".</span>
                    <span class="text-caption text-grey nowrap">
                      (See
                        <a @click="tab=1">Phonetic search</a>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>[<span class="tibetan">དྲན་པ་</span>]</code>
                  </td>
                  <td>
                    Matches everything that contains any Tibetan word that is
                    <b>pronounced like</b> <span class="tibetan">དྲན་པ་</span>
                    but not necessarily spelled the same
                    <span class="mr-2">way.</span>
                    <span class="text-caption text-grey nowrap">
                      (See
                        <a @click="tab=1">Phonetic search</a>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>{<span class="tibetan">དྲན་པ་</span>}</code>
                  </td>
                  <td>
                    Matches everything that contains any Tibetan word that
                    <b>sounds more or less like</b>
                    <span class="tibetan mr-2">དྲན་པ་</span>
                    <span class="text-caption text-grey nowrap">
                      (See
                        <a @click="tab=1">Phonetic search</a>)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>(dga' ba)</code>
                  </td>
                  <td>
                    Matches everything that contains
                    <span class="tibetan mr-2">དགའ་བ་</span>
                    <span class="text-caption text-grey nowrap">
                      (See
                        <a @click="tab=2">Wylie support</a>)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </v-tabs-window-item>

          <v-tabs-window-item>
            <p>
              This enables you to find something <em>by the way it
              is pronounced</em>.
            </p>
            <p>
              Say, for example, that you heard a Tibetan teacher pronounce
              <i>"chomdende"</i> and, although you know it has something to do
              with Buddha, you have no idea how to spell this in Tibetan.
              You might then just type <code>[chomdende]</code>, and it will
              return all the words that sound like <i>"chomdende"</i>, whatever
              their spelling is.
            </p>

            <v-alert
              variant="tonal"
              density="compact"
              prominent
              type="warning"
              class="text-caption"
              icon="mdi-exclamation"
            >
              The app will automatically split the different syllables, and
              actually will search for <code>chom den de</code>.
              Nevertheless there might be cases where this automatic split
              might fail, so if you can't find what you're looking for, you might
              want to try to split the syllables yourself, in this case by inputting
              <code>[chom den de]</code>.
            </v-alert>

            <v-alert
              variant="tonal"
              density="compact"
              prominent
              type="warning"
              class="text-caption"
              icon="mdi-exclamation"
            >
              Beware of words with "merged" syllables.
              <br />
              For instance <code>[sangye]</code> won't yield any result because
              it is actually <code>san<b>g</b></code> and <code><b>g</b>ye</code>
              put together.
              <br />
              Search instead for <code>[sang gye]</code>
              or <code>[sanggye]</code>.
              <br />
              Therefore if you can't find something try to double the
              consonants between two syllables.
            </v-alert>

            <p>
              Now let's say you were quite far away from the teacher and could
              only hear him say something like <i>"jom ten té"</i>.
              That's all right, you can also search words that sound <em>more or
              less like that</em>. For this you will use the curly brackets:
              <code>{jom ten té}</code>.
            </p>

            <v-alert
              variant="tonal"
              density="compact"
              prominent
              type="info"
              class="text-caption"
              icon="mdi-lightbulb-on-outline"
            >
              [] Square brackets yield a square result.<br />
              {} Curly brackets are more open-minded...
            </v-alert>

            <p>
              This works with Tibetan too!&nbsp;&nbsp;
              <code>[<span class="tibetan">ཆོམ་སྡེན་སྡེ་</span>]</code> will find
              <span class="tibetan">བཅོམ་ལྡན་འདས་</span> and so does
              <code>{<span class="tibetan">ཇོམ་ཏེན་དེ་</span>}</code>.
            </p>

            <p>
              You can even mix them up:
              <code>[chom<span class="tibetan">སྡེན་</span>de]</code> will also find
              <span class="tibetan">བཅོམ་ལྡན་འདས་</span>.
            </p>
          </v-tabs-window-item>

          <v-tabs-window-item>
            <p>
              Everything between parenthesis will be understood as Wylie.
            </p>
            <div class="mb-2">
              For instance all queries below are interchangeable:
            </div>
            <div class="terms-list mixed">
              <code>(sangs rgyas kyi chos)</code>
              <code>(sangs rgyas)(kyi)(chos)</code>
              <code>(sangs rgyas)<span class="tibetan">ཀྱི་</span>(chos)</code>
              <code>(sangs rgyas)<span class="tibetan">ཀྱི་ཆོས་</span></code>
              <code><span class="tibetan">སངས་རྒྱས་ཀྱི་ཆོས་</span></code>
            </div>
          </v-tabs-window-item>

          <DictionariesMenuHelpTab />

          <v-tabs-window-item v-if="!isMobile">
            <div class="text-h6 mb-3">Keyboard shortcuts</div>
            <v-table>
              <tbody>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">D</div>
                  </td>
                  <td class="pl-4">Go to <u>D</u>efine page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">S</div>
                  </td>
                  <td class="pl-4">Go to <u>S</u>earch page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">T</div>
                  </td>
                  <td class="pl-4">Go to Spli<u>t</u> page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">G</div>
                  </td>
                  <td class="pl-4">Go to Settin<u>g</u>s page</td>
                </tr>
              </tbody>
            </v-table>
          </v-tabs-window-item>

        </v-tabs-window>

      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="grey-darken-1"
          variant="text"
          @click="dialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>

    </v-card>

  </v-dialog>
</template>
