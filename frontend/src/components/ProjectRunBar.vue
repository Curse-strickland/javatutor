<template>
  <div class="project-run-bar">
    <div class="prb-left">
      <button class="prb-btn run" @click="onRun" :disabled="!canRun || store.isLoading">
        <svg v-if="!store.isLoading" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M7 4.2v15.6L19.5 12 7 4.2z" />
        </svg>
        <svg v-else class="spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75">
          <circle cx="12" cy="12" r="8.5" stroke-dasharray="40" stroke-dashoffset="12" />
        </svg>
        运行整个项目
      </button>
      <button class="prb-btn" @click="onReset" :disabled="store.totalSteps === 0 && !store.error">
        重置
      </button>
      <span class="prb-hint">v1：运行当前文件</span>
    </div>
    <div v-if="store.totalSteps" class="prb-status">
      步进 {{ store.currentStep + 1 }} / {{ store.totalSteps }}
    </div>
    <div v-else-if="store.error" class="prb-error">{{ store.error }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()

const canRun = computed(() => {
  const files = store.multiState.files
  const idx = store.multiState.activeFileIndex
  return files.length > 0 && files[idx]?.code
})

async function onRun() {
  const files = store.multiState.files
  const idx = store.multiState.activeFileIndex
  const active = files[idx]
  if (!active?.code) return
  await store.runCode(active.code)
}

function onReset() {
  store.resetMultiRun()
}
</script>

<style scoped>
.project-run-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  background: var(--editor-header-bg);
  flex-shrink: 0;
}
.prb-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.prb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.prb-btn:hover:not(:disabled) {
  color: var(--text-h);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.prb-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.prb-btn.run {
  color: var(--accent);
  border-color: var(--accent);
}
.prb-hint {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.prb-status {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.08em;
}
.prb-error {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--danger, #ef476f);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spin {
  animation: prb-spin 0.8s linear infinite;
}
@keyframes prb-spin {
  to { transform: rotate(360deg); }
}
</style>
