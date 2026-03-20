<template>
  <div class="slidev-layout end">
    <div class="hero-pattern" aria-hidden="true"></div>
    <div class="dot-grid dot-grid-brand" aria-hidden="true"></div>

    <div class="slide-logo slide-logo-center" style="top: 40px;">
      <img src="/superdots-logo-white.svg" alt="Superdots" />
    </div>

    <div class="end-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.end-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
</style>
