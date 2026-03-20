<template>
  <div class="slidev-layout two-cols">
    <div class="slide-logo slide-logo-top-left">
      <img src="/superdots-icon.svg" alt="Superdots" />
    </div>

    <slot />
  </div>
</template>

<style scoped>
.slide-logo img {
  height: 20px;
}
</style>
