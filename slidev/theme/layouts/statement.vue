<!--
  Statement Layout — Single bold statement centered with dramatic presence.
  Used for key takeaways, bold claims, or transition moments.
-->
<template>
  <div class="slidev-layout sd-statement">
    <div class="sd-glow" />
    <div class="sd-top-line" />

    <div class="sd-body">
      <slot />
    </div>

    <SdIcon class="sd-logo-mark" :size="24" :opacity="0.2" />
  </div>
</template>

<script setup>
import SdIcon from '../components/SdIcon.vue'
</script>

<style scoped>
.sd-statement {
  background: #0B1222 !important;
  padding: 0 !important;
}

.sd-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse at center, rgba(232, 54, 59, 0.06) 0%, transparent 65%);
  filter: blur(80px);
  z-index: 0;
}

.sd-top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent 30%, #E8363B 50%, transparent 70%);
  z-index: 5;
}

.sd-statement {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.sd-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 6rem;
}

:deep(h1) {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-weight: 700 !important;
  font-size: 2.6rem !important;
  line-height: 1.15 !important;
  letter-spacing: -0.03em;
  color: #FFFFFF !important;
  max-width: 750px;
  margin: 0;
}

:deep(p) {
  font-size: 1.1rem !important;
  color: #64748B !important;
  margin-top: 1.75rem;
  line-height: 1.65;
  max-width: 580px;
}

.sd-logo-mark {
  position: absolute;
  bottom: 2.5rem;
  right: 2.5rem;
  width: 24px;
  height: 24px;
  opacity: 0.2;
  z-index: 5;
}
</style>
