<script>
// A transition for content that opens and closes in place (the query builder,
// the row of its button): its height and opacity go together, so what is
// below slides instead of jumping. Its child is a single v-if / v-show
// element. The parent's flex gap is taken back while it is closed, so that
// the gap does not jump either. No motion when reduced motion is asked.
const DURATION = 200;

function reducedMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function parentGap(el) {
  return parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
}

export default {
  name: 'UiCollapse',
  methods: {
    closedStyle(el) {
      el.style.height = '0px';
      el.style.opacity = '0';
      el.style.marginTop = `${-parentGap(el)}px`;
    },
    openStyle(el) {
      el.style.height = `${el.scrollHeight}px`;
      el.style.opacity = '1';
      el.style.marginTop = '0px';
    },
    animate(el, done, from, to) {
      if (reducedMotion()) {
        done();
        return;
      }
      el.style.overflow = 'hidden';
      from(el);
      // Read the layout so the browser starts from `from`, not from `to`
      el.getBoundingClientRect();
      el.style.transition = `height ${DURATION}ms ease, opacity ${DURATION}ms ease, margin-top ${DURATION}ms ease`;
      to(el);
      const finish = (event) => {
        if (event && (event.target !== el || event.propertyName !== 'height')) return;
        el.removeEventListener('transitionend', finish);
        clearTimeout(el._collapseTimer);
        done();
      };
      el.addEventListener('transitionend', finish);
      // transitionend never comes when nothing changed (an empty element)
      el._collapseTimer = setTimeout(finish, DURATION + 50);
    },
    onEnter(el, done) {
      this.animate(el, done, this.closedStyle, this.openStyle);
    },
    onLeave(el, done) {
      this.animate(el, done, this.openStyle, this.closedStyle);
    },
    reset(el) {
      ['height', 'opacity', 'marginTop', 'overflow', 'transition'].forEach((property) => {
        el.style[property] = '';
      });
    },
  },
};
</script>

<template>
  <transition
    :css="false"
    @enter="onEnter"
    @after-enter="reset"
    @enter-cancelled="reset"
    @leave="onLeave"
    @after-leave="reset"
    @leave-cancelled="reset"
  >
    <slot />
  </transition>
</template>
