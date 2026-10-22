<script>
import _ from 'underscore';

import PhoneticSearchPrepareTermForLooseMatchingTests from '../../tests/phonetic-search/prepare-term-for-loose-matching.js';
import PhoneticSearchSplitSyllablesTests from '../../tests/phonetic-search/split-syllables.js';
import TestsPageGroup from './TestsPageGroup.vue';

var testGroups = [
  PhoneticSearchPrepareTermForLooseMatchingTests,
  PhoneticSearchSplitSyllablesTests,
];

// Developer page (/tests): runs the phonetic search examples in the browser.
export default {
  components: {
    TestsPageGroup,
  },
  data() {
    var startedAt = new Date().getTime();
    var passedCount = 0;
    var ranTests = testGroups.map(function (testGroup) {
      _(testGroup.tests).each(function (test) {
        test.runTest = function () {
          var method = test.method || testGroup.method;
          test.value = method(test.input);
          test.pass = _.isEqual(test.value, test.expected);
          return test.pass;
        };
        if (test.runTest()) passedCount++;
      });
      return testGroup;
    });
    var total = _.flatten(_.pluck(testGroups, 'tests')).length;
    var percentage = ((passedCount / total) * 100).toPrecision(3);
    document.title = `Tests / ${percentage}% (${passedCount}/${total})`;
    return {
      tests: ranTests,
      passedCount: passedCount,
      total: total,
      percentage: percentage,
      processTime: new Date().getTime() - startedAt,
    };
  },
  computed: {
    style: function () {
      return {
        color: this.passedCount == this.total ? '#21ba45' : '#db2828',
      };
    },
  },
};
</script>

<template>
  <div class="tests-page">
    <table class="tests-page__table">
      <thead>
        <tr>
          <td colspan="10" data-testid="tests-total">
            Total:
            <span :style="style">
              {{ percentage }}% ({{ passedCount }}/{{ total }})
            </span>
            — Ran in:
            <span>{{ processTime }}</span>
            ms
          </td>
        </tr>
      </thead>
      <tbody>
        <TestsPageGroup
          v-for="(test, index) in tests"
          :key="index"
          :name="test.name"
          :sentences="test.sentences"
          :tests="test.tests"
        />
      </tbody>
    </table>
  </div>
</template>

<style>
.tests-page {
  height: 100%;
  overflow: auto;
  padding: 16px;
  font: 14px/1.5 var(--font-ui);
  color: var(--ink);
}
.tests-page__table {
  width: 100%;
  border-collapse: collapse;
}
.tests-page__table td {
  padding: 8px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
.tests-page__table .diff {
  margin: 0 -9px 0 10px;
  padding: 4px 10px;
  font-size: 1.2em;
  border-radius: 4px;
  background: #fff;
  color: #333;
}
</style>
