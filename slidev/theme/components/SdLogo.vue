<!--
  Inline logo — dots SVG + HTML text wordmark for reliable PDF rendering.
  Props: height (px), variant (white|dark), opacity.
-->
<template>
  <div class="sd-logo-wrap" :style="{ opacity, height: `${height}px` }">
    <svg :height="height" :width="height" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="50" r="6" fill="#E8363B" />
      <circle cx="32" cy="32" r="8" fill="#E8363B" />
      <circle cx="50" cy="14" r="10" fill="#E8363B" />
    </svg>
    <span class="sd-logo-text" :style="{ color: textColor, fontSize: `${height * 0.85}px` }">superdots</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  height: { type: [Number, String], default: 18 },
  variant: { type: String, default: 'white' },
  opacity: { type: [Number, String], default: 0.3 },
})
const textColor = computed(() => props.variant === 'white' ? '#FFFFFF' : '#0B1222')
</script>

<style scoped>
.sd-logo-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
}
.sd-logo-text {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  white-space: nowrap;
}
</style>
