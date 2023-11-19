<script>
  import _ from 'underscore'

  import Storage from '../services/storage'
  import EventHandlers from '../services/event-handlers'

  import TranslatePageMixins from './TranslatePageMixins'
  import PasteTextDialog from './TranslatePagePasteTextDialog'
  import ExportDialog from './TranslatePageExportDialog'
  import ProjectsButtonAndDialog from './TranslatePageProjectsButtonAndDialog'
  import EraseButton from './TranslatePageEraseButton'
  import TranslationLines from './TranslatePageTranslationLines'

  export default {
    mixins: [TranslatePageMixins],
    components: {
      PasteTextDialog,
      ExportDialog,
      ProjectsButtonAndDialog,
      EraseButton,
      TranslationLines
    },
    data () {
      return {
        lines: Storage.get('lines') || [this.newTranslationLine()],
        loading: false
      }
    },
    watch: {
      lines: {
        deep: true,
        handler (value) {
          Storage.set('lines', value);
        }
      }
    },
    computed: {
      projectIsUnsaved () {
        var projects = Storage.get('projects');
        if (projects)
          return !projects.find(
            (project) => _.isEqual(project.lines, this.lines)
          );
        else
          return true;
      }
    },
    methods: {
      processPastedText (text) {
        this.loading = true;
        this.splitTextIntoDefinedLines(text).then((lines) => {
          this.lines = lines;
          this.loading = false;
        })
      },
      setAllLinesOpenStateTo (value) {
        _(this.lines).each((line) => line.opened = value);
      }
    },
    mounted () {
      document.title = 'Translator / Translate';
      var lastScroll = Storage.get('scroll');
      if (lastScroll)
        window.scroll(0, lastScroll);
      EventHandlers.add({
        id: 'scroll',
        type: 'scroll',
        callback: _.throttle(() => Storage.set('scroll', window.scrollY), 100)
      });
    },
    beforeDestroy () {
      EventHandlers.remove('scroll');
    }
  }
</script>

<template>
  <div
    class="translate-page px-2 pb-2"
  >

    <v-overlay
      :value="loading"
    >
      <v-progress-circular
        indeterminate
        size="64"
      />
    </v-overlay>

    <div
      class="icons-menu"
    >

      <PasteTextDialog
        @confirm="processPastedText($event)"
      />

      <ExportDialog
        :lines="lines"
      />

      <v-spacer />

      <ProjectsButtonAndDialog
        :lines="lines"
        @load="lines = $event"
      />

      <EraseButton
        :disabled="onlyOneEmptyLine"
        :doConfirm="projectIsUnsaved"
        @confirm="lines = [newTranslationLine()]"
      />

      <v-spacer />

      <v-btn
        icon large
        id="open-all-lines-button"
        title="Open all"
        :disabled="lines.all((line) => line.opened)"
        @click="setAllLinesOpenStateTo(true)"
      >
        <v-icon>mdi-arrow-split-horizontal</v-icon>
      </v-btn>

      <v-btn
        icon large
        id="close-all-lines-button"
        title="Close all"
        :disabled="lines.all((line) => !line.opened)"
        @click="setAllLinesOpenStateTo(false)"
      >
        <v-icon>mdi-arrow-collapse-vertical</v-icon>
      </v-btn>

    </div>

    <TranslationLines
      :lines="lines"
      @paste:multiple="lines = $event"
    />

  </div>
</template>

<style>
  .translate-page {
    padding-top: 15px;
  }

  .translate-page .icons-menu {
    position: fixed;
    top: calc(63px + 15px);
    bottom: 15px;
    right: 15px;
    display: flex;
    flex-direction: column;
  }

    #save-dialog-button .v-badge__wrapper {
      top: auto;
      left: auto;
      bottom: 5px;
      right: 5px;
    }

  .left-bar {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 4px;
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    border-bottom-left-radius: 4px !important;
    border-top-left-radius: 4px !important;
  }

    .left-bar .line-handle,
    .left-bar .word-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: move;
    }

    .left-bar .reveal-definitions-button {
    }

      .left-bar .reveal-definitions-button i::before {
        transition: transform 0.3s ease-in-out;
      }

    .delete-button {
    }

  .lines {
    position: relative;
    margin: 10px 65px 10px 10px;
  }

  .line {
    display: flex;
    position: relative;
    width: 100%;
    margin-bottom: 2em;
  }
    .theme--light .line {
      background-color: #fbfbfb;
    }

    .line-handle {
      width: 36px;
      height: 36px;
    }

    .line-source.v-input {
      padding: 0;
    }
      .line-source.v-input input[type=text] {
        height: 54px !important;
        line-height: 54px !important;
        font-size: 24px !important;
      }

    .line-translation .v-input textarea {
      font-size: 16px;
      line-height: 24px;
    }

    /* To still be centered compared to the source with an appended button */
    .line-translation .v-text-field__slot {
      margin-right: 40px;
    }
    .add-line-button {
      padding-right: 60px !important;
    }

    .words-container {
      width: 100%;
    }

    .words {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax( min(330px, 100%), 1fr ));
      grid-auto-rows: minmax(86px, auto);
      grid-gap: 5px;
      margin: 20px 0 0;
    }

      .word {
        display: flex;
      }

      .theme--light .word {
        background-color: #f5f5f5 !important;
      }
      .theme--dark .word {
        background-color: #2f2f2f !important;
      }

        .word-handle {
          width: 28px;
          height: 28px;
        }

        .word .v-card__text {
          padding-left: 10px;
        }

        .word input {
          font-size: 0.8125rem
        }

        .word .tibetan.has-button .v-input__append-inner {
          margin-right: -6px;
        }
        .word .v-autocomplete .v-input__append-inner {
          cursor: pointer;
        }
        /* To prevent the sudden change of style when going from autocomplete to simple text field */
        .word .tibetan:not(.has-button) .v-text-field__slot,
        .word .translation-simple-text-field .v-text-field__slot {
          margin-right: 32px;
        }
        /* */
        .word .tibetan .v-text-field__slot textarea {
          resize: none;
        }
        .word .v-autocomplete input,
        .word .translation-simple-text-field .v-text-field__slot input {
          height: 30px !important;
          font-size: 13px !important;
          line-height: 30px !important;
          letter-spacing: -0.3px;
        }

        .theme--dark .v-input__slot:before {
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

      .add-word-button {
        height: 100% !important;
        min-height: 102px;
      }

    .add-line-button {
      width: 100%;
      height: 128px !important;
    }
    .add-line-button .v-icon,
    .add-word-button .v-icon {
      font-size: 32px;
    }

    .theme--light .add-line-button.v-btn.v-btn--has-bg,
    .theme--light .add-word-button.v-btn.v-btn--has-bg {
      background-color: #dbdbdb;
    }
    .theme--dark .add-word-button.v-btn.v-btn--has-bg {
      background-color: #3a3a3a;
    }

  .projects {
    display: grid;
    grid-template-columns: repeat(auto-fill,minmax(300px, 1fr));
    grid-gap: 1em;
    grid-auto-rows: minmax(162px, auto);
  }

    .theme--light .projects .project {
      background-color: #fbfbfb;
    }
    .theme--dark .projects .project {
      background-color: #272727;
    }

      .projects .project-handle {
        position: absolute;
        top: 0;
        left: 0;
        padding: 4px;
        cursor: move;
      }

    .projects .new-project {
      height: auto !important;
    }

  .color-picker-button i,
  .reveal-definitions-button i,
  .line-handle i,
  .word-handle i,
  .project-handle i,
  .definition-handle i,
  .delete-button i {
    color: #bbb !important;
  }
  .theme--dark .color-picker-button i,
  .theme--dark .reveal-definitions-button i,
  .theme--dark .line-handle i,
  .theme--dark .word-handle i,
  .theme--dark .project-handle i,
  .theme--dark .definition-handle i,
  .theme--dark .delete-button i {
    color: #444 !important;
  }

  .theme--dark .v-autocomplete__content .v-list {
    background: #0e0e0e;
  }

  .delete-button.red--text i {
    color: #F44336 !important;
  }
</style>
