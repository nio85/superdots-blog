<!--
  Two-Column Layout — Clean split with subtle vertical divider.
  Use ::right:: slot for second column content.
-->
<template>
  <div class="slidev-layout sd-twocols">
    <div class="sd-top-accent" />
    <SdIcon class="sd-logo-mark" :size="24" :opacity="0.2" />

    <div class="sd-cols">
      <div class="sd-col sd-col-left">
        <slot name="default" />
      </div>
      <div class="sd-divider" />
      <div class="sd-col sd-col-right">
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script setup>
import SdIcon from '../components/SdIcon.vue'
</script>

<style scoped>
.sd-twocols {
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

.sd-cols {
  height: 100%;
  display: flex;
  align-items: stretch;
}

.sd-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3.5rem 3rem;
}

.sd-col-left {
  padding-left: 4.5rem;
  padding-right: 2.5rem;
}

.sd-col-right {
  padding-left: 2.5rem;
  padding-right: 4.5rem;
}

.sd-divider {
  width: 1px;
  background: linear-gradient(to bottom, transparent 15%, rgba(148, 163, 184, 0.12) 50%, transparent 85%);
  flex-shrink: 0;
}

:deep(h1), :deep(h2) {
  font-size: 1.5rem !important;
  margin-bottom: 1rem;
}
</style>
