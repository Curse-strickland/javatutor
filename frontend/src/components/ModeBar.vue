<template>
  <div class="mode-bar" role="tablist" aria-label="文件模式">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="mode-bar-btn"
      :class="{ active: store.mode === opt.value }"
      role="tab"
      :aria-selected="store.mode === opt.value"
      @click="store.switchMode(opt.value)"
    >{{ opt.label }}</button>
    <span class="mode-bar-brand">JavaTutor · 教学终端</span>
  </div>
</template>

<script setup>
import { usePlayerStore } from '../stores/player'
const store = usePlayerStore()
const options = [
  { label: '单文件', value: 'single' },
  { label: '多文件', value: 'multi' },
]
</script>

<style scoped>
.mode-bar {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  margin: 8px 12px 0;
  background: var(--card-bg);
  border: 1px solid var(--border);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: var(--shadow);
  min-height: 40px;
}
.mode-bar::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 88px;
  height: 2px;
  background: var(--accent);
}
.mode-bar-btn {
  background: transparent;
  border: 1px solid var(--line-strong);
  padding: 6px 16px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.mode-bar-btn:hover { color: var(--text-h); background: var(--accent-bg); }
.mode-bar-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.mode-bar-brand {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
</style>
