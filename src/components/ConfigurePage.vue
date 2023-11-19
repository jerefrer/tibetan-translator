<script>
  import draggable from 'vuedraggable'

  import SqlDatabase from '../services/sql-database'

  export default {
    components: {
      draggable
    },
    data () {
      return {
        dictionaries: JSON.parse(JSON.stringify(SqlDatabase.dictionaries))
      }
    },
    watch: {
      dictionaries: {
        deep: true,
        handler (value) {
          this.dictionaries.each((dictionary, index) => {
            SqlDatabase.exec(
              'UPDATE dictionaries SET position = ?, enabled = ? WHERE id = ?',
              [index + 1, dictionary.enabled ? 1 : 0, dictionary.id]
            );
          });
        }
      }
    },
    created () {
      document.title = 'Translator / Configure';
    }
  }
</script>

<template>
  <v-container
    class="configure-page"
  >

    <v-card
      class="dictionaries-container"
    >

      <v-toolbar
        elevation="1"
      >
        <v-icon
          x-large
          color="grey"
        >
          mdi-book-multiple
        </v-icon>
        <v-toolbar-title>
          Dictionaries
          <div class="caption grey--text">
            Reorder or disable them to match your preferences
          </div>
        </v-toolbar-title>
      </v-toolbar>

      <draggable
        v-model="dictionaries"
        handle=".handle"
      >

        <transition-group
          name="list"
          tag="div"
          class="dictionaries"
        >

          <div
            v-for="(dictionary, index) in dictionaries"
            :key="dictionary.id"
            class="dictionary list-item"
            :class="{
              disabled: !dictionary.enabled
            }"
          >

            <v-icon
              class="handle"
              color="grey darken-2"
            >
              mdi-drag-horizontal-variant
            </v-icon>

            <div
              class="name"
            >
              <span class="grey--text text--darken-1">{{index + 1}}.</span>
              {{dictionary.name}}
            </div>

            <v-switch
              v-model="dictionary.enabled"
              hide-details
              class="switch"
            />

          </div>

        </transition-group>

      </draggable>

    </v-card>

  </v-container>
</template>

<style>
  .configure-page {
    margin-top: 30px;
  }

    .configure-page .dictionaries-container {
      width: 100%;
    }

      .configure-page .dictionaries-container .v-toolbar .v-icon {
        margin: 0 10px 0 -4px;
      }

      .configure-page .dictionaries-container .v-toolbar__title,
      .configure-page .dictionaries-container .v-toolbar__title .caption {
        line-height: 1em;
      }
      .configure-page .dictionaries-container .v-toolbar__title .caption {
        margin-top: 5px;
      }

      .configure-page .dictionaries {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax( min(360px, 100%), 1fr ));
      }

        .configure-page .dictionaries .dictionary {
          display: flex;
        }
        .configure-page .dictionaries .dictionary.disabled .v-icon:before,
        .configure-page .dictionaries .dictionary.disabled .switch .v-input__control {
          opacity: 0.25;
        }
        .configure-page .dictionaries .dictionary.disabled > .name {
          color: #525252;
        }

          .configure-page .dictionaries .dictionary > * {
            display: table-cell;
            padding: 8px;
            border-bottom: thin solid rgba(255, 255, 255, 0.12);
          }
          .configure-page .dictionaries .dictionary:last-child > * {
            border-bottom: none;
          }
          .configure-page .dictionaries .dictionary .handle {
            width: 54px;
            text-align: center;
            cursor: move;
          }
          .configure-page .dictionaries .dictionary .v-icon:before,
          .configure-page .dictionaries .dictionary .name,
          .configure-page .dictionaries .dictionary.disabled .switch .v-input__control {
            transition: all 1s;
          }
          .configure-page .dictionaries .dictionary > .name {
            flex: 1;
          }
          .configure-page .dictionaries .dictionary > .switch {
            margin: 0;
          }

    .configure-page .database-reinitialization .v-toolbar .v-icon {
      margin: 0 9px 0 -6px;
    }
      .configure-page .database-reinitialization .fd-zone {
        width: 100%;
      }
        .configure-page .database-reinitialization .fd-zone > div:not(.dndtxt),
        .configure-page .database-reinitialization .fd-zone > div:not(.dndtxt) form,
        .configure-page .database-reinitialization .fd-zone > div:not(.dndtxt) form input {
          position: absolute !important;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          margin: 0;
        }
        .configure-page .database-reinitialization .fd-zone > div:not(.dndtxt) form {
          margin-top: -30px;
        }
</style>
