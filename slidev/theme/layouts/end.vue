<!--
  Closing Layout — Hero glow, centered CTA, full brand presence.
  The final slide. Should feel as strong as the cover.
-->
<template>
  <div class="slidev-layout sd-end">
    <div class="sd-bg-base" />
    <div class="sd-glow-primary" />
    <div class="sd-glow-secondary" />
    <div class="sd-dots" />
    <div class="sd-vignette" />
    <div class="sd-top-line" />

    <div class="sd-body">
      <div class="sd-dot" />
      <div class="sd-content">
        <slot />
      </div>
    </div>

    <SdLogo class="sd-logo" :height="16" :opacity="0.25" />
  </div>
</template>

<script setup>
import SdLogo from '../components/SdLogo.vue'
</script>

<style scoped>
.sd-end {
  background: #0B1222 !important;
  padding: 0 !important;
}

.sd-bg-base {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, #0B1222 0%, #0E1729 50%, #0B1222 100%);
  z-index: 0;
}

.sd-glow-primary {
  position: absolute;
  top: 20%;
  left: 25%;
  width: 50%;
  height: 50%;
  background: radial-gradient(ellipse at center, rgba(232, 54, 59, 0.10) 0%, transparent 65%);
  filter: blur(80px);
  z-index: 1;
}

.sd-glow-secondary {
  position: absolute;
  bottom: 10%;
  right: 20%;
  width: 35%;
  height: 40%;
  background: radial-gradient(ellipse at center, rgba(20, 184, 166, 0.05) 0%, transparent 65%);
  filter: blur(60px);
  z-index: 1;
}

.sd-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(148, 163, 184, 0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  z-index: 2;
}

.sd-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(11, 18, 34, 0.5) 100%);
  z-index: 3;
}

.sd-top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, #E8363B 50%, transparent 100%);
  z-index: 5;
}

.sd-end {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.sd-body {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem;
}

.sd-dot {
  width: 10px;
  height: 10px;
  background: #E8363B;
  border-radius: 50%;
  margin-bottom: 2rem;
  box-shadow: 0 0 16px rgba(232, 54, 59, 0.5);
}

.sd-content {
  max-width: 550px;
}

:deep(h2) {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-weight: 700 !important;
  font-size: 2.4rem !important;
  letter-spacing: -0.03em;
  color: #FFFFFF !important;
  line-height: 1.15;
  margin-bottom: 1rem;
}

:deep(p) {
  color: #64748B !important;
  font-size: 1.05rem !important;
  line-height: 1.6;
}

.sd-logo {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  height: 16px;
  opacity: 0.25;
  z-index: 5;
}
</style>
