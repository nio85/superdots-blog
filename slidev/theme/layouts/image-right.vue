<!--
  Text + Image Layout — Content left, image right in a clean split.
  Props: image, imageAlt (via $attrs).
-->
<template>
  <div class="slidev-layout sd-imgright">
    <div class="sd-top-accent" />
    <SdIcon class="sd-logo-mark" :size="24" :opacity="0.2" />

    <div class="sd-grid">
      <div class="sd-text">
        <slot />
      </div>
      <div class="sd-img">
        <div v-if="$attrs.image" class="sd-frame">
          <img :src="$attrs.image" :alt="$attrs.imageAlt || ''" />
        </div>
        <div v-else class="sd-placeholder">
          <div class="sd-placeholder-inner">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import SdIcon from '../components/SdIcon.vue'
</script>

<style scoped>
.sd-imgright {
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

.sd-grid {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.sd-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3.5rem 3rem 3.5rem 4.5rem;
}

:deep(h1) {
  font-size: 1.8rem !important;
  margin-bottom: 1rem;
}

.sd-img {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 3.5rem 3rem 1.5rem;
}

.sd-frame {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.08);
}

.sd-frame img {
  width: 100%;
  display: block;
}

.sd-placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sd-placeholder-inner {
  opacity: 0.5;
}
</style>
