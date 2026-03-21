<!--
  Quote Layout — Large quote with red accent bar and subtle glow.
  Props: author, role (via $attrs).
-->
<template>
  <div class="slidev-layout sd-quote">
    <div class="sd-glow" />
    <div class="sd-top-accent" />

    <div class="sd-body">
      <div class="sd-quote-block">
        <div class="sd-bar" />
        <div class="sd-text">
          <blockquote>
            <slot />
          </blockquote>
          <div v-if="$attrs.author" class="sd-author">
            <span class="name">{{ $attrs.author }}</span>
            <span v-if="$attrs.role" class="role">{{ $attrs.role }}</span>
          </div>
        </div>
      </div>
    </div>

    <img src="/brand/superdots-icon-white.svg" alt="" class="sd-logo-mark" />
  </div>
</template>

<style scoped>
.sd-quote {
  background: #0B1222 !important;
  padding: 0 !important;
}

.sd-glow {
  position: absolute;
  top: 30%;
  left: 15%;
  width: 500px;
  height: 400px;
  background: radial-gradient(ellipse at center, rgba(232, 54, 59, 0.05) 0%, transparent 65%);
  filter: blur(80px);
  z-index: 0;
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

.sd-quote {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.sd-body {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 5rem;
  width: 100%;
}

.sd-quote-block {
  display: flex;
  align-items: stretch;
  gap: 2rem;
  max-width: 700px;
}

.sd-bar {
  width: 3px;
  background: #E8363B;
  border-radius: 2px;
  flex-shrink: 0;
}

.sd-text {
  flex: 1;
}

blockquote {
  font-family: 'Space Grotesk', system-ui, sans-serif !important;
  font-size: 1.85rem !important;
  font-weight: 500;
  color: #F1F5F9 !important;
  line-height: 1.4;
  letter-spacing: -0.02em;
  margin: 0;
}

blockquote :deep(p) {
  color: #F1F5F9 !important;
  font-size: inherit !important;
  margin: 0;
  line-height: inherit;
}

.sd-author {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.name {
  color: #FFFFFF;
  font-weight: 600;
  font-size: 1rem;
}

.role {
  color: #64748B;
  font-size: 0.85rem;
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
