<!--
  Cover Layout — Premium hero slide with layered glows, dot pattern, and bold left-aligned title.
  The title slide. Sets the tone for the entire deck.
  Default slot: title (h1) + optional tagline (p). Subtitle slot: longer description.
-->
<template>
  <div class="slidev-layout sd-cover">
    <!-- Layered background effects -->
    <div class="sd-bg-base" />
    <div class="sd-glow-primary" />
    <div class="sd-glow-secondary" />
    <div class="sd-glow-edge" />
    <div class="sd-dots" />
    <div class="sd-vignette" />

    <!-- Content -->
    <div class="sd-content">
      <div class="sd-title-block">
        <div class="sd-red-bar" />
        <div class="sd-title-text">
          <slot name="default" />
        </div>
      </div>
      <p v-if="$slots.subtitle" class="sd-subtitle">
        <slot name="subtitle" />
      </p>
    </div>

    <!-- Logo bottom-right -->
    <img src="/brand/superdots-logo-white.svg" alt="" class="sd-logo" />
  </div>
</template>

<style scoped>
.sd-cover {
  background: #0B1222 !important;
  padding: 0 !important;
  position: relative;
}

.sd-bg-base {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, #0B1222 0%, #0E1729 40%, #0B1222 100%);
  z-index: 0;
}

.sd-glow-primary {
  position: absolute;
  top: -30%;
  right: 10%;
  width: 80%;
  height: 90%;
  background: radial-gradient(ellipse at center, rgba(232, 54, 59, 0.10) 0%, rgba(232, 54, 59, 0.03) 40%, transparent 70%);
  filter: blur(60px);
  z-index: 1;
}

.sd-glow-secondary {
  position: absolute;
  bottom: -20%;
  left: 40%;
  width: 50%;
  height: 60%;
  background: radial-gradient(ellipse at center, rgba(20, 184, 166, 0.05) 0%, transparent 65%);
  filter: blur(50px);
  z-index: 1;
}

.sd-glow-edge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #E8363B 0%, rgba(232, 54, 59, 0.3) 50%, transparent 100%);
  z-index: 5;
}

.sd-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
  z-index: 2;
}

.sd-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(11, 18, 34, 0.4) 100%);
  z-index: 3;
}

.sd-content {
  position: relative;
  z-index: 4;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4.5rem 5.5rem;
}

.sd-title-block {
  display: flex;
  align-items: stretch;
  gap: 1.5rem;
}

.sd-red-bar {
  width: 4px;
  background: #E8363B;
  border-radius: 2px;
  flex-shrink: 0;
}

.sd-title-text {
  flex: 1;
  max-width: 85%;
}

:deep(h1) {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-weight: 700 !important;
  font-size: 3.8rem !important;
  letter-spacing: -0.04em;
  line-height: 1.05 !important;
  color: #FFFFFF !important;
  margin: 0 0 0.5rem 0;
}

.sd-title-text :deep(p) {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-weight: 500 !important;
  font-size: 1.8rem !important;
  color: #64748B !important;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 0;
}

.sd-subtitle {
  font-size: 1.1rem !important;
  color: #94A3B8 !important;
  line-height: 1.6;
  max-width: 560px;
  margin: 1.75rem 0 0 calc(4px + 1.5rem);
  font-weight: 400;
}

.sd-logo {
  position: absolute;
  bottom: 2.5rem;
  right: 3rem;
  height: 18px;
  opacity: 0.3;
  z-index: 5;
}
</style>
