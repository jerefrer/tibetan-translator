<script>
  import JsDiff from 'jsdiff'

  export default {
    props: {
      expected: String,
      actual: String
    },
    computed: {
      parts: function() {
        return JsDiff.diffChars(this.expected, this.actual);
      }
    }
  }
</script>

<template>
  <span class="diff">
    <span
      v-for="part in parts"
      :style="[
        part.added ? {color: '#2185d0', 'font-weight': 'bold'} : '',
        part.removed ? {color: '#db2828', 'font-weight': 'bold'} : ''
      ]"
    >
      {{part.added || part.removed ? part.value && part.value.replace(/ /, '_') : part.value}}
    </span>
  </span>
</template>
