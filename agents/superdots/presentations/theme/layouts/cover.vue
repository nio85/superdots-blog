<template>
  <div class="slidev-layout cover">
    <!-- Hero pattern background -->
    <div class="hero-pattern" aria-hidden="true"></div>
    <div class="dot-grid dot-grid-brand" aria-hidden="true"></div>

    <!-- Centered logo -->
    <div class="slide-logo slide-logo-center" style="top: 40px;">
      <img src="/superdots-logo-white.svg" alt="Superdots" />
    </div>

    <div class="cover-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cover-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
</style>
