<script>
  import draggable from 'vuedraggable'

  import TranslatePageMixins from './TranslatePageMixins'
  import TranslatePageWordCard from './TranslatePageWordCard.vue'
  import TranslatePageSplitIcon from './TranslatePageSplitIcon.vue'
  import TranslatePageCardColorPicker from './TranslatePageCardColorPicker.vue'
  import TranslatePageCardDeleteButton from './TranslatePageCardDeleteButton.vue'
  import TibetanTextField from './TibetanTextField.vue'

  export default {
    mixins: [TranslatePageMixins],
    components: {
      draggable,
      TranslatePageWordCard,
      TranslatePageSplitIcon,
      TranslatePageCardColorPicker,
      TranslatePageCardDeleteButton,
      TibetanTextField
    },
    props: {
      lines: Array
    },
    emits: ['update:lines'],
    computed: {
      localLines: {
        get() {
          return this.lines;
        },
        set(value) {
          this.$emit('update:lines', value);
        }
      }
    },
    methods: {
      splitTextIntoDefinedLinesAndInsert (text, line, lineIndex) {
        line.loading = true;
        this.splitTextIntoDefinedLines(text).then((splitLines) => {
          var linesWithSplitLinesInserted = this.lines.slice();
          linesWithSplitLinesInserted.splice(lineIndex, 1);
          linesWithSplitLinesInserted.splice(lineIndex, 0, ...splitLines);
          this.$emit('paste:multiple', linesWithSplitLinesInserted);
          line.loading = false;
        })
      },
      autoGenerateCardsFor (line, event) {
        line.loading = true;
        line.words = this.definedWordsAccordingToPreferenceFor(
          line.source,
          { keepEveryCombination: event.ctrlKey }
        );
        line.opened = true;
        this.fillInTranslationWithFirstDefinitionFor(line.words).
          then(() => line.loading = false);
      },
      insertDefinedWords (line, word, wordIndex, event) {
        line.loading = true;
        var definedWords = this.definedWordsWithoutSelfAccordingToPreferenceFor(
          word.source,
          { keepEveryCombination: event.ctrlKey }
        );
        this.fillInTranslationWithFirstDefinitionFor(definedWords)
          .then((definedWords) => {
            line.words =
              line.words
              .slice(0, wordIndex + 1)
              .concat(definedWords)
              .concat(line.words.slice(wordIndex + 1))
            line.loading = false;
          })
      },
      focusFirstTibetanInput () {
        const inputs = this.$refs.tibetanInputs;
        if (inputs && inputs.length > 0 && inputs[0] && inputs[0].focus) {
          inputs[0].focus();
        }
      }
    },
    mounted () {
      this.focusFirstTibetanInput();
    }
  }

</script>

<template>
  <draggable
    v-model="localLines"
    handle=".line-handle"
    item-key="id"
    class="lines"
  >
    <template #item="{ element: line, index: lineIndex }">

      <v-card
        class="line list-item"
      >

        <div
          class="left-bar"
          :class="line.color"
        >

          <div class="line-handle">
            <v-icon size="large">mdi-drag</v-icon>
          </div>

          <TranslatePageCardColorPicker
            :color="line.color"
            @change="line.color = $event"
          />

          <v-btn
            icon
            variant="text"
            class="reveal-definitions-button"
            @click="line.opened = !line.opened"
          >
            <v-icon
              :class="{ 'mdi-rotate-90': line.opened }"
            >
              mdi-chevron-right
            </v-icon>
          </v-btn>

          <TranslatePageCardDeleteButton
            @confirm="lines.splice(lineIndex, 1)"
          />

        </div>

        <v-overlay
          contained
          :model-value="line.loading"
          class="align-center justify-center"
        >
          <v-progress-circular
            indeterminate
            size="64"
          />
        </v-overlay>

        <v-card-text>

          <transition-group
            name="list"
            tag="div"
          >

            <TibetanTextField
              ref="tibetanInputs"
              :key="'source-' + line.id"
              v-model="line.source"
              class="line-source text-center list-item"
              @keyup.enter="autoGenerateCardsFor(line, $event)"
              @paste:multiple="splitTextIntoDefinedLinesAndInsert($event, line, lineIndex)"
            >
              <template v-slot:append>
                <v-btn
                  icon
                  variant="text"
                  :disabled="!line.source"
                  title="Auto-generates cards with words and definitions (will remove existing cards)"
                  @click="autoGenerateCardsFor(line, $event)"
                >
                  <TranslatePageSplitIcon />
                </v-btn>
              </template>
            </TibetanTextField>

            <div
              key="words"
            >

              <v-expand-transition
                tag="div"
              >

                <draggable
                  v-if="line.opened"
                  v-model="line.words"
                  group="words"
                  handle=".word-handle"
                  item-key="id"
                  class="words-container words list-item"
                >
                  <template #item="{ element: word, index: wordIndex }">
                    <TranslatePageWordCard
                      :word="word"
                      class="list-item"
                      @click:delete="line.words.splice(wordIndex, 1)"
                      @click:insertDefinedWords="insertDefinedWords(line, word, wordIndex, $event); line.opened = true"
                      @change:color="word.color = $event"
                    />
                  </template>
                  <template #footer>
                    <v-btn
                      class="add-word-button list-item"
                      @click="line.words.push(newWord())"
                    >
                      <v-icon color="grey-darken-2">mdi-plus</v-icon>
                    </v-btn>
                  </template>
                </draggable>

              </v-expand-transition>

            </div>

            <div
              :key="'translation-' + line.id"
              class="line-translation text-center list-item"
            >

              <v-textarea
                rows="1"
                auto-grow
                hide-details
                class="tibetan"
                spellcheck="false"
                v-model="line.translation"
                placeholder="Translation"
              />

            </div>

          </transition-group>

        </v-card-text>

      </v-card>
    </template>
    <template #footer>
      <v-btn
        class="add-line-button list-item"
        @click="lines.push(newTranslationLine())"
      >
        <v-icon color="grey-darken-2">mdi-plus</v-icon>
      </v-btn>
    </template>
  </draggable>
</template>
