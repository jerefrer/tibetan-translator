<script>
  import { v4 as uuid } from 'uuid'

  import TranslatePageWordCard from './TranslatePageWordCard.vue'
  import TranslatePageSplitIcon from './TranslatePageSplitIcon.vue'
  import TranslatePageTranslationLines from './TranslatePageTranslationLines.vue'
  import TranslatePageHelpDialogCopyButton from './TranslatePageHelpDialogCopyButton.vue'

  export default {
    components: {
      TranslatePageWordCard,
      TranslatePageSplitIcon,
      TranslatePageTranslationLines,
      TranslatePageHelpDialogCopyButton
    },
    data () {
      return {
        dialog: false,
        tab: 0,
        lines: [],
        step: 'start'
      }
    },
    watch: {
      dialog (value) {
        if (!value) { // on closing restart tutorial
          this.lines = [];
          this.step = 'start';
        }
      }
    },
    methods: {
      onMutate (mutations, observer) {
        var targetClass = (index) => mutations[index].target.className;
        if (targetClass(0).includes('add-line-button')) {
          if (this.step == 'break-the-first-card')
            this.step = 'delete-the-first-card';
          else if (this.step == 'delete-the-first-card')
            this.step = 'thats-it';
          else
            this.step = 'break-the-line';
        } else if (mutations.length == 5 && targetClass(4).includes('words'))
          this.step = 'break-the-first-card';
      },
      copyToClipboard (text) {
        navigator.clipboard.writeText(text);
      },
      uuid () {
        return uuid();
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
    scrim-opacity="0.99"
  >

    <template v-slot:activator="{ props }">
      <v-fab-transition appear>
        <v-btn
          v-if="$route.path.includes('/translate')"
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
          How to use the translate page
        </v-toolbar-title>

        <template v-slot:extension>
          <v-tabs
            v-model="tab"
            grow
          >
            <v-tab :value="0">
              Live definition lookup
            </v-tab>
            <v-tab :value="1">
              Assisted sentence splitting
            </v-tab>
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-3 pb-0">

        <v-tabs-window
          v-model="tab"
        >

          <v-tabs-window-item>

            <v-row>

              <v-col
                cols="12"
                sm="7"
              >

                <p>
                  While typing in the Tibetan input of a card, you will
                  notice that the two icons<br />
                  <TranslatePageSplitIcon style="margin-left: -8px" />
                  and
                  <v-icon color="grey">mdi-menu-down</v-icon>
                  will be appearing and disappearing.
                </p>

                <p>
                  <TranslatePageSplitIcon style="margin-left: -8px" />
                  being shown means that the Tibetan can be broken down into
                  sub-cards.
                  <br />
                  <v-icon color="grey" style="margin-left: -8px">mdi-menu-down</v-icon>
                  being shown means that the Tibetan has existing definitions
                  in the dictionary.
                </p>

                <p>
                  As you can see in the first two cards, for the Tibetan to
                  be looked up in the dictionaries it needs to end with a
                  <i>ts'ek</i>
                  (
                    the dot
                    <code class="mx-1 tibetan caption">་</code>
                    between syllables
                  ).
                </p>

                <p>
                  If <v-icon color="grey">mdi-menu-down</v-icon>
                  is visible you can click it (or anywhere in the field)
                  to reveal the list of all the definitions for the Tibetan
                  above.
                  <strong>
                    Clicking one definition will replace the previous value.
                  </strong>
                </p>

                <p>
                  You can also just type your own definition, or pick an
                  existing definition and then customize it to your liking.
                </p>

                <p>
                  Even better, as you type your own text it will narrow down
                  the definitions to show only those that contain your text
                  and highlight it, so you can use the input as a kind of
                  search field. (If you just want to type your text without
                  being bothered by the list of definitions just type ESC.)
                </p>

                <p>
                  Try it out on the examples cards.<br />
                  (
                    <TranslatePageSplitIcon color="grey" /> is disabled here,
                    to see how it works try the
                    <a @click="tab = 1" class="nowrap">
                      Assisted Sentence Splitting tutorial
                    </a>
                  )
                </p>

              </v-col>

              <v-col
                cols="12"
                sm="5"
                class="d-flex flex-column align-center"
              >

                <TranslatePageWordCard
                  class="mb-1"
                  :word="{ source: 'སངས་རྒྱས' }"
                />

                <TranslatePageWordCard
                  class="mb-1"
                  :word="{ source: 'སངས་རྒྱས་' }"
                />

                <TranslatePageWordCard
                  auto-pick-first-definition
                  class="mb-1"
                  :key="uuid()"
                  :word="{ source: 'སངས་རྒྱས་' }"
                />

                <TranslatePageWordCard
                  class="mb-1"
                  :word="{ source: 'སངས་རྒྱས་', translation: 'You can also type whatever you like' }"
                />

              </v-col>

            </v-row>

          </v-tabs-window-item>

          <v-tabs-window-item>

            <v-alert
              variant="tonal"
              class="demo-instructions mb-0 rounded-b-0"
            >

              <v-fade-transition mode="out-in">

                <div
                  key="start"
                  v-if="step == 'start'"
                >
                  <p>
                    The assisted splitting works by trying to deconstruct
                    each line into its longest possible parts that have a
                    definition in any of your chosen dictionaries.
                  </p>
                  <p>
                    Now the best way to explain what this means is to let
                    you try it.
                  </p>
                  <v-alert
                    variant="tonal"
                    density="compact"
                    prominent
                    type="info"
                    class="text-caption"
                  >
                    If the tutorial seems a little lost it might mean that
                    you did something unexpected instead of following
                    precisely the instructions.
                    <br />
                    In that case just close and re-open the help window and
                    try again!
                  </v-alert>
                </div>

                <div
                  key="create-a-new-line"
                  v-else-if="step == 'create-a-new-line'"
                >

                  <div class="mb-1">
                    Say you want to translate the following line from the
                    "The Sūtra of Truly Remembering the Sublime Three Jewels":
                  </div>

                  <div class="mt-2 mb-4">
                    <code
                      class="tibetan"
                      style="font-size: 21px; line-height: initial;"
                    >
                      མྱ་ངན་ལས་འདས་པའི་གྲོང་ཁྱེར་དུ་འགྲོ་བ་རྣམས་ཀྱི་དེད་དཔོན།
                    </code>
                  </div>

                  <div>
                    Start by creating a new translation line. To do that
                    just click the big plus button below.
                  </div>

                </div>

                <div
                  key="break-the-line"
                  v-else-if="step == 'break-the-line'"
                >
                  <div class="mb-1">
                    Now copy-paste the Tibetan line into the card's upper
                    input (where it says <span class="tibetan">བོད་ཡིག་</span>)
                    and then press the split button <TranslatePageSplitIcon />
                  </div>

                  <v-text-field
                    variant="outlined"
                    readonly
                    hide-details
                    class="tibetan with-right-button"
                    model-value="མྱ་ངན་ལས་འདས་པའི་གྲོང་ཁྱེར་དུ་འགྲོ་བ་རྣམས་ཀྱི་དེད་དཔོན།"
                  >
                    <template v-slot:append>
                      <TranslatePageHelpDialogCopyButton
                        @click="copyToClipboard('མྱ་ངན་ལས་འདས་པའི་གྲོང་ཁྱེར་དུ་འགྲོ་བ་རྣམས་ཀྱི་དེད་དཔོན།')"
                      />
                    </template>
                  </v-text-field>
                </div>

                <div
                  key="break-the-first-card"
                  v-else-if="step == 'break-the-first-card'"
                >
                  <p>
                    As you can see the whole line has been broken down into
                    four blocks, each of them already filled with a possible
                    translation taken from the first dictionary that has a
                    definition for that particular term, in the order of
                    preference you defined in the settings.
                  </p>
                  <p>
                    You'll notice that the first and last cards also have a
                    split button. This means they can be broken further
                    down.
                  </p>
                  <p>
                    Now try to click the split button <TranslatePageSplitIcon />
                    of the first card.
                  </p>
                </div>

                <div
                  key="delete-the-first-card"
                  v-else-if="step == 'delete-the-first-card'"
                >
                  <p>
                    The first card has now been broken down into 4 four more
                    cards which have been inserted right after it.
                    The first two of them still have a split button
                    <TranslatePageSplitIcon /> which means we could break them
                    into even smaller words.
                  </p>
                  <p>
                    For now let's say we are happy with these four new
                    cards, but we feel that we don't really need that first
                    card anymore.
                  </p>
                  <p>
                    So let's remove it by clicking two times on the little
                    trashcan button <v-icon color="grey">mdi-delete</v-icon>
                    on its bottom left corner.
                  </p>
                </div>

                <div
                  key="thats-it"
                  v-else-if="step == 'thats-it'"
                >

                  <p>
                    Alright! You've got the hang of it now and are probably
                    bored with this tutorial so let's not hold you much longer.
                    Just a few last things:
                  </p>

                  <v-alert
                    variant="tonal"
                    density="compact"
                    prominent
                    type="info"
                    class="text-caption"
                  >
                    All the lines and cards can be repositioned by
                    clicking and holding on the little dots
                    <v-icon color="grey">mdi-drag</v-icon>
                    at their top left corner.
                  </v-alert>

                  <v-alert
                    variant="tonal"
                    density="compact"
                    prominent
                    type="info"
                    class="text-caption"
                  >
                    They can also be assigned a color by clicking on the
                    the color palette button
                    <v-icon color="grey">mdi-palette</v-icon>
                    <br />
                    For instance to show that a
                    line's translation is satisfactory you could paint it green,
                    or maybe yellow if you feel it still needs more work.
                  </v-alert>

                  <v-alert
                    variant="tonal"
                    density="compact"
                    prominent
                    type="info"
                    class="text-caption"
                  >
                    If you prefer to break down a card into <strong>every
                    single possible defined combination</strong> instead of
                    only the longest ones, just hold the CTRL key while
                    clicking on a <TranslatePageSplitIcon /> split button.
                    This can produce a lot of cards for long sentences so use
                    it sparingly, but it might come in handy sometimes.
                    <div class="mt-2">
                      For instance breaking down
                      <code class="tibetan">བཅོམ་ལྡན་འདས་</code>
                      will create cards not only for
                      <code class="tibetan">བཅོམ་ལྡན་</code> and
                      <code class="tibetan">འདས་</code>, but for
                      <code class="tibetan">བཅོམ་</code> and
                      <code class="tibetan">ལྡན་</code> as well.
                    </div>
                  </v-alert>

                </div>

              </v-fade-transition>

            </v-alert>

            <div
              class="demo-container rounded-b"
            >

              <v-fade-transition mode="out-in" appear>

                <v-btn
                  v-if="step == 'start'"
                  block
                  size="x-large"
                  color="primary-darken-2"
                  height="128"
                  @click="step = 'create-a-new-line'"
                >
                  Click here to start
                </v-btn>


                <TranslatePageTranslationLines
                  v-else
                  :lines="lines"
                  v-mutate="onMutate"
                />

              </v-fade-transition>

            </div>

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
