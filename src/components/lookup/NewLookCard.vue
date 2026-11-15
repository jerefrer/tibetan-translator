<script>
import { isMacOS } from '../../config/platform';
import { writeToClipboard } from '../../services/copy-service';
import { FEEDBACK_ADDRESS, openFeedbackMail } from '../../services/feedback';
import { UiButton, UiIcon } from '../../ui';

// "A new look", at the top of Define's home, once, for people who used the
// app before the redesign (services/new-look.js decides who). It says what
// moved and asks what got harder, with the address to write to. The shortcuts
// and the sidebar are the desktop's, so on a phone the list is one line.
export default {
  name: 'NewLookCard',
  components: { UiButton, UiIcon },
  inject: ['snackbar'],
  props: {
    // The page's phone layout (MobileResponsiveMixin)
    phone: { type: Boolean, default: false },
  },
  emits: ['dismiss'],
  data() {
    return { address: FEEDBACK_ADDRESS };
  },
  computed: {
    mac() {
      return isMacOS();
    },
  },
  methods: {
    // ⌘1 on a Mac, Ctrl+1 elsewhere
    combo(key) {
      return this.mac ? '⌘' + key : 'Ctrl+' + key;
    },
    async sendFeedback() {
      try {
        await openFeedbackMail();
      } catch (e) {
        this.snackbar.open('Could not open your mail app. Copy the address instead.');
        console.error('Opening the feedback mail failed:', e);
      }
    },
    async copyAddress() {
      try {
        await writeToClipboard(FEEDBACK_ADDRESS);
        this.snackbar.open('Address copied');
      } catch (e) {
        this.snackbar.open('Could not copy the address');
        console.error('Copying the feedback address failed:', e);
      }
    },
  },
};
</script>

<template>
  <section class="new-look" aria-labelledby="new-look-title" data-testid="new-look">
    <button type="button" class="new-look__close" aria-label="Close" data-testid="new-look-close" @click="$emit('dismiss')">
      <ui-icon name="x" :size="16" />
    </button>
    <h2 id="new-look-title" class="new-look__title">A new look</h2>
    <ul class="new-look__list">
      <li data-testid="new-look-reader">
        Split is now <b>Reader</b><template v-if="!phone">, on <kbd class="new-look__key">{{ combo('E') }}</kbd></template>.
      </li>
      <li v-if="!phone" data-testid="new-look-pages">
        <b>My glossary</b> and <b>Dictionaries</b> (packs, which are on, their order) have their own pages in the sidebar, out of Settings.
      </li>
      <li v-if="!phone" data-testid="new-look-keys">
        <kbd class="new-look__key">{{ combo('1') }}</kbd> <kbd class="new-look__key">{{ combo('2') }}</kbd> <kbd class="new-look__key">{{ combo('3') }}</kbd>
        switch between Define, Search and Reader; <kbd class="new-look__key">{{ combo('[') }}</kbd> and <kbd class="new-look__key">{{ combo(']') }}</kbd> go back and forward.
      </li>
    </ul>
    <p class="new-look__question">Is something harder than before, missing, or not working? Every message is read.</p>
    <div class="new-look__actions">
      <ui-button size="sm" data-testid="new-look-send" @click="sendFeedback">Send feedback</ui-button>
      <span class="new-look__address">{{ address }}</span>
      <ui-button variant="outline" size="sm" data-testid="new-look-copy" @click="copyAddress">Copy</ui-button>
    </div>
  </section>
</template>

<style scoped>
.new-look {
  position: relative;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: var(--radius-group);
  background: var(--bg-quiet);
  padding: var(--space-4) var(--space-5);
  font-family: var(--font-ui);
  color: var(--ink);
}

.new-look__close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--faint);
  cursor: pointer;
}

.new-look__close:hover {
  background: var(--line-soft);
  color: var(--ink);
}

.new-look__close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.new-look__title {
  margin: 0 var(--space-6) var(--space-2) 0;
  font-size: var(--text-md);
  font-weight: 600;
}

.new-look__list {
  margin: 0 0 var(--space-3);
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  line-height: 1.6;
}

.new-look__list b {
  font-weight: 600;
}

.new-look__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 5px;
  box-sizing: border-box;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  background: var(--surface);
  font: 600 var(--text-xs) var(--font-ui);
  color: var(--ink);
}

.new-look__question {
  margin: 0 0 var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--line);
  font-size: var(--text-sm);
  line-height: 1.6;
}

.new-look__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.new-look__address {
  font-size: var(--text-sm);
  color: var(--faint);
  overflow-wrap: anywhere;
}
</style>
