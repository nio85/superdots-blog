<!--
  Full-Bleed Image Layout — Edge-to-edge image with gradient overlay.
  Content sits at the bottom over the image.
  Props: image (via $attrs).
-->
<template>
  <div class="slidev-layout sd-fullimage">
    <div class="sd-imgbg" :style="bgStyle" />
    <div class="sd-overlay" />
    <div class="sd-top-accent" />

    <div class="sd-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
const attrs = useAttrs()
const bgStyle = computed(() => ({
  backgroundImage: attrs.image ? `url(${attrs.image})` : 'none',
  backgroundColor: attrs.image ? undefined : '#1E293B',
}))
</script>

<style scoped>
.sd-fullimage {
  background: #0B1222 !important;
  padding: 0 !important;
}

.sd-imgbg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  z-index: 0;
}

.sd-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    to top,
    rgba(11, 18, 34, 0.95) 0%,
    rgba(11, 18, 34, 0.6) 35%,
    rgba(11, 18, 34, 0.2) 60%,
    rgba(11, 18, 34, 0.1) 100%
  );
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

.sd-body {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 3.5rem 4.5rem;
}

:deep(h1) {
  font-size: 2.2rem !important;
  margin-bottom: 0.75rem;
}
</style>
