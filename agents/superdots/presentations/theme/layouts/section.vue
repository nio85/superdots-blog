<template>
  <div class="slidev-layout section">
    <div class="hero-pattern" aria-hidden="true"></div>
    <div class="dot-grid" aria-hidden="true"></div>

    <div class="section-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.section-content {
  position: relative;
  z-index: 2;
}
</style>
