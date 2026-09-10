<template>
  <div class="console-panel card p-3 mb-3">
    <div class="console-header" @click="collapsed = !collapsed">
      <div class="flex items-center gap-2">
        <span class="console-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">控制台输出</span>
      </div>
      <svg
        class="console-chevron"
        :class="{ rotated: !collapsed }"
        width="14" height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
    <pre v-if="displayOutput" v-show="!collapsed" class="console-body">{{ displayOutput }}</pre>
    <div v-else v-show="!collapsed" class="console-empty">暂无输出</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const collapsed = ref(false)

const displayOutput = computed(() => store.testMode ? store.output : store.currentOutput)
</script>

<style scoped>
.console-panel {
  background: var(--card-bg);
  overflow: hidden;
}
.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  font-family: var(--mono);
}
.console-dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  background: var(--accent);
  clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  animation: console-pulse 2s steps(2) infinite;
}
@keyframes console-pulse {
  50% { opacity: 0.25; }
}
.console-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.console-chevron.rotated {
  transform: rotate(180deg);
}
.console-empty {
  margin: 10px 0 0;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  text-align: center;
  background: var(--code-bg);
  border: 1px solid var(--line, var(--border));
  border-left: 2px solid var(--accent);
}
.console-body {
  margin: 10px 0 0;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--fg, var(--text-h));
  background: var(--code-bg);
  border-radius: 0;
  border: 1px solid var(--line, var(--border));
  border-left: 2px solid var(--accent);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
}
</style>
