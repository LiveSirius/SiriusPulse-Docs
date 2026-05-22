<script setup>
import DefaultTheme from 'vitepress/theme'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

const { Layout } = DefaultTheme
const route = useRoute()

function renderMermaid() {
  if (typeof window === 'undefined' || !window.mermaid) {
    return
  }

  // 查找所有未被转换的 mermaid 代码块，替换为 <div class="mermaid">
  document.querySelectorAll('pre code.language-mermaid').forEach((codeEl) => {
    const preEl = codeEl.parentElement
    if (preEl && !preEl.hasAttribute('data-mermaid-processed')) {
      preEl.setAttribute('data-mermaid-processed', 'true')
      const div = document.createElement('div')
      div.className = 'mermaid'
      div.textContent = codeEl.textContent
      preEl.replaceWith(div)
    }
  })

  window.mermaid.run({
    querySelector: '.mermaid',
  })
}

onMounted(() => {
  nextTick(() => {
    renderMermaid()
  })
})

watch(() => route.path, () => {
  nextTick(() => {
    renderMermaid()
  })
})
</script>

<template>
  <Layout />
</template>
