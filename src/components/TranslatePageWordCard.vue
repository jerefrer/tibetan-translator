<script>

  import $ from 'jquery'
  import SqlDatabase from '../services/sql-database'
  import TranslatePageMixins from './TranslatePageMixins'

  import TranslatePageSplitIcon from './TranslatePageSplitIcon.vue'
  import TranslatePageCardDeleteButton from './TranslatePageCardDeleteButton.vue'
  import TranslatePageCardColorPicker from './TranslatePageCardColorPicker.vue'
  import TibetanTextField from './TibetanTextField.vue'

  export default {
    mixins: [TranslatePageMixins],
    components: {
      TranslatePageSplitIcon,
      TranslatePageCardDeleteButton,
      TranslatePageCardColorPicker,
      TibetanTextField
    },
    props: {
      word: Object,
    },
    data () {
      return {
        definitions: []
      }
    },
    watch: {
      'word.source' (term) {
        term && term !== this.value && this.loadDefinitions();
      }
    },
    computed: {
      hasSubwords () {
        return this.definedWordsWithoutSelfAccordingToPreferenceFor(this.word.source).length > 1;
      }
    },
    methods: {
      isInViewport () {
        var offsetTop = $(this.$el).offset().top;
        var elementHeight = $(this.$el).outerHeight();
        var container = $(this.$el).parents('.v-dialog').get(0) || window;
        var scrollTop = $(container).scrollTop();
        return (
          (offsetTop > scrollTop) &&
          (offsetTop + elementHeight < scrollTop + $(container).height())
        )
      },
      loadDefinitions (autoPickFirstDefinition) {
        SqlDatabase.
          exec(`
            SELECT entries.*, dictionaries.name AS dictionary
            FROM entries
            INNER JOIN dictionaries ON dictionaries.id = dictionaryId
            WHERE term = ?
            AND dictionaries.enabled = 1
            ORDER BY dictionaries.position`,
            [this.word.source]
          ).
          then((rows) => {
            this.definitions = rows.map((row) => row.definition);
            if (autoPickFirstDefinition)
              this.word.translation = this.definitions[0];
          });
      },
      autoLoadDefinitions () {
        var autoPickFirstDefinition = this.$attrs['auto-pick-first-definition'] != undefined;
        if (this.isInViewport() || autoPickFirstDefinition) {
          this.loadDefinitions(autoPickFirstDefinition);
        }
      }
    },
    mounted () {
      this.$nextTick(this.autoLoadDefinitions)
    }
  }

</script>

<template>
  <v-card
    class="word"
    v-intersect.quiet="() => { loadDefinitions() }"
  >

    <div
      class="left-bar"
      :class="word.color"
    >

      <div class="word-handle">
        <v-icon>mdi-drag</v-icon>
      </div>

      <TranslatePageCardColorPicker
        size="small"
        :color="word.color"
        @change="$emit('change:color', $event)"
      />

      <TranslatePageCardDeleteButton
        size="small"
        @confirm="$emit('click:delete')"
      />

    </div>

    <v-card-text>

      <TibetanTextField
        density="compact"
        height="44"
        v-model="word.source"
        class="text-center"
        :class="{'has-button': hasSubwords }"
        @keyup.enter="$emit('click:insertDefinedWords', $event)"
      >

        <template
          v-slot:append
          v-if="hasSubwords"
        >
          <v-btn
            icon
            variant="text"
            size="small"
            title="Insert cards with sub-words"
            @click="$emit('click:insertDefinedWords', $event)"
          >
            <TranslatePageSplitIcon />
          </v-btn>
        </template>
      </TibetanTextField>

      <v-combobox
        v-if="definitions.length"
        v-model="word.translation"
        clearable
        density="compact"
        hide-details
        :items="definitions"
        class="tibetan text-center"
      />

      <v-text-field
        v-else
        density="compact"
        hide-details
        spellcheck="false"
        v-model="word.translation"
        class="tibetan translation-simple-text-field text-center"
      />

    </v-card-text>

  </v-card>
</template>
