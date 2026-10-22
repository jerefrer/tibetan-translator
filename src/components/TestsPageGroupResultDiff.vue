<script>
  // Character diff between the expected and the actual value (longest common
  // subsequence), as parts { value, added, removed }.
  export function diffChars(expected, actual) {
    var a = Array.from(expected), b = Array.from(actual);
    var lengths = a.map(() => new Array(b.length + 1).fill(0));
    lengths.push(new Array(b.length + 1).fill(0));
    for (var i = a.length - 1; i >= 0; i--)
      for (var j = b.length - 1; j >= 0; j--)
        lengths[i][j] = a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    var parts = [];
    var push = (value, kind) => {
      var last = parts[parts.length - 1];
      if (last && !!last.added === (kind === 'added') && !!last.removed === (kind === 'removed'))
        last.value += value;
      else
        parts.push({ value, added: kind === 'added', removed: kind === 'removed' });
    };
    i = 0; j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) { push(a[i], null); i++; j++; }
      else if (j < b.length && (i >= a.length || lengths[i][j + 1] >= lengths[i + 1][j])) { push(b[j], 'added'); j++; }
      else { push(a[i], 'removed'); i++; }
    }
    return parts;
  }

  export default {
    props: {
      expected: String,
      actual: String
    },
    computed: {
      parts: function() {
        return diffChars(this.expected, this.actual);
      }
    }
  }
</script>

<template>
  <span class="diff">
    <span
      v-for="(part, index) in parts"
      :key="index"
      :style="[
        part.added ? {color: '#2185d0', 'font-weight': 'bold'} : '',
        part.removed ? {color: '#db2828', 'font-weight': 'bold'} : ''
      ]"
    >
      {{part.added || part.removed ? part.value && part.value.replace(/ /, '_') : part.value}}
    </span>
  </span>
</template>
