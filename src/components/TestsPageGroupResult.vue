<script>
  import TestsPageGroupResultDiff from './TestsPageGroupResultDiff'

  export default {
    components: {
      TestsPageGroupResultDiff
    },
    props: {
      test: Object,
      sentence: Boolean
    },
    computed: {
      expected: function() {
        return this.test.transliteration;
      },
      actual: function() {
        return this.test.transliterated;
      }
    }
  }
</script>

<template>
  <v-chip
    label
    class="test ma-1"
    :style="{
      display: sentence ? 'block' : 'inline-block',
      height: 'auto',
      backgroundColor: test.pass ? '#1b5e20!important' : '#740505!important'
    }"
    @click="test.runTest()"
  >
    <v-icon
      :color="test.pass ? 'green' : 'red'"
      v-text="test.pass ? 'mdi-check-bold' : 'mdi-close-thick'"
    />
    <template v-if="!test.pass && test.value">
      <TestsPageGroupResultDiff
        v-if="typeof(test.value) == 'string'"
        :expected="test.expected"
        :actual="test.value"
      />
      <div
        v-else
      >
        <div class="blue--text">{{test.expected}}</div>
        <div class="red--text">{{test.value}}</div>
      </div>
    </template>
  </v-chip>
</template>
