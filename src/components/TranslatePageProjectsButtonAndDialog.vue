<script>
  import $ from 'jquery'
  import { v4 as uuid } from 'uuid'
  import moment from 'moment'
  import _ from 'underscore'
  import draggable from 'vuedraggable'
  import Timeago from 'timeago'

  import Storage from '../services/storage'
  import TranslatePageMixins from './TranslatePageMixins'
  import TranslatePageCardDeleteButton from './TranslatePageCardDeleteButton.vue'
  import TranslatePageProjectUpdateButtonWithConfirmationDialog from './TranslatePageProjectUpdateButtonWithConfirmationDialog.vue'

  export default {
    mixins: [TranslatePageMixins],
    components: {
      draggable,
      TranslatePageCardDeleteButton,
      TranslatePageProjectUpdateButtonWithConfirmationDialog
    },
    props: {
      lines: Array
    },
    data () {
      return {
        dialog: false,
        projects: Storage.get('projects') || []
      }
    },
    watch: {
      projects: {
        deep: true,
        handler (value) {
          Storage.set('projects', value);
          this.initializeTimeagos();
        }
      }
    },
    computed: {
      syncedProject () {
        return this.projects.find((project) => _.isEqual(project.lines, this.lines));
      }
    },
    methods: {
      saveProject () {
        this.projects.push({
          id: uuid(),
          name: 'New project',
          updatedAt: moment().format(),
          lines: JSON.parse(JSON.stringify(this.lines))
        })
        setTimeout(() => $(_.last(this.$refs.projectsNameFields)).select().focus(), 10);
      },
      updateProject (project) {
        project.lines = JSON.parse(JSON.stringify(this.lines));
        project.updatedAt = moment().format();
      },
      loadProject (project) {
        this.$emit('load', JSON.parse(JSON.stringify(project.lines)))
      },
      initializeTimeagos () {
        this.$nextTick(() => {
          $('.timeago').timeago();
          $('.timeago').timeago('updateFromDOM');
        });
      }
    },
    updated () {
      this.initializeTimeagos();
    }
  }
</script>

<template>
  <v-dialog
    v-model="dialog"
    class="save-dialog"
    persistent
    scrollable
    :max-width="1024"
  >

    <template v-slot:activator="{ props }">
      <v-badge
        id="save-dialog-button"
        location="bottom"
        floating
        dot
        :color="syncedProject ? 'green' : 'red'"
        :model-value="!onlyOneEmptyLine"
      >
        <v-btn
          icon
          variant="text"
          size="large"
          @click="dialog = true"
        >
          <v-icon>mdi-content-save-all</v-icon>
        </v-btn>
      </v-badge>
    </template>

    <template v-slot:default>

      <v-card>

        <v-card-title>
          On-going translations
        </v-card-title>

        <v-card-text
          class="pt-1"
        >

          <v-alert
            v-if="!syncedProject"
            color="red"
            icon="mdi-exclamation-thick"
            prominent
          >
            The current state differs from all saved translations.<br />
            You might want to save it as a new translation or update an existing one.
          </v-alert>

          <draggable
            v-model="projects"
            handle=".project-handle"
            item-key="id"
            class="projects"
          >
            <template #item="{ element: project, index: projectIndex }">

              <v-card
                class="project list-item"
              >

                <div class="project-handle">
                  <v-icon>mdi-drag</v-icon>
                </div>

                <v-card-text>

                  <v-textarea
                    rows="1"
                    auto-grow
                    hide-details
                    spellcheck="false"
                    v-model="project.name"
                    ref="projectsNameFields"
                  />

                  <div class="mt-2">
                    Updated <span class="timeago" :title="project.updatedAt" />
                  </div>

                </v-card-text>

                <v-card-actions>

                  <TranslatePageProjectUpdateButtonWithConfirmationDialog
                    :projectName="project.name"
                    :disabled="project == syncedProject"
                    @confirm="updateProject(project); dialog = false"
                  />

                  <v-spacer />

                  <v-btn
                    variant="text"
                    color="green"
                    :disabled="project == syncedProject"
                    @click="loadProject(project); dialog = false"
                  >
                    <v-icon>mdi-content-save-move</v-icon>
                    Load
                  </v-btn>

                  <v-spacer />

                  <TranslatePageCardDeleteButton
                    @confirm="projects.splice(projectIndex, 1)"
                  >
                    Remove
                  </TranslatePageCardDeleteButton>

                </v-card-actions>

                <v-progress-linear
                  v-if="project == syncedProject"
                  color="green"
                  model-value="100"
                />

              </v-card>
            </template>
          </draggable>

          <v-btn
            size="x-large"
            class="new-project list-item"
            @click="saveProject"
          >
            <v-icon size="x-large">mdi-content-save</v-icon>
            <div class="text-left ml-2">
              Save current state<br />as new translation
            </div>
          </v-btn>

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

    </template>

  </v-dialog>
</template>
