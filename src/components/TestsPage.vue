<script>
  import $ from 'jquery'
  import _ from 'underscore'

  import TestsPageGroup from './TestsPageGroup'
  import PhoneticSearchPrepareTermForLooseMatchingTests from '../../tests/phonetic-search/prepare-term-for-loose-matching.js'
  import PhoneticSearchSplitSyllablesTests from '../../tests/phonetic-search/split-syllables.js'
  import WordSplittingTests from '../../tests/word-splitting.js'

  var testGroups = [
    PhoneticSearchPrepareTermForLooseMatchingTests,
    PhoneticSearchSplitSyllablesTests,
    WordSplittingTests
  ];

  export default {
    components: {
      TestsPageGroup
    },
    data () {
      var passedCount = 0;
      var ranTests = testGroups.map(function(testGroup) {
        _(testGroup.tests).each(function(test) {
          test.runTest = function() {
            var method = (test.method || testGroup.method);
            test.value = method(test.input);
            return _.isEqual(test.value, test.expected);
          }
          test.pass = test.runTest();
          if (test.pass) passedCount++;
        })
        return testGroup;
      });
      this.processTime = new Date().getTime() - this.startedAt;
      var total = _(testGroups).pluck('tests').flatten().length;
      var percentage = (passedCount / total * 100).toPrecision(3);
      document.title = `Tests / ${percentage}% (${passedCount}/${total})`;
      return {
        tests: ranTests,
        passedCount: passedCount,
        total: total,
        percentage: percentage,
      };
    },
    computed: {
      style: function() {
        return {
          color: (this.passedCount == this.total) ? '#21ba45' : '#db2828'
        }
      }
    },
    beforeCreate() {
      this.startedAt = new Date().getTime();
    },
    mounted () {
      $(this.$refs.time).text(this.processTime);
    }
  }
</script>

<template>
  <div>
    <v-simple-table>
      <thead
        style="background: #fff1;"
      >
        <tr>
          <td class="ui header" colspan="10">
            Total:
            <span :style="style">
              {{percentage}}%
              ({{passedCount}}/{{total}})
            </span>
             —
            Ran in: <span ref="time"></span>ms
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
    </v-simple-table>
  </div>
</template>

<style>
  .diff {
    margin: 0 -9px 0 10px;
    padding: 4px 10px;
    font-size: 1.2em;
    border-radius: 4px;
  }
</style>
