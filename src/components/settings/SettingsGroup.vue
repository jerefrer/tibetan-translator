<script>
import ResizeService from '../../services/resize-service';

// A group of Settings rows under its title (boards DesktopSettings,
// MobileSettings). Desktop: the title above a bordered box of rows. Phone: a
// small uppercase label above a white group on the grey ground. The `id`
// is the section a link or the page's index lands on.
export default {
  name: 'SettingsGroup',
  props: {
    title: { type: String, default: '' },
    id: { type: String, default: undefined },
  },
  data() {
    return { isPhone: ResizeService.isMobile(), titleId: `settings-group-${this.$.uid}` };
  },
  created() {
    ResizeService.subscribe(this.titleId, () => {
      this.isPhone = ResizeService.isMobile();
    });
  },
  unmounted() {
    ResizeService.unsubscribe(this.titleId);
  },
};
</script>

<template>
  <section
    :id="id"
    class="settings-group"
    :class="{ 'is-phone': isPhone }"
    :aria-labelledby="title ? titleId : undefined"
  >
    <h2 v-if="title" :id="titleId" class="settings-group__title">{{ title }}</h2>
    <div class="settings-group__box">
      <slot />
    </div>
    <slot name="after" />
  </section>
</template>

<style>
.settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  /* A group a link lands on keeps room above it */
  scroll-margin-top: var(--space-4);
}
.settings-group__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--ink);
}
.settings-group__box {
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
  overflow: hidden;
}
.settings-group__box:empty {
  display: none;
}

/* Phone: a small uppercase label above a white group on the grey ground */
.settings-group.is-phone .settings-group__title {
  padding: 0 var(--space-1);
  font-size: var(--text-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.settings-group.is-phone .settings-group__box {
  border: 0;
  border-radius: var(--radius-group);
}
</style>
