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

    <span class="mode-bar-divider" aria-hidden="true" />

    <span class="wire-mark" aria-hidden="true">
      <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
        <path d="M5 1h18l4 4v18l-4 4H5l-4-4V5l4-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/>
        <circle class="wire-pulse-dot" cx="14" cy="14" r="4.5" fill="currentColor" opacity="1"/>
        <circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 3.5" opacity="0.4"/>
      </svg>
    </span>
    <span class="wire-title">
      <b>RUNTIME WIRE</b>
      <span>教学终端 · HEARTBEAT</span>
    </span>

    <div class="wire-row" aria-label="运行时数据流">
      <div class="marquee-track">
        <span v-for="(item, i) in wireItems" :key="'a'+i" class="wire-item">
          <span class="wire-dot">·</span>{{ item.name }}
          <span class="wire-coord">{{ item.coord }}</span>
        </span>
        <span v-for="(item, i) in wireItems" :key="'b'+i" class="wire-item" aria-hidden="true">
          <span class="wire-dot">·</span>{{ item.name }}
          <span class="wire-coord">{{ item.coord }}</span>
        </span>
      </div>
    </div>

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
const wireItems = [
  { name: 'TRACE', coord: 'AST' },
  { name: 'STEP', coord: 'PLAYBACK' },
  { name: 'HEAP', coord: 'VIEW' },
  { name: 'STACK', coord: 'FRAME' },
  { name: 'AI TUTOR', coord: 'COZE' },
  { name: 'SANDBOX', coord: 'JDK17' },
  { name: 'LIVE2D', coord: 'OP' },
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
  min-height: 44px;
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
.mode-bar-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
  flex-shrink: 0;
}
.wire-mark {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}
.wire-pulse-dot {
  animation: wire-pulse 1.6s steps(2) infinite;
}
.wire-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}
.wire-title b {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-h);
}
.wire-title span {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.wire-row {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.marquee-track {
  display: inline-flex;
  gap: 28px;
  padding-right: 28px;
  animation: wire-marquee 42s linear infinite;
}
.wire-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
}
.wire-dot { color: var(--accent); }
.wire-coord {
  color: var(--text-muted);
  font-size: 9px;
}
@keyframes wire-marquee { to { transform: translateX(-50%); } }
.mode-bar-brand {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
}
@media (max-width: 720px) {
  .wire-row { display: none; }
}
</style>
