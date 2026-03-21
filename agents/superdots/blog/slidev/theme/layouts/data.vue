<!--
  Data/Stats Layout — For metric-heavy slides with large numbers.
  Uses .sd-metric cards from global CSS.
-->
<template>
  <div class="slidev-layout sd-data">
    <div class="sd-top-accent" />
    <img src="/brand/superdots-icon-white.svg" alt="" class="sd-logo-mark" />

    <div class="sd-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.sd-data {
  background: #0B1222 !important;
  padding: 0 !important;
}

.sd-top-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #E8363B 0%, rgba(232, 54, 59, 0.2) 40%, transparent 100%);
  z-index: 5;
}

.sd-logo-mark {
  position: absolute;
  top: 2rem;
  right: 2.5rem;
  width: 24px;
  height: 24px;
  opacity: 0.2;
  z-index: 5;
}

.sd-body {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3.5rem 4.5rem;
}

:deep(h1) {
  font-size: 2rem !important;
  margin-bottom: 1.5rem;
}
</style>
