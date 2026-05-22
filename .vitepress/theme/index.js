import DefaultTheme from 'vitepress/theme'
import ComingSoon from './ComingSoon.vue'
import Layout from './Layout.vue'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ComingSoon', ComingSoon)
  },
}
