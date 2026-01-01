<script>
  export default {
    data () {
      return {
        clicked: false
      }
    },
    methods: {
      click () {
        clearTimeout(this.clickTimeout);
        if (this.clicked)
          this.$emit('click');
        else
          this.clicked = true;
        this.clickTimeout = setTimeout(() => this.clicked = false, 2000);
      }
    }
  }
</script>

<template>
  <v-btn
    @click="click"
    width="120"
    class="justify-start"
  >
    <v-icon
      class="mr-2"
      :icon="clicked ? 'mdi-check-bold' : 'mdi-content-copy'"
    />
    <span>{{clicked ? 'Copied!' : 'Copy'}}</span>
  </v-btn>
</template>
