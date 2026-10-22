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
    :class="allPassed ? 'results-group--passed' : 'results-group--failed'"
    data-testid="tests-group"
  >
    <td class="header" @click="opened = !opened">
      {{name}}
    </td>
    <td class="count">{{passedCount}}/{{total}}</td>
    <td class="result">{{ allPassed ? '✓' : '✗' }}</td>
    <td>
      <template v-if="!opened">
        <TestsPageGroupResult
          v-for="(test, index) in tests"
          :key="index"
          :sentence="sentences"
          :test="test"
        />
      </template>
    </td>
  </tr>
</template>

<style>
.results-group .header {
  cursor: pointer;
}
.results-group .result {
  font-weight: bold;
}
.results-group--passed {
  color: #21ba45;
}
.results-group--failed {
  color: #db2828;
}
</style>
