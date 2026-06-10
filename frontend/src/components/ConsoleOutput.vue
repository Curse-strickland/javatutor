<template>
  <transition name="console">
    <div v-if="hasRun" class="console-panel card p-3 mb-3">
      <div class="console-header" @click="collapsed = !collapsed">
        <div class="flex items-center gap-2">
          <span class="console-dot" :class="{ 'no-output': !store.currentOutput }" />
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
      <div v-show="!collapsed" class="console-body-wrapper">
        <pre v-if="store.currentOutput" class="console-body">{{ store.currentOutput }}</pre>
        <div v-else class="console-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h8"/>
          </svg>
          <p class="empty-text">本次运行未产生输出</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const collapsed = ref(false)

// 判断是否已经运行过代码
const hasRun = computed(() => store.runId !== null)
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
  transition: opacity 0.2s, background 0.2s;
}
.console-dot.no-output {
  opacity: 0.3;
  background: var(--text-muted);
}
.console-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.console-chevron.rotated {
  transform: rotate(180deg);
}
.console-body-wrapper {
  margin-top: 10px;
}
.console-body {
  margin: 0;
  padding: 10px 12px;
  font-size: 14px;
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
.console-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  color: var(--text-muted);
  opacity: 0.6;
}
.empty-text {
  margin-top: 8px;
  font-size: 13px;
  text-align: center;
}
/* enter/leave transition */
.console-enter-active {
  transition: all 0.3s ease;
}
.console-leave-active {
  transition: all 0.2s ease;
}
.console-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.console-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
