import { h, nextTick, watch } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { createMermaidRenderer } from 'vitepress-mermaid-renderer'
import ComingSoon from './ComingSoon.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    const { isDark } = useData()

    nextTick(() => {
      createMermaidRenderer({
        theme: isDark.value ? 'dark' : 'forest',
      })
    })

    watch(isDark, () => {
      createMermaidRenderer({
        theme: isDark.value ? 'dark' : 'forest',
      })
    })

    return h(DefaultTheme.Layout)
  },
  enhanceApp({ app }) {
    app.component('ComingSoon', ComingSoon)
  },
}
