<script>
import { openHelp, topicForRoute } from '../../services/help';
import { UiIcon } from '../../ui';

// "?" beside a screen's large title on a phone, where there is no sidebar:
// opens the help on the topic of the screen.
export default {
  name: 'HelpButton',
  components: { UiIcon },
  methods: {
    open() {
      openHelp(topicForRoute(this.$route));
    },
  },
};
</script>

<template>
  <button type="button" class="help-button" aria-label="Help" title="Help" data-testid="help-button" @click="open">
    <ui-icon name="circle-help" :size="24" />
  </button>
</template>

<style scoped>
.help-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-right: -10px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  color: var(--accent);
  cursor: pointer;
}
.help-button:focus-visible {
  outline: 2px solid var(--accent);
}
</style>
