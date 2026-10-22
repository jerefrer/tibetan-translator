/**
 * `v-intersect` replacement for the Vuetify directive of the same name.
 *
 *   <div v-intersect="handler" />
 *   <div v-intersect="{ handler, options: { rootMargin: '100px' } }" />
 *   <div v-intersect.quiet="handler" />     // `.quiet`: skip the first call
 *
 * The handler receives (isIntersecting, entries, observer), like Vuetify's.
 * Register it locally with `directives: { intersect: vIntersect }`.
 */
function parse(binding) {
  const value = binding.value;
  if (typeof value === 'function') return { handler: value, options: {} };
  return { handler: value?.handler, options: value?.options || {} };
}

function start(el, binding) {
  if (typeof IntersectionObserver === 'undefined') return;
  const { handler, options } = parse(binding);
  if (!handler) return;
  let first = true;
  const observer = new IntersectionObserver((entries, obs) => {
    const isIntersecting = entries.some((entry) => entry.isIntersecting);
    if (first && binding.modifiers.quiet) {
      first = false;
      return;
    }
    first = false;
    handler(isIntersecting, entries, obs);
  }, options);
  el._uiIntersect = observer;
  observer.observe(el);
}

function stop(el) {
  if (el._uiIntersect) {
    el._uiIntersect.disconnect();
    delete el._uiIntersect;
  }
}

export const vIntersect = {
  mounted: start,
  updated(el, binding) {
    if (binding.value === binding.oldValue) return;
    stop(el);
    start(el, binding);
  },
  unmounted: stop,
};

export default vIntersect;
