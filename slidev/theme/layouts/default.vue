<!--
  Default Content Layout — The workhorse layout for body slides.
  Red top accent line, logo watermark, vertically centered content.
-->
<template>
  <div class="slidev-layout sd-default">
    <div class="sd-top-accent" />
    <div class="sd-ambient" />
    <img src="/brand/superdots-icon-white.svg" alt="" class="sd-logo-mark" />

    <div class="sd-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.sd-default {
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

.sd-ambient {
  position: absolute;
  top: -30%;
  right: -10%;
  width: 500px;
  height: 500px;
  background: radial-gradient(ellipse at center, rgba(232, 54, 59, 0.03) 0%, transparent 70%);
  filter: blur(80px);
  z-index: 0;
  pointer-events: none;
}

.sd-logo-mark {
  position: absolute;
  top: 2rem;
  right: 2.5rem;
  width: 24px;
  height: 24px;
  opacity: 0.2;
  z-index: 5;
  pointer-events: none;
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
  font-size: 2.2rem !important;
  margin-bottom: 1.25rem;
}

:deep(h2) {
  font-size: 1.6rem !important;
  margin-bottom: 1rem;
}
</style>
