<script>
  import TestsPageGroupResult from './TestsPageGroupResult.vue'

  export default {
    components: {
      TestsPageGroupResult
    },
    props: {
      name: String,
      sentences: Boolean,
      tests: Array
    },
    data: function() {
      var passedCount = this.tests.filter((test) => test.pass).length;
      var allPassed = passedCount == this.tests.length;
      return {
        allPassed: allPassed,
        opened: allPassed,
        passedCount: passedCount,
        total: this.tests.length
      }
    }
  }
</script>

<template>
  <tr
    class="results-group"
    :class="allPassed ? 'text-green' : 'text-red'"
  >
    <td class="header" @click="opened = !opened">
      {{name}}
    </td>
    <td class="count">{{passedCount}}/{{total}}</td>
    <td class="result">
      <v-icon
        :color="allPassed ? 'green' : 'red'"
        v-text="allPassed ? 'mdi-check-bold' : 'mdi-close-thick'"
      />
    </td>
    <td>
      <TestsPageGroupResult
        v-if="!opened"
        v-for="(test, index) in tests"
        :sentence="sentences"
        :test="test"
        :key="index"
      />
    </td>
  </tr>
</template>
