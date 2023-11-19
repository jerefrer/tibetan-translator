<script>
  import DictionariesMenuHelpTab from './DictionariesMenuHelpTab'

  export default {
    components: {
      DictionariesMenuHelpTab
    },
    data () {
      return {
        dialog: false,
        tab: 0
      }
    }
  }
</script>

<template>
  <v-dialog
    scrollable
    v-model="dialog"
    content-class="help-dialog"
    max-width="1024px"
    overlay-opacity="0.99"
  >

    <template v-slot:activator="{ on, attrs }">
      <v-fab-transition appear>
        <v-btn
          v-if="$route.path.includes('/search')"
          icon large
          v-on="on"
          v-bind="attrs"
          class="help-button grey--text text--darken-2"
        >
          <v-icon>mdi-help-circle</v-icon>
        </v-btn>
      </v-fab-transition>
    </template>

    <v-card>

      <v-toolbar
        color="black"
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
            <v-tab>
              Examples
            </v-tab>
            <v-tab>
              Phonetic search
            </v-tab>
            <v-tab>
              Wylie support
            </v-tab>
            <v-tab>
              Dictionaries filter
            </v-tab>
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-4">

        <v-tabs-items
          v-model="tab"
        >

          <v-tab-item>
            <table>
              <tbody>
                <tr>
                  <td><code>seven</code></td>
                  <td>
                    Matches everything that contains "seven" regardless
                    of case.
                    <span class="caption grey--text ml-2">
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
                    <span class="caption grey--text nowrap">
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
                    <span class="caption grey--text nowrap">
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
                    <span class="caption grey--text nowrap">
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
                    <span class="caption grey--text nowrap">
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
                    <span class="caption grey--text nowrap">
                      (See
                        <a @click="tab=2">Wylie support</a>)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </v-tab-item>

          <v-tab-item>
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
              text
              dense
              prominent
              type="warning"
              class="caption"
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
              text
              dense
              prominent
              type="warning"
              class="caption"
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
              text
              dense
              prominent
              type="info"
              class="caption"
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
          </v-tab-item>

          <v-tab-item>
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
          </v-tab-item>

          <DictionariesMenuHelpTab />

        </v-tabs-items>

      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="grey darken-1"
          text
          @click="dialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>

    </v-card>

  </v-dialog>
</template>
