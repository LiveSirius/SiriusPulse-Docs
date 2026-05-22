<template>
  <div class="coming-soon">
    <div class="icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h2>文档撰写中</h2>
    <p>此部分内容正在编写中，敬请期待。</p>
  </div>
</template>

<style scoped>
.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--vp-c-text-2);
}
.coming-soon .icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}
.coming-soon h2 {
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}
.coming-soon p {
  font-size: 1rem;
}
</style>
