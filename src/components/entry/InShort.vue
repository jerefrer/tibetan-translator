<script>
// "In short": the glosses several dictionaries agree on, on one quiet line.
// It draws nothing when there are none (see services/in-short.js).
export default {
  name: 'InShort',
  props: {
    glosses: { type: Array, default: () => [] }
  }
};
</script>

<template>
  <section
    v-if="glosses.length"
    class="in-short"
    aria-label="In short"
    data-testid="entry-in-short"
  >
    <h2 class="in-short__label">In short</h2>
    <p class="in-short__text">{{ glosses.join(' · ') }}</p>
  </section>
</template>

<style scoped>
.in-short {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 14px 18px;
  border-radius: var(--radius-xl);
  background: var(--bg-quiet);
}
.in-short__label {
  margin: 0;
  font: 600 var(--text-caption) / 1.3 var(--font-ui);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}
.in-short__text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--text-title);
  line-height: 1.45;
  color: var(--ink);
  overflow-wrap: anywhere;
}

/* Phone: a white card on the grouped ground */
@media (max-width: 600px) {
  .in-short {
    padding: 12px 16px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }
  .in-short__text {
    font-size: var(--text-entry);
  }
}
</style>
