<!--
  Section Divider — Full-height centered title with dramatic glow and brand accent.
  Used to break the deck into major chapters.
-->
<template>
  <div class="slidev-layout sd-section">
    <div class="sd-glow" />
    <div class="sd-glow-teal" />
    <div class="sd-dots" />
    <div class="sd-top-line" />

    <div class="sd-body">
      <div class="sd-label">
        <div class="sd-dot" />
        <span v-if="$attrs.label">{{ $attrs.label }}</span>
      </div>
      <h1>
        <slot />
      </h1>
    </div>

    <img src="/brand/superdots-icon-white.svg" alt="" class="sd-logo-mark" />
  </div>
</template>

<style scoped>
.sd-section {
  background: #0B1222 !important;
  padding: 0 !important;
}

.sd-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 500px;
  background: radial-gradient(ellipse at center, rgba(232, 54, 59, 0.08) 0%, transparent 65%);
  filter: blur(80px);
  z-index: 1;
}

.sd-glow-teal {
  position: absolute;
  bottom: 10%;
  right: 20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(ellipse at center, rgba(20, 184, 166, 0.04) 0%, transparent 65%);
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

.sd-top-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, #E8363B 50%, transparent 100%);
  z-index: 5;
}

.sd-section {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.sd-body {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem;
  width: 100%;
}

.sd-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}

.sd-label span {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #64748B;
}

.sd-dot {
  width: 8px;
  height: 8px;
  background: #E8363B;
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(232, 54, 59, 0.5);
}

h1 {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-weight: 700 !important;
  font-size: 3.5rem !important;
  letter-spacing: -0.04em;
  color: #FFFFFF !important;
  max-width: 700px;
  line-height: 1.1 !important;
  margin: 0;
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
