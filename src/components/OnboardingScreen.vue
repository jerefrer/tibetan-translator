<script>
import PackManager from '../services/pack-manager';
import DictionariesDetails from '../services/dictionaries-details';
import GlobalLookup from '../services/global-lookup';
import db from '../services/sql-database';
import { getPackHighlights } from '../services/dictionary-catalog';
import { PACK_DEFINITIONS, getRequiredPackIds, getOptionalPackIds } from '../config/pack-definitions';
import { isTauri, isMobile, isMacOS } from '../config/platform';
import { UiAlert, UiButton, UiCheckbox, UiIcon, UiProgress } from '../ui';

// Named in the welcome text; the core pack has no `highlights` of its own
const CORE_HIGHLIGHTS = ['RangjungYeshe', 'Hopkins2015', 'Berzin'];

const DOWNLOAD_ERROR = 'Download failed. Please check your internet connection.';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

// "65 MB download, 285 MB installed" -> { download: 65, installed: 285 }
export function parsePackSize(estimatedSize) {
  const read = (kind) => {
    const match = new RegExp(`([\\d.]+)\\s*MB\\s+${kind}`).exec(estimatedSize || '');
    return match ? Number(match[1]) : null;
  };
  return { download: read('download'), installed: read('installed') };
}

// ['a', 'b', 'c'] -> "a, b and c"
function joinWithAnd(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// First launch in the app: optional packs to download, then (desktop only)
// how Quick lookup works, then the download's progress, success or failure.
// Shown by App.vue over everything until it emits `complete`.
export default {
  name: 'OnboardingScreen',
  components: { UiAlert, UiButton, UiCheckbox, UiIcon, UiProgress },
  emits: ['complete'],
  data() {
    return {
      // 'packs' -> 'lookup' (desktop) -> 'download' (when packs were chosen)
      step: 'packs',
      isDesktop: isTauri() && !isMobile(),
      selectedPackIds: [],
      // The packs this run downloads, fixed when the download starts
      downloadPackIds: [],
      // 'idle' | 'downloading' | 'done' | 'error'
      downloadState: 'idle',
      error: null,
      failedPackId: null,
      reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    };
  },
  computed: {
    corePack() {
      return PACK_DEFINITIONS[getRequiredPackIds()[0]];
    },
    welcomeText() {
      const core = this.corePack;
      const { labels } = getPackHighlights({ ...core, highlights: CORE_HIGHLIGHTS }, DictionariesDetails);
      const among = labels.length ? `, among them ${joinWithAnd(labels)}` : '';
      return `${core.dictionaries.length} dictionaries are already on your device and work offline${among}. You can add more now or later in Settings.`;
    },
    optionalPacks() {
      return getOptionalPackIds().map((id) => {
        const definition = PACK_DEFINITIONS[id];
        const { labels, moreCount } = getPackHighlights(definition, DictionariesDetails);
        let highlights = labels.length ? `Includes ${labels.join(', ')}` : '';
        if (highlights && moreCount) highlights += `, and ${moreCount} more`;
        return {
          ...definition,
          highlights,
          size: parsePackSize(definition.estimatedSize),
        };
      });
    },
    hasSelection() {
      return this.selectedPackIds.length > 0;
    },
    selectedSize() {
      return this.optionalPacks
        .filter((pack) => this.selectedPackIds.includes(pack.id))
        .reduce((sum, pack) => sum + (pack.size.download || 0), 0);
    },
    // One row per pack of this run, with where its download stands
    downloads() {
      const downloading = PackManager.downloadingPacks;
      const installed = PackManager.installedPacks;
      return this.downloadPackIds.map((id) => {
        const progress = downloading[id];
        let status = 'waiting';
        if (installed.includes(id)) status = 'installed';
        else if (this.downloadState === 'error' && id === this.failedPackId) status = 'failed';
        else if (progress?.status === 'extracting') status = 'extracting';
        else if (progress) status = 'downloading';
        return {
          id,
          name: PACK_DEFINITIONS[id]?.name || id,
          status,
          percentage: Math.round(progress?.percentage || 0),
        };
      });
    },
    currentDownload() {
      return this.downloads.find((download) => download.status === 'downloading' || download.status === 'extracting')
        || null;
    },
    copyKeys() {
      return [isMacOS() ? '⌘' : 'Ctrl', 'C'];
    },
    hotkeyKeys() {
      return GlobalLookup.getHotkey()
        .split('+')
        .map((part) => GlobalLookup.formatHotkeyForDisplay(part));
    },
  },
  watch: {
    step() {
      this.$nextTick(() => this.focusHeading());
    },
  },
  mounted() {
    this.focusHeading();
  },
  methods: {
    isSelected(packId) {
      return this.selectedPackIds.includes(packId);
    },
    setSelected(packId, selected) {
      const others = this.selectedPackIds.filter((id) => id !== packId);
      this.selectedPackIds = selected ? [...others, packId] : others;
    },
    toggle(packId) {
      this.setSelected(packId, !this.isSelected(packId));
    },
    packStatusText(download) {
      if (download.status === 'installed') return 'Installed';
      if (download.status === 'extracting') return 'Unpacking…';
      if (download.status === 'downloading') return `${download.percentage}%`;
      if (download.status === 'failed') return 'Failed';
      return 'Waiting';
    },
    // "Download N MB": desktop shows Quick lookup while the packs download
    download() {
      this.downloadPackIds = getOptionalPackIds().filter((id) => this.selectedPackIds.includes(id));
      this.step = this.isDesktop ? 'lookup' : 'download';
      this.runDownloads();
    },
    // "Skip for now", or the only button when nothing is ticked
    skipPacks() {
      if (this.isDesktop) this.step = 'lookup';
      else this.finish();
    },
    leaveLookup() {
      if (this.downloadState === 'idle' || this.downloadState === 'done') this.finish();
      else this.step = 'download';
    },
    async runDownloads() {
      this.downloadState = 'downloading';
      this.error = null;
      this.failedPackId = null;
      try {
        for (const packId of this.downloadPackIds) {
          if (PackManager.isInstalled(packId)) continue;
          this.failedPackId = packId;
          await PackManager.downloadPack(packId);
          await PackManager.waitForDownload(packId);
          // As Settings does: load the new pack into the running database
          await db.reloadPack(packId).catch((e) => console.warn('[Onboarding] reloadPack failed:', e));
        }
        this.downloadState = 'done';
      } catch (e) {
        // Tauri rejects with the Rust error as a plain string
        this.error = (typeof e === 'string' ? e : e?.message) || DOWNLOAD_ERROR;
        this.downloadState = 'error';
      }
    },
    finish() {
      PackManager.completeOnboarding();
      this.$emit('complete');
    },
    focusHeading() {
      this.$refs.heading?.focus();
    },
    // The screen covers the app, so Tab cycles inside it
    trapTab(event) {
      const focusable = [...this.$el.querySelectorAll(FOCUSABLE)].filter((element) => !element.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !this.$el.contains(active) || active === this.$refs.heading)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
  },
};
</script>

<template>
  <div
    class="onboarding"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
    data-testid="onboarding"
    @keydown.tab="trapTab"
  >
    <!-- Pack choice -->
    <section v-if="step === 'packs'" class="onboarding__card" data-testid="onboarding-packs">
      <div class="onboarding__logo" aria-hidden="true"><span>ཀ</span></div>
      <h1 id="onboarding-title" ref="heading" class="onboarding__title" tabindex="-1">Welcome to Tibetan Translator</h1>
      <p class="onboarding__lede" data-testid="onboarding-welcome">{{ welcomeText }}</p>

      <span id="onboarding-optional" class="onboarding__label">Optional packs</span>
      <div class="onboarding__packs" role="group" aria-labelledby="onboarding-optional">
        <div
          v-for="pack in optionalPacks"
          :key="pack.id"
          class="onboarding-pack"
          :class="{ 'is-selected': isSelected(pack.id) }"
          :data-testid="'onboarding-pack-' + pack.id"
          @click="toggle(pack.id)"
        >
          <ui-checkbox
            class="onboarding-pack__check"
            :model-value="isSelected(pack.id)"
            @update:model-value="setSelected(pack.id, $event)"
            @click.stop
          >
            <span class="onboarding-pack__name">{{ pack.name }}</span>
          </ui-checkbox>
          <span v-if="pack.size.download" class="onboarding-pack__size" data-testid="onboarding-pack-size">
            {{ pack.size.download }} MB
          </span>
          <p class="onboarding-pack__description">
            {{ pack.description }}.
            <span v-if="pack.highlights" data-testid="onboarding-pack-highlights">{{ pack.highlights }}.</span>
          </p>
          <span v-if="pack.size.installed" class="onboarding-pack__meta" data-testid="onboarding-pack-installed">
            {{ pack.size.installed }} MB on this device once installed
          </span>
        </div>
      </div>

      <div class="onboarding__actions">
        <template v-if="hasSelection">
          <ui-button data-testid="onboarding-download" @click="download">Download {{ selectedSize }} MB</ui-button>
          <ui-button variant="outline" data-testid="onboarding-skip" @click="skipPacks">Skip for now</ui-button>
        </template>
        <ui-button v-else data-testid="onboarding-continue" @click="skipPacks">
          {{ isDesktop ? 'Continue' : 'Get started' }}
        </ui-button>
      </div>
    </section>

    <!-- Quick lookup (desktop) -->
    <section
      v-else-if="step === 'lookup'"
      class="onboarding__card onboarding__card--wide"
      data-testid="onboarding-lookup"
    >
      <div class="onboarding-lookup">
        <div class="onboarding-lookup__text">
          <h1 id="onboarding-title" ref="heading" class="onboarding__title" tabindex="-1">Quick lookup</h1>
          <p class="onboarding__lede">Look up Tibetan text from any app, without switching windows.</p>

          <ol class="onboarding-lookup__steps">
            <li class="onboarding-lookup__step">
              <span class="onboarding-lookup__number" aria-hidden="true">1</span>
              <div>
                <span class="onboarding-lookup__step-title">Copy Tibetan text</span>
                <span class="onboarding-lookup__step-text">
                  Select a word anywhere and copy it
                  (<kbd v-for="key in copyKeys" :key="key" class="onboarding__key">{{ key }}</kbd>).
                </span>
              </div>
            </li>
            <li class="onboarding-lookup__step">
              <span class="onboarding-lookup__number" aria-hidden="true">2</span>
              <div>
                <span class="onboarding-lookup__step-title">Press the lookup hotkey</span>
                <span class="onboarding-lookup__step-text" data-testid="onboarding-hotkey">
                  The hotkey is
                  <kbd v-for="key in hotkeyKeys" :key="key" class="onboarding__key">{{ key }}</kbd>.
                  You can change it in Settings.
                </span>
              </div>
            </li>
            <li class="onboarding-lookup__step">
              <span class="onboarding-lookup__number" aria-hidden="true">3</span>
              <div>
                <span class="onboarding-lookup__step-title">See the definition</span>
                <span class="onboarding-lookup__step-text">
                  A small window shows the entries, then closes when you click away.
                </span>
              </div>
            </li>
          </ol>
        </div>

        <div class="onboarding-lookup__video">
          <video
            src="/img/global-lookup-demo.mp4"
            :autoplay="!reducedMotion"
            :controls="reducedMotion"
            loop
            muted
            playsinline
            aria-label="Quick lookup demonstration"
          />
        </div>
      </div>

      <div class="onboarding__spacer" />

      <div v-if="downloadState !== 'idle'" class="onboarding-lookup__download" role="status" data-testid="onboarding-lookup-download">
        <template v-if="downloadState === 'error'">
          <ui-icon name="circle-alert" :size="16" class="onboarding__danger" />
          <span>The download failed. You can retry after this step.</span>
        </template>
        <template v-else-if="downloadState === 'done'">
          <ui-icon name="circle-check" :size="16" class="onboarding__success" />
          <span>Packs downloaded and installed.</span>
        </template>
        <template v-else>
          <span class="onboarding-lookup__download-text">
            <template v-if="currentDownload">
              {{ currentDownload.status === 'extracting' ? 'Unpacking' : 'Downloading' }} {{ currentDownload.name }}…
              <template v-if="currentDownload.status === 'downloading'">{{ currentDownload.percentage }}%</template>
            </template>
            <template v-else>Starting the download…</template>
          </span>
          <ui-progress
            :value="currentDownload?.status === 'downloading' ? currentDownload.percentage : null"
            :label="'Downloading ' + (currentDownload?.name || 'packs')"
          />
        </template>
      </div>

      <div class="onboarding__actions">
        <ui-button data-testid="onboarding-lookup-done" @click="leaveLookup">Done</ui-button>
      </div>
    </section>

    <!-- Download: progress, success, failure -->
    <section v-else class="onboarding__card" data-testid="onboarding-download-step">
      <h1 id="onboarding-title" ref="heading" class="onboarding__title" tabindex="-1">
        <template v-if="downloadState === 'done'">You’re all set</template>
        <template v-else-if="downloadState === 'error'">Download failed</template>
        <template v-else>Downloading dictionaries</template>
      </h1>

      <p v-if="downloadState === 'done'" class="onboarding__lede">
        The new dictionaries are installed and ready to use.
      </p>
      <template v-else-if="downloadState === 'error'">
        <ui-alert type="error" data-testid="onboarding-error">{{ error }}</ui-alert>
        <p class="onboarding__lede">
          Check your internet connection and try again. You can also skip this and download the packs later from Settings.
        </p>
      </template>
      <p v-else class="onboarding__lede">
        This may take a few minutes depending on your connection.
      </p>

      <ul class="onboarding-downloads" aria-live="polite">
        <li
          v-for="item in downloads"
          :key="item.id"
          class="onboarding-downloads__row"
          :class="'is-' + item.status"
          :data-testid="'onboarding-download-' + item.id"
        >
          <div class="onboarding-downloads__head">
            <span class="onboarding-downloads__name">{{ item.name }}</span>
            <span class="onboarding-downloads__status" data-testid="onboarding-download-status">
              <ui-icon v-if="item.status === 'installed'" name="circle-check" :size="16" />
              <ui-icon v-else-if="item.status === 'failed'" name="circle-alert" :size="16" />
              {{ packStatusText(item) }}
            </span>
          </div>
          <ui-progress
            v-if="item.status === 'downloading' || item.status === 'extracting'"
            :value="item.status === 'downloading' ? item.percentage : null"
            :label="'Downloading ' + item.name"
          />
        </li>
      </ul>

      <div class="onboarding__spacer" />

      <div v-if="downloadState === 'done'" class="onboarding__actions">
        <ui-button data-testid="onboarding-finish" @click="finish">Get started</ui-button>
      </div>
      <div v-else-if="downloadState === 'error'" class="onboarding__actions">
        <ui-button data-testid="onboarding-retry" @click="runDownloads">Retry download</ui-button>
        <ui-button variant="outline" data-testid="onboarding-error-skip" @click="finish">Skip for now</ui-button>
      </div>
    </section>
  </div>
</template>

<style>
/* Mockup: Onboarding board (B). A 640px card centred on the app background. */
.onboarding {
  position: fixed;
  inset: 0;
  z-index: 9999;
  box-sizing: border-box;
  display: flex;
  overflow-y: auto;
  padding: var(--space-8) var(--space-6);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-base);
}
.onboarding__card {
  box-sizing: border-box;
  width: 100%;
  max-width: 40rem;
  min-height: 35rem;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 36px 40px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.onboarding__card--wide {
  max-width: 55rem;
  gap: 22px;
}
.onboarding__logo {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--logo-bg);
  color: var(--logo-ink);
  display: flex;
  align-items: center;
  justify-content: center;
}
.onboarding__logo span {
  font-family: var(--font-tibetan);
  font-size: 34px;
  line-height: 1;
  margin-top: 7px;
}
.onboarding__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.onboarding__title:focus { outline: none; }
.onboarding__lede {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--muted);
}
.onboarding__label {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.onboarding__packs {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.onboarding__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}
.onboarding__spacer { flex: 1; }
.onboarding__success { color: var(--success-ink); }
.onboarding__danger { color: var(--danger-ink); }
.onboarding__key {
  display: inline-block;
  min-width: 1.25rem;
  padding: 0 5px;
  box-sizing: border-box;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  background: var(--bg);
  color: var(--ink);
  font: 600 var(--text-xs) / 1.5 var(--font-ui);
  text-align: center;
}
.onboarding__key + .onboarding__key { margin-left: 3px; }

/* An optional pack: the whole card toggles it */
.onboarding-pack {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--space-3);
  row-gap: var(--space-1);
  padding: 14px 16px;
  border: 1.5px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.12s;
}
.onboarding-pack:hover { border-color: var(--line-strong); }
.onboarding-pack.is-selected { border-color: var(--accent); }
/* The ring goes round the card rather than the checkbox, where :has() is known */
@supports selector(:has(*)) {
  .onboarding-pack:has(:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
  .onboarding-pack .ui-checkbox__root:focus-visible { outline: none; }
}
.onboarding-pack .ui-checkbox { gap: 14px; align-items: flex-start; }
.onboarding-pack .ui-checkbox__root {
  width: 1.375rem;
  height: 1.375rem;
  border-width: 2px;
  border-radius: var(--radius-sm);
}
.onboarding-pack .ui-checkbox__label { line-height: 1.375rem; }
.onboarding-pack__name {
  font-size: 0.9375rem;
  font-weight: 600;
}
.onboarding-pack__size {
  font-size: var(--text-sm);
  line-height: 1.375rem;
  color: var(--muted);
  white-space: nowrap;
}
.onboarding-pack__description,
.onboarding-pack__meta {
  grid-column: 1 / -1;
  margin: 0 0 0 calc(1.375rem + 14px);
}
.onboarding-pack__description {
  font-size: var(--text-sm-plus);
  line-height: 1.5;
  color: var(--muted);
}
.onboarding-pack__meta {
  font-size: var(--text-chip);
  color: var(--faint);
}

/* Quick lookup: the board's three steps, with the old demo video beside them */
.onboarding-lookup {
  display: grid;
  grid-template-columns: 1fr 18rem;
  gap: var(--space-7);
  align-items: start;
}
.onboarding-lookup__text {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.onboarding-lookup__steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.onboarding-lookup__step {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}
.onboarding-lookup__step > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.onboarding-lookup__number {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.onboarding-lookup__step-title {
  font-size: 0.9688rem;
  font-weight: 600;
}
.onboarding-lookup__step-text {
  font-size: var(--text-sm-plus);
  line-height: 1.5;
  color: var(--muted);
}
.onboarding-lookup__video {
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--bg);
}
.onboarding-lookup__video video {
  display: block;
  width: 100%;
}
.onboarding-lookup__download {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  background: var(--bg);
  font-size: var(--text-sm);
  color: var(--muted);
}
.onboarding-lookup__download-text { flex: 1 1 100%; }
.onboarding-lookup__download .ui-progress { background: var(--accent-soft); }

/* Download progress, one row per pack (as in Settings' pack list) */
.onboarding-downloads {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}
.onboarding-downloads__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--soft);
}
.onboarding-downloads__row .ui-progress { background: var(--accent-soft); }
.onboarding-downloads__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.onboarding-downloads__name {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}
.onboarding-downloads__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--muted);
}
.onboarding-downloads__row.is-downloading .onboarding-downloads__status,
.onboarding-downloads__row.is-extracting .onboarding-downloads__status { color: var(--accent); }
.onboarding-downloads__row.is-installed .onboarding-downloads__status { color: var(--success-ink); }
.onboarding-downloads__row.is-failed .onboarding-downloads__status { color: var(--danger-ink); }

@media (max-width: 860px) {
  .onboarding-lookup { grid-template-columns: 1fr; }
  .onboarding-lookup__video { max-width: 22rem; }
}

/* Phone: the card becomes the screen */
@media (max-width: 600px) {
  .onboarding { padding: 0; }
  .onboarding__card {
    max-width: none;
    min-height: 100%;
    margin: 0;
    padding: calc(var(--safe-top) + 32px) 20px calc(var(--safe-bottom) + 24px);
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .onboarding__title { font-size: 1.5rem; }
  .onboarding__packs { gap: var(--space-3); }
}
</style>
