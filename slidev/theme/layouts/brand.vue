<!--
  Brand Assets Layout — Logo showcase and brand guidelines.
-->
<template>
  <div class="slidev-layout sd-brand">
    <div class="sd-top-accent" />
    <SdIcon class="sd-logo-mark" :size="24" :opacity="0.2" />

    <div class="sd-body">
      <h2 class="sd-title">Brand Assets</h2>
      <div class="sd-cards">
        <div class="sd-card">
          <div class="sd-preview sd-dark">
            <SdLogo :height="22" variant="white" :opacity="1" />
          </div>
          <p class="sd-label">Logo — dark bg</p>
        </div>
        <div class="sd-card">
          <div class="sd-preview sd-light">
            <SdLogo :height="22" variant="dark" :opacity="1" />
          </div>
          <p class="sd-label">Logo — light bg</p>
        </div>
        <div class="sd-card">
          <div class="sd-preview sd-dark">
            <SdIcon :size="30" :opacity="1" />
          </div>
          <p class="sd-label">Icon mark</p>
        </div>
      </div>
      <div class="sd-extra">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import SdIcon from '../components/SdIcon.vue'
import SdLogo from '../components/SdLogo.vue'
</script>

<style scoped>
.sd-brand {
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
  bottom: 2rem;
  right: 2.5rem;
  width: 24px;
  height: 24px;
  opacity: 0.2;
  z-index: 5;
}

.sd-body {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3.5rem 4.5rem;
}

.sd-title {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-weight: 700 !important;
  font-size: 1.8rem !important;
  color: #FFFFFF !important;
  margin-bottom: 2rem;
}

.sd-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.sd-card {
  text-align: center;
}

.sd-preview {
  border-radius: 10px;
  padding: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
}

.sd-dark {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.08);
}

.sd-light {
  background: #F1F5F9;
}

.sd-logo-img { height: 22px; }
.sd-icon-img { height: 30px; }

.sd-label {
  color: #64748B !important;
  font-size: 0.75rem !important;
  margin-top: 0.6rem;
}

.sd-extra {
  margin-top: 1.5rem;
}
</style>
