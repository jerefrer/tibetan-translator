<script>
  import draggable from 'vuedraggable'

  import TranslatePageMixins from './TranslatePageMixins'
  import TranslatePageWordCard from './TranslatePageWordCard'
  import TranslatePageSplitIcon from './TranslatePageSplitIcon'
  import TranslatePageCardColorPicker from './TranslatePageCardColorPicker'
  import TranslatePageCardDeleteButton from './TranslatePageCardDeleteButton'
  import TibetanTextField from './TibetanTextField'

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
    methods: {
      splitTextIntoDefinedLinesAndInsert (text, line, lineIndex) {
        line.loading = true;
        this.splitTextIntoDefinedLines(text).then((splitLines) => {
          var linesWithSplitLinesInserted =
            this.lines.
            removeAt(lineIndex).
            insert(splitLines, lineIndex);
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
        this.$refs.tibetanInputs && this.$refs.tibetanInputs[0].focus();
      }
    },
    mounted () {
      this.focusFirstTibetanInput();
    }
  }

</script>

<template>
  <draggable
    v-model="lines"
    handle=".line-handle"
  >

    <transition-group
      name="list"
      tag="div"
      class="lines"
    >

      <v-card
        v-for="(line, lineIndex) in lines"
        :key="line.id"
        class="line list-item"
      >

        <div
          class="left-bar"
          :class="line.color"
        >

          <div class="line-handle">
            <v-icon large>mdi-drag</v-icon>
          </div>

          <TranslatePageCardColorPicker
            :color="line.color"
            @change="line.color = $event"
          />

          <v-btn
            icon
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
          absolute
          :value="line.loading"
        >
          <v-progress-circular
            left
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
                  :key="'words-' + line.id"
                  v-if="line.opened"
                  v-model="line.words"
                  group="words"
                  handle=".word-handle"
                  class="words-container list-item"
                >

                  <transition-group
                    name="list"
                    tag="div"
                    class="words"
                  >

                    <TranslatePageWordCard
                      v-for="(word, wordIndex) in line.words"
                      :key="word.id"
                      :word="word"
                      class="list-item"
                      @click:delete="line.words.splice(wordIndex, 1)"
                      @click:insertDefinedWords="insertDefinedWords(line, word, wordIndex, $event); line.opened = true"
                      @change:color="word.color = $event"
                    />

                    <v-btn
                      key="add-word-button"
                      class="add-word-button list-item"
                      @click="line.words.push(newWord())"
                    >
                      <v-icon color="grey darken-2">mdi-plus</v-icon>
                    </v-btn>

                  </transition-group>

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

      <v-btn
        key="add-line-button"
        class="add-line-button list-item"
        @click="lines.push(newTranslationLine())"
      >
        <v-icon color="grey darken-2">mdi-plus</v-icon>
      </v-btn>

    </transition-group>

  </draggable>
</template>
