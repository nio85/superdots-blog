<!--
  Inline SVG icon mark — renders reliably in PDF/PPTX export.
  Props: size (px), color, opacity.
-->
<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" :style="{ opacity }">
    <circle cx="14" cy="50" r="6" :fill="color" />
    <circle cx="32" cy="32" r="8" :fill="color" />
    <circle cx="50" cy="14" r="10" :fill="color" />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 24 },
  color: { type: String, default: '#FFFFFF' },
  opacity: { type: [Number, String], default: 0.2 },
})
</script>
