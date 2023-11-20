<script>
import Storage from "../services/storage";

export default {
  props: {
    lines: Array,
  },
  data() {
    return {
      exportType: Storage.get("export-type") || "translation",
    };
  },
  watch: {
    exportType(value) {
      Storage.set("export-type", value);
    },
  },
  computed: {
    text() {
      if (this.exportType == "translation")
        return this.lines.map((line) => line.translation).join("\n");
      else if (this.exportType == "alternated")
        return _.chain(this.lines)
          .map((line) => line.source)
          .zip(this.lines.map((line) => line.translation))
          .flatten()
          .value()
          .join("\n");
    },
  },
};
</script>

<template>
  <v-dialog persistent scrollable :max-width="640">
    <template v-slot:activator="{ on, attrs }">
      <v-btn icon large id="export-dialog-button" v-bind="attrs" v-on="on">
        <v-icon>mdi-application-export</v-icon>
      </v-btn>
    </template>

    <template v-slot:default="dialog">
      <v-card>
        <v-card-title> Export </v-card-title>

        <v-card-text class="pt-1">
          <v-radio-group row v-model="exportType">
            <v-radio value="translation" label="Translation only" />
            <v-radio
              value="alternated"
              label="Tibetan alternated with translation"
            />
          </v-radio-group>

          <v-textarea auto-grow rows="21" spellcheck="false" :value="text" />
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>

          <v-btn color="grey darken-1" text @click="dialog.value = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>
