<script>
import changelog from '../../../CHANGELOG.md?raw';
import '../../css/release-notes.css';
import { isMacOS } from '../../config/platform';
import { FEEDBACK_ADDRESS, openFeedbackMail } from '../../services/feedback';
import { latestReleaseNotes, renderReleaseNotes } from '../../services/release-notes-markdown';
import { UiButton, UiDialog, UiIcon } from '../../ui';

// "Welcome to the new Tibetan Translator", at the top of Define's home, once,
// for people who used the app before the redesign (services/new-look.js decides
// who). A header, a tile for each thing that moved, a link to the newest
// release notes, and a footer asking what got harder, with the address to write
// to. The shortcuts and the sidebar are the desktop's, so on a phone there is
// no sidebar tile and no keycaps, and the tiles stack in one column.
export default {
  name: 'NewLookCard',
  components: { UiButton, UiDialog, UiIcon },
  inject: ['snackbar'],
  props: {
    // The page's phone layout (MobileResponsiveMixin)
    phone: { type: Boolean, default: false },
  },
  emits: ['dismiss'],
  data() {
    return { address: FEEDBACK_ADDRESS, notesOpen: false };
  },
  computed: {
    mac() {
      return isMacOS();
    },
    // The newest version in CHANGELOG.md, null when it has none
    latest() {
      return latestReleaseNotes(changelog);
    },
    notesHtml() {
      return this.latest ? renderReleaseNotes(this.latest.markdown) : '';
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
  },
};
</script>

<template>
  <section class="new-look" aria-labelledby="new-look-title" data-testid="new-look">
    <button type="button" class="new-look__close" aria-label="Close" data-testid="new-look-close" @click="$emit('dismiss')">
      <ui-icon name="x" :size="18" />
    </button>

    <header class="new-look__header">
      <span class="new-look__badge"><ui-icon name="sparkles" :size="18" /></span>
      <div>
        <h2 id="new-look-title" class="new-look__title">Welcome to the new Tibetan Translator</h2>
        <p class="new-look__lead">Your dictionaries, glossaries and settings are just as you left them.</p>
      </div>
    </header>

    <div class="new-look__tiles" :class="{ 'new-look__tiles--phone': phone }">
      <div class="new-look__tile" data-testid="new-look-reader">
        <span class="new-look__chip"><ui-icon name="align-left" :size="18" /></span>
        <div>
          <b class="new-look__tile-title">Split is now Reader</b>
          <span class="new-look__tile-text">Paste a text, read it word by word.</span>
          <kbd v-if="!phone" class="new-look__key">{{ combo('E') }}</kbd>
        </div>
      </div>
      <div v-if="!phone" class="new-look__tile" data-testid="new-look-pages">
        <span class="new-look__chip"><ui-icon name="panel-left" :size="18" /></span>
        <div>
          <b class="new-look__tile-title">All in the sidebar</b>
          <span class="new-look__tile-text">My glossary and Dictionaries have their own pages</span>
        </div>
      </div>
      <div class="new-look__tile" data-testid="new-look-keys">
        <span class="new-look__chip"><ui-icon name="arrow-left-right" :size="18" /></span>
        <div>
          <b class="new-look__tile-title">Back and Forward</b>
          <span class="new-look__tile-text">{{ phone ? 'Return where you were, with Back.' : 'Return where you were.' }}</span>
          <template v-if="!phone">
            <kbd class="new-look__key">{{ combo('[') }}</kbd> <kbd class="new-look__key">{{ combo(']') }}</kbd>
          </template>
        </div>
      </div>
      <div class="new-look__tile" data-testid="new-look-saved">
        <span class="new-look__chip"><ui-icon name="bookmark" :size="18" /></span>
        <div>
          <b class="new-look__tile-title">Recent and Saved</b>
          <span class="new-look__tile-text">The terms you looked up, and those you keep</span>
        </div>
      </div>
    </div>

    <button v-if="latest" type="button" class="new-look__all" data-testid="new-look-all" @click="notesOpen = true">
      Everything that's new →
    </button>

    <footer class="new-look__footer">
      <span class="new-look__chip new-look__chip--small"><ui-icon name="mail" :size="16" /></span>
      <p class="new-look__ask">
        Something harder than before, missing or broken?
        <small><span class="new-look__address">{{ address }}</span><br>Every message is read.</small>
      </p>
      <ui-button size="sm" class="new-look__send" data-testid="new-look-send" @click="sendFeedback">Send feedback</ui-button>
    </footer>

    <ui-dialog v-if="latest" v-model="notesOpen" :title="'What\'s new in v' + latest.version" :max-width="560">
      <div v-if="notesHtml" class="release-notes" data-testid="new-look-notes" v-html="notesHtml" />
      <template #actions>
        <ui-button variant="ghost" data-testid="new-look-notes-close" @click="notesOpen = false">Close</ui-button>
      </template>
    </ui-dialog>
  </section>
</template>

<style scoped>
.new-look {
  position: relative;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  font-family: var(--font-ui);
  color: var(--ink);
  line-height: 1.4;
}

.new-look__close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--faint);
  cursor: pointer;
}

.new-look__close:hover {
  background: var(--soft);
  color: var(--ink);
}

.new-look__close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.new-look__header {
  display: flex;
  align-items: center;
  gap: 14px;
  /* Right padding keeps the title clear of the close button */
  padding: 20px 52px 16px 22px;
  background: linear-gradient(180deg, var(--accent-soft), var(--surface));
}

.new-look__badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--on-accent);
}

.new-look__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.new-look__lead {
  margin: 3px 0 0;
  font-size: var(--text-sm);
  color: var(--muted);
}

.new-look__tiles {
  display: grid;
  /* Two columns only where each tile has room; one in a narrow entry pane */
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 10px;
  padding: 4px 22px 14px;
}

.new-look__tiles--phone {
  grid-template-columns: 1fr;
}

.new-look__tile {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 12px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background: var(--bg-quiet);
}

.new-look__chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: var(--surface);
  color: var(--accent);
}

.new-look__chip--small {
  width: 30px;
  height: 30px;
}

.new-look__tile-title {
  display: block;
  margin: 1px 0 3px;
  font-size: var(--text-sm);
  font-weight: 600;
}

.new-look__tile-text {
  display: block;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--muted);
  /* A few words: lines of even length */
  text-wrap: balance;
}

.new-look__key {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 5px;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--surface);
  font: 600 10.5px/1 var(--font-ui);
  color: var(--ink);
  white-space: nowrap;
}

.new-look__all {
  display: block;
  margin: 0 22px 16px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: var(--text-sm) var(--font-ui);
  text-align: left;
  cursor: pointer;
}

.new-look__all:hover {
  text-decoration: underline;
}

.new-look__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 22px;
  border-top: 1px solid var(--line);
  background: var(--bg-quiet);
}

.new-look__ask {
  /* Too narrow for this and the button (a phone): the button goes under it */
  flex: 1 1 13rem;
  margin: 0;
  /* No word left alone on the question's last line */
  text-wrap: pretty;
  font-size: var(--text-sm);
}

.new-look__ask small {
  display: block;
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--faint);
}

.new-look__address {
  white-space: nowrap;
}

.new-look__send {
  flex: none;
  margin-left: auto;
}
</style>
