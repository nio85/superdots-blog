<script setup lang="ts">
defineProps<{ image?: string }>()
</script>

<template>
  <div class="slidev-layout image-left">
    <div class="image-container">
      <slot name="image">
        <img v-if="image" :src="image" alt="" />
        <div v-else class="image-placeholder">
          <p>Image placeholder</p>
          <p class="hint">16:9 or 4:3 recommended</p>
        </div>
      </slot>
    </div>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--sd-slate-400);
  font-size: 0.9em;
}
.hint {
  font-size: 0.75em;
  opacity: 0.6;
  margin-top: 4px;
}
</style>
