<template>
  <div class="upload-panel">
    <!-- 拖拽上传区 -->
    <div
      class="drop-zone"
      :class="{ 'drop-active': isDragover }"
      @click.stop
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- 文件选择（支持多选） -->
      <input ref="fileInputRef" type="file" accept=".java" multiple style="display: none" @change="onFilePicked" />
      <!-- 文件夹选择 -->
      <input ref="folderInputRef" type="file" webkitdirectory style="display: none" @change="onFolderPicked" />

      <svg class="drop-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p class="drop-text">拖拽 <code>.java</code> 文件或文件夹到此处</p>
      <div class="drop-actions">
        <button class="drop-btn" @click.stop="openFilePicker">选择文件</button>
        <button class="drop-btn" @click.stop="openFolderPicker">选择文件夹</button>
      </div>
    </div>

    <!-- 本次导入的待选文件（已读取未加载） -->
    <div v-if="pendingFiles.length" class="pending-section">
      <div class="pending-label">本次导入 ({{ pendingFiles.length }} 个文件，点击加载)</div>
      <div class="history-list">
        <div
          v-for="pf in pendingFiles" :key="pf.name"
          class="history-item pending-item"
          @click="loadPending(pf)"
        >
          <div class="history-item-left">
            <div class="history-name">{{ pf.name }}</div>
            <div class="pending-badge">待加载</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传历史 -->
    <div v-if="store.uploadHistory.length" class="history-section">
      <div class="history-label">上传记录</div>
      <div class="history-list">
        <div
          v-for="record in store.uploadHistory" :key="record.name"
          class="history-item"
          @click="$emit('loadCode', record)"
        >
          <div class="history-item-left">
            <div class="history-name">{{ record.name }}</div>
            <div class="history-time">{{ relativeTime(record.time) }}</div>
          </div>
          <button
            class="history-delete"
            @click.stop="store.removeUploadRecord(record.name)"
            title="删除记录"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!pendingFiles.length" class="history-empty">暂无上传记录</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const fileInputRef = ref(null)
const folderInputRef = ref(null)
const isDragover = ref(false)
const pendingFiles = ref([])

const emit = defineEmits(['loadCode'])

function openFilePicker() {
  fileInputRef.value?.click()
}

function openFolderPicker() {
  folderInputRef.value?.click()
}

// --- 文件选择（单文件自动加载，多文件全部待选） ---
function onFilePicked(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return
  readBatch(files, files.length === 1)
}

// --- 文件夹 ---
function onFolderPicked(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''

  // 校验：仅允许 .java 文件
  const nonJava = files.filter(f => !f.name.endsWith('.java'))
  if (nonJava.length) {
    alert(`文件夹内包含非 .java 文件：${nonJava.map(f => f.name).join(', ')}`)
    return
  }
  readBatch(files, false)
}

// --- 拖拽 ---
function onDragOver() { isDragover.value = true }
function onDragLeave() { isDragover.value = false }
function onDrop(event) {
  isDragover.value = false
  // 检测是否包含文件夹
  const items = event.dataTransfer?.items
  let hasDir = false
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].webkitGetAsEntry?.()?.isDirectory) { hasDir = true; break }
    }
  }
  if (hasDir) {
    // 文件夹拖拽：遍历目录收集所有文件
    const files = []
    const dirPromises = []
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry()
      if (entry?.isDirectory) dirPromises.push(traverseDir(entry, files))
      else if (entry?.isFile) { const f = items[i].getAsFile(); if (f) files.push(f) }
    }
    Promise.all(dirPromises).then(() => {
      const javaFiles = files.filter(f => f && f.name.endsWith('.java'))
      if (javaFiles.length) readBatch(javaFiles, false)
    })
    return
  }
  // 普通文件拖拽：全部通过 dataTransfer.files 处理
  const files = Array.from(event.dataTransfer?.files || []).filter(f => f.name.endsWith('.java'))
  if (files.length) readBatch(files, files.length === 1)
}

// 仅遍历一级子文件，不递归子目录（设计要求：文件夹内不含子文件夹）
async function traverseDir(entry, acc) {
  if (entry.isFile) {
    acc.push(await toFile(entry))
  } else if (entry.isDirectory) {
    const entries = await readEntries(entry)
    for (const e of entries) {
      if (e.isFile) acc.push(await toFile(e))
    }
  }
}

function readEntries(entry) {
  return new Promise((resolve) => entry.createReader().readEntries(resolve))
}

function toFile(entry) {
  return new Promise((resolve) => entry.file(resolve))
}

// --- 批量读取 ---
function readBatch(files, autoLoadFirst = true) {
  const results = []
  let loaded = 0

  files.forEach((file, idx) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const code = e.target?.result
      if (typeof code === 'string') {
        results[idx] = { name: file.name, code }
      }
      loaded++
      if (loaded === files.length) finishBatch(results.filter(Boolean), autoLoadFirst)
    }
    reader.readAsText(file)
  })
}

function finishBatch(results, autoLoadFirst) {
  if (!results.length) return
  if (autoLoadFirst) {
    const [first, ...rest] = results
    emit('loadCode', first)
    pendingFiles.value = rest
  } else {
    pendingFiles.value = results
  }
}

function loadPending(pf) {
  emit('loadCode', pf)
  pendingFiles.value = pendingFiles.value.filter(p => p.name !== pf.name)
}

function relativeTime(timestamp) {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString()
}
</script>

<style scoped>
.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* --- Drop zone --- */
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  cursor: default;
  transition: border-color 0.25s cubic-bezier(.22,.9,.27,1),
              background 0.25s cubic-bezier(.22,.9,.27,1);
  user-select: none;
}
.drop-zone:hover,
.drop-zone.drop-active {
  border-color: var(--primary);
  background: var(--accent-bg);
}

.drop-icon {
  color: var(--text-muted);
  transition: color 0.25s;
}
.drop-zone:hover .drop-icon,
.drop-zone.drop-active .drop-icon {
  color: var(--primary);
}

.drop-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  margin: 0;
}
.drop-text code {
  font-family: var(--mono);
  font-size: 13px;
  background: var(--code-bg);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--primary);
}

.drop-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.drop-btn {
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.drop-btn:hover {
  color: var(--text-h);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

/* --- Pending (本次导入) --- */
.pending-section {
  display: flex;
  flex-direction: column;
}
.pending-label {
  font-size: 11px;
  color: var(--primary);
  margin-bottom: 8px;
}
.pending-item {
  border: 1px solid rgba(45,212,191,0.25);
  border-radius: 8px;
  background: rgba(45,212,191,0.04);
}
.pending-item:hover {
  background: rgba(45,212,191,0.08);
}
.pending-badge {
  font-size: 10px;
  color: #5eead4;
  background: rgba(45,212,191,0.12);
  padding: 1px 6px;
  border-radius: 4px;
  width: fit-content;
}

/* --- History --- */
.history-section {
  display: flex;
  flex-direction: column;
}
.history-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.history-item:hover {
  background: rgba(255,255,255,0.04);
}
.history-item-left {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.history-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.history-time {
  font-size: 11px;
  color: var(--text-muted);
}
.history-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 5px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0;
  margin-left: 8px;
}
.history-item:hover .history-delete {
  opacity: 1;
}
.history-delete:hover {
  color: #e57373;
  background: rgba(229,115,115,0.1);
}

.history-empty {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  padding: 16px 0;
}
</style>
