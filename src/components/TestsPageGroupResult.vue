<script>
  import TestsPageGroupResultDiff from './TestsPageGroupResultDiff.vue'

  export default {
    components: {
      TestsPageGroupResultDiff
    },
    props: {
      test: Object,
      sentence: Boolean
    }
  }
</script>

<template>
  <button
    type="button"
    class="test"
    :class="test.pass ? 'test--passed' : 'test--failed'"
    :style="{ display: sentence ? 'block' : 'inline-block' }"
    data-testid="tests-result"
    @click="test.runTest()"
  >
    {{ test.pass ? '✓' : '✗' }}
    <template v-if="!test.pass && test.value">
      <TestsPageGroupResultDiff
        v-if="typeof(test.value) == 'string'"
        :expected="test.expected"
        :actual="test.value"
      />
      <div
        v-else
      >
        <div class="test__expected">{{test.expected}}</div>
        <div class="test__actual">{{test.value}}</div>
      </div>
    </template>
  </button>
</template>

<style>
.test {
  margin: 4px;
  padding: 2px 10px;
  border: 0;
  border-radius: 12px;
  color: white;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.test--passed {
  background: #1b5e20;
}
.test--failed {
  background: #740505;
}
.test__expected {
  color: #64b5f6;
}
.test__actual {
  color: #ef9a9a;
}
</style>
