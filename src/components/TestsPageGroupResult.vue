<script>
  import TestsPageGroupResultDiff from './TestsPageGroupResultDiff.vue'

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
    variant="flat"
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
      :icon="test.pass ? 'mdi-check-bold' : 'mdi-close-thick'"
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
        <div class="text-blue">{{test.expected}}</div>
        <div class="text-red">{{test.value}}</div>
      </div>
    </template>
  </v-chip>
</template>
