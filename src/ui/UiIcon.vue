<script>
import { h } from 'vue';
import { resolveIcon } from './icons';

// A <UiIcon> is a thin wrapper around a Lucide icon. The name comes from the
// `name` prop or, failing that, the default slot (`<UiIcon>plus</UiIcon>`).
// `mdi-*` names from custom pack manifests resolve too (see icons.js).
export default {
  name: 'UiIcon',
  props: {
    name: { type: String, default: '' },
    // px at the default text size; rendered in rem so the icon follows "Text size"
    size: { type: Number, default: 20 },
    strokeWidth: { type: Number, default: 1.8 },
    label: { type: String, default: '' },
  },
  render() {
    const slotText = (this.$slots.default?.() || [])
      .map((node) => (typeof node.children === 'string' ? node.children : ''))
      .join('')
      .trim();
    const component = resolveIcon(this.name || slotText);
    const dimension = `${this.size / 16}rem`;
    const attrs = {
      class: 'ui-icon',
      'data-testid': 'ui-icon',
      size: dimension,
      'stroke-width': this.strokeWidth,
    };
    if (this.label) {
      attrs.role = 'img';
      attrs['aria-label'] = this.label;
    } else {
      attrs['aria-hidden'] = 'true';
    }
    if (!component) {
      return h('span', { ...attrs, 'data-missing-icon': this.name || slotText });
    }
    return h(component, attrs);
  },
};
</script>

<style>
.ui-icon {
  flex: none;
  display: inline-block;
  vertical-align: middle;
}
</style>
