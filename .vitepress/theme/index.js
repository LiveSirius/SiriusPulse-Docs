import DefaultTheme from 'vitepress/theme'
import ComingSoon from './ComingSoon.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ComingSoon', ComingSoon)
  },
}
