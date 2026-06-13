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
    <pre v-if="store.currentOutput || store.output" v-show="!collapsed" class="console-body">{{ store.currentOutput || store.output }}</pre>
    <div v-else v-show="!collapsed" class="console-empty">暂无输出</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const collapsed = ref(false)
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
}
.console-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
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
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
.console-body {
  margin: 10px 0 0;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
  background: var(--code-bg);
  border-radius: 8px;
  border-left: 2px solid var(--accent-border);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 220px;
  overflow-y: auto;
}
</style>
