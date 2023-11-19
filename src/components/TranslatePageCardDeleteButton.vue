<script>
  export default {
    inheritAttrs: false,
    data: function() {
      return {
        clicked: false
      }
    },
    methods: {
      click: function() {
        if (!this.clicked) {
          this.clicked = true;
          setTimeout(() => this.clicked = false, 3000);
        }
        else this.$emit('confirm');
      }
    }
  }
</script>

<template>
  <v-tooltip
    content-class="caption"
    right
    nudge-left="6"
    offset="0"
    color="red darken-4"
    v-model="clicked"
  >

    <span>Click again to confirm</span>

    <template v-slot:activator="{ on, attrs }">
      <v-btn
        :text="!!$slots.default"
        :icon="!$slots.default"
        v-bind="Object.assign({}, attrs, $attrs)"
        class="delete-button"
        :class="{
          'red darken-4': clicked,
          'red--text': $slots.default
        }"
        @click="click"
      >
        <v-icon
          v-bind="$attrs"
          v-text="clicked ? 'mdi-help' : 'mdi-delete'"
        />
        <slot />
      </v-btn>
    </template>

  </v-tooltip>
</template>
