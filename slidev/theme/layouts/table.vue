<!--
  Table Layout — Clean table styling for data grids, comparisons, capability lists.
-->
<template>
  <div class="slidev-layout sd-table">
    <div class="sd-top-accent" />
    <img src="/brand/superdots-icon-white.svg" alt="" class="sd-logo-mark" />

    <div class="sd-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.sd-table {
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

.sd-body {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3.5rem 4.5rem;
}

:deep(h1) {
  font-size: 2rem !important;
  margin-bottom: 1.25rem;
}

:deep(table) {
  width: 100%;
  border-collapse: collapse;
}

:deep(th) {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 600;
  color: #FFFFFF;
  text-align: left;
  padding: 0.85rem 1.25rem;
  border-bottom: 2px solid #E8363B;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

:deep(td) {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  color: #CBD5E1;
  font-size: 0.9rem;
}

:deep(tr:last-child td) {
  border-bottom: none;
}

:deep(td:first-child) {
  color: #F1F5F9;
  font-weight: 500;
}
</style>
