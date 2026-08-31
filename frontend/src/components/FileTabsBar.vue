<template>
  <div class="file-tabs-bar">
    <div class="file-tabs-scroll">
      <button
        v-for="(file, idx) in store.multiState.files"
        :key="file.name"
        class="file-tab"
        :class="{ active: idx === store.multiState.activeFileIndex }"
        @click="store.setActiveMultiFile(idx)"
        :title="file.name"
      >
        <span class="file-tab-name">{{ file.name }}</span>
        <span
          v-if="store.multiState.files.length > 1"
          class="file-tab-close"
          @click.stop="store.removeMultiFile(file.name)"
          title="移除文件"
        >×</span>
      </button>
      <span v-if="!store.multiState.files.length" class="file-tabs-empty">暂无文件</span>
    </div>
    <template v-if="confirmingClear">
      <span class="clear-confirm-text">清空全部文件?</span>
      <button class="file-upload-btn clear-confirm-yes" @click="confirmClear">确认</button>
      <button class="file-upload-btn" @click="confirmingClear = false">取消</button>
    </template>
    <template v-else>
      <button
        class="file-upload-btn clear-btn"
        :disabled="!store.multiState.files.length"
        @click="confirmingClear = true"
        title="清空所有文件"
      >清空</button>
      <button class="file-upload-btn" @click="openPicker" title="上传 .java 文件">
        + 上传
      </button>
    </template>
    <input
      ref="inputRef"
      type="file"
      accept=".java"
      multiple
      style="display: none"
      @change="onFilesPicked"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const inputRef = ref(null)
const confirmingClear = ref(false)

function confirmClear() {
  store.clearMultiFiles()
  confirmingClear.value = false
}

function openPicker() {
  inputRef.value?.click()
}

function onFilesPicked(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return

  let loaded = 0
  files.forEach((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const code = e.target?.result
      if (typeof code === 'string') {
        store.addMultiFile({ name: file.name, code })
        if (store.multiState.files.length === 1) {
          store.setActiveMultiFile(0)
        }
      }
      loaded++
    }
    reader.readAsText(file)
  })
}
</script>

<style scoped>
.file-tabs-bar {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--editor-header-bg);
  flex-shrink: 0;
}
.file-tabs-scroll {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
.file-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.file-tab:hover {
  color: var(--text-h);
  background: var(--accent-bg);
}
.file-tab.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.file-tab-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-tab-close {
  font-size: 14px;
  line-height: 1;
  opacity: 0.5;
  padding: 0 2px;
}
.file-tab-close:hover {
  opacity: 1;
  color: var(--danger, #ef476f);
}
.file-tabs-empty {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px 8px;
}
.file-upload-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: background 0.15s, border-color 0.15s;
}
.file-upload-btn:hover {
  background: var(--accent-bg);
  border-color: var(--accent);
}
.file-upload-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.file-upload-btn.clear-btn:hover:not(:disabled) {
  background: rgba(239, 71, 111, 0.08);
  border-color: var(--danger, #ef476f);
  color: var(--danger, #ef476f);
}
.clear-confirm-text {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.clear-confirm-yes {
  color: var(--danger, #ef476f);
  border-color: var(--danger, #ef476f);
}
.clear-confirm-yes:hover {
  background: rgba(239, 71, 111, 0.08);
}
</style>
