/**
 * ThemeMixin
 *
 * Provides shared theme handling for Vue components.
 * Wraps Vuetify's useTheme() composable in a mixin-compatible format.
 *
 * Usage:
 *   import ThemeMixin from './mixins/ThemeMixin';
 *   export default {
 *     mixins: [ThemeMixin],
 *     // Access this.isDark in templates/methods
 *   }
 *
 * Note: Components using this mixin should NOT define their own setup()
 * that returns theme. If you need other setup() logic, merge it:
 *
 *   setup() {
 *     const theme = useTheme();
 *     // your other setup code
 *     return { theme, ...otherStuff };
 *   }
 */

import { useTheme } from 'vuetify';

export default {
  setup() {
    const theme = useTheme();
    return { theme };
  },
  computed: {
    isDark() {
      return this.theme.global.current.value.dark;
    },
  },
};
