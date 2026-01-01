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
    location="end"
    offset="0"
    color="red-darken-4"
    v-model="clicked"
  >

    <template v-slot:default>
      <span class="text-caption">Click again to confirm</span>
    </template>

    <template v-slot:activator>
      <v-btn
        variant="text"
        :icon="!$slots.default"
        v-bind="$attrs"
        class="delete-button"
        :class="{
          'bg-red-darken-4': clicked,
          'text-red': $slots.default
        }"
        @click="click"
      >
        <v-icon
          v-bind="$attrs"
          :icon="clicked ? 'mdi-help' : 'mdi-delete'"
        />
        <slot />
      </v-btn>
    </template>

  </v-tooltip>
</template>
