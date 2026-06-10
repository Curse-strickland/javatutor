<template>
  <div class="app-shell">
    <GlobalStatus />
    <div ref="containerRef" class="main-area">
      <!-- 左侧：代码编辑器卡片 -->
      <div :style="{ width: leftWidth + 'px' }" class="editor-card flex-none flex flex-col">
        <div class="editor-card-header">
          <span class="rc-dot" />
          <span class="text-sm font-semibold" style="color: var(--text-h)">你的代码</span>
          <button
            class="upload-toggle-btn"
            :class="{ active: uploadOpen }"
            @click="toggleUpload"
            title="导入文件"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span class="upload-toggle-label">导入</span>
          </button>
        </div>
        <!-- 文件上传面板（向下滑出） -->
        <transition name="upload-slide">
          <div v-if="uploadOpen" class="upload-panel-wrapper">
            <FileUploadPanel @loadCode="onFileLoad" />
          </div>
        </transition>
        <div class="flex-1 min-h-0">
          <Editor ref="editorRef" class="h-full" />
        </div>
      </div>

      <!-- 可拖拽分割条 -->
      <div class="splitter" @mousedown.prevent="startDrag" :class="{ 'dragging': isDragging }" aria-hidden="true">
        <div class="splitter-handle" />
      </div>

      <!-- 右侧：标签页卡片 -->
      <div class="flex-1 right-card card flex flex-col">
        <div class="right-card-header">
          <span class="rc-dot" />
          <button
            class="right-tab"
            :class="{ active: store.rightTab === 'variables' }"
            @click="store.switchRightTab('variables')"
          >变量</button>
          <button
            class="right-tab"
            :class="{ active: store.rightTab === 'files' }"
            @click="store.switchRightTab('files')"
          >文件</button>
        </div>
        <div class="flex-1 overflow-auto right-card-body">
          <template v-if="store.rightTab === 'variables'">
            <VariablePanel />
            <HeapStackPanel />
            <ConsoleOutput />
          </template>
          <div v-else class="placeholder-tab">
            <p class="placeholder-text">更多功能即将上线</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部控制栏：浮动可拖动，默认位于编辑区底部 -->
    <div
      ref="controlBarRef"
      class="control-bar"
      :class="{ 'has-panel': store.explainExpanded }"
      :style="{ left: barPos.x + 'px', top: barPos.y + 'px' }"
      @pointerdown.stop
    >
      <!-- AI Tutor 面板 — 从控制栏上方滑出 -->
      <transition name="panel-slide">
        <div v-if="store.explainExpanded" class="ai-panel-wrapper">
          <AiTutorPanel />
        </div>
      </transition>

      <!-- 控件行：拖动句柄 + 播放按钮 + 进度条 + 右侧按钮组 -->
      <div class="control-bar-top">
        <!-- 拖动手柄 -->
        <div class="drag-handle" @pointerdown.prevent="startBarDrag" title="拖动控制栏">
          <svg viewBox="0 0 16 24" width="10" height="16" fill="currentColor" opacity="0.4">
            <circle cx="4" cy="4" r="1.5"/>
            <circle cx="12" cy="4" r="1.5"/>
            <circle cx="4" cy="12" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="4" cy="20" r="1.5"/>
            <circle cx="12" cy="20" r="1.5"/>
          </svg>
        </div>

        <!-- 播放控制按钮组 -->
        <div class="ctrl-btn-group">
          <button class="ctrl-btn" @click="store.goToFirst" title="跳到第一步" :disabled="store.totalSteps === 0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="4" y="5" width="2.5" height="14" rx="0.5"/>
              <polygon points="20,5 9,12 20,19"/>
            </svg>
          </button>
          <button class="ctrl-btn" @click="store.prevStep" title="上一步" :disabled="store.currentStep <= 0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <polygon points="15,5 6,12 15,19"/>
            </svg>
          </button>
          <button class="ctrl-btn run-btn" @click="runCode" :disabled="store.isLoading" title="运行代码">
            <svg v-if="!store.isLoading" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <polygon points="6,3 21,12 6,21"/>
            </svg>
            <svg v-else class="spin" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="9" stroke-dasharray="42" stroke-dashoffset="14"/>
            </svg>
          </button>
          <button class="ctrl-btn" @click="store.nextStep" title="下一步" :disabled="store.currentStep >= store.totalSteps - 1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <polygon points="9,5 18,12 9,19"/>
            </svg>
          </button>
          <button class="ctrl-btn" @click="store.goToLast" title="跳到最后" :disabled="store.totalSteps === 0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <polygon points="4,5 15,12 4,19"/>
              <rect x="17.5" y="5" width="2.5" height="14" rx="0.5"/>
            </svg>
          </button>
        </div>

        <!-- 进度条 -->
        <div class="progress-wrapper" ref="progressRef">
          <div class="progress-track" @click="onProgressClick">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"/>
            <div
              class="progress-thumb"
              :style="{ left: progressPercent + '%' }"
              @pointerdown.stop="startProgressDrag"
            />
          </div>
          <div class="progress-label">
            {{ displayStep }}
          </div>
        </div>

        <!-- 右侧：自动播放 + 速度 + AI -->
        <div class="ctrl-right-group">
          <button class="ctrl-btn" @click="toggleAutoPlay" :title="isAutoPlaying ? '暂停自动播放' : '开始自动播放'" :disabled="store.totalSteps === 0">
            <svg v-if="isAutoPlaying" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1"/>
              <rect x="14" y="4" width="5" height="16" rx="1"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <polygon points="7,4 19,12 7,20"/>
            </svg>
          </button>
          <!-- 自定义速度选择器 -->
          <div class="speed-picker" ref="speedPickerRef">
            <button class="ctrl-btn speed-btn" @click="toggleSpeedMenu" title="播放速度">
              <span class="speed-label">{{ speedLabel }}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" :style="{ transform: speedOpen ? 'rotate(180deg)' : '', transition: 'transform 0.25s ease' }">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <transition name="speed-drop">
              <div v-if="speedOpen" class="speed-menu card">
                <button v-for="opt in speedOptions" :key="opt.value"
                  class="speed-option" :class="{ active: speed === opt.value }"
                  @click="selectSpeed(opt.value)">{{ opt.label }}</button>
              </div>
            </transition>
          </div>
          <!-- AI 解说切换按钮 -->
          <button
            class="ctrl-btn ai-toggle-btn"
            :class="{ active: store.explainExpanded, pulsing: store.isExplaining }"
            @click="toggleAiPanel"
            title="AI 解说"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l1.2 4.8L19 8l-5.8 1.2L12 15l-1.2-5.8L5 8l5.8-1.2z" />
              <path d="M12 22l-.5-2.5L9 18.5l2.5-.5.5-2 .5 2 2.5.5-2.5.5z" opacity="0.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from './stores/player'
import Editor from './components/Editor.vue'
import VariablePanel from './components/VariablePanel.vue'
import ConsoleOutput from './components/ConsoleOutput.vue'
import GlobalStatus from './components/GlobalStatus.vue'
import HeapStackPanel from './components/HeapStackPanel.vue'
import AiTutorPanel from './components/AiTutorPanel.vue'
import FileUploadPanel from './components/FileUploadPanel.vue'

const store = usePlayerStore()
const editorRef = ref(null)
const containerRef = ref(null)
const progressRef = ref(null)
const controlBarRef = ref(null)
const leftWidth = ref(0)
const isDragging = ref(false)
const uploadOpen = ref(false)
const MIN_LEFT = 200
const MIN_RIGHT = 200
const isAutoPlaying = ref(false)
const speed = ref(1000)
const speedOpen = ref(false)
const speedPickerRef = ref(null)
const speedOptions = [
  { label: '2x', value: 500 },
  { label: '1x', value: 1000 },
  { label: '0.5x', value: 2000 }
]
const speedLabel = computed(() => speedOptions.find(o => o.value === speed.value)?.label || '1x')

function toggleSpeedMenu() {
  speedOpen.value = !speedOpen.value
  if (speedOpen.value) {
    setTimeout(() => document.addEventListener('click', onSpeedOutside))
  }
}
function selectSpeed(val) {
  speed.value = val
  speedOpen.value = false
}
function onSpeedOutside(e) {
  if (speedPickerRef.value && !speedPickerRef.value.contains(e.target)) {
    speedOpen.value = false
    document.removeEventListener('click', onSpeedOutside)
  }
}

let timer = null

// 控制栏拖动
const barPos = ref({ x: 0, y: 0 })
const barDragging = ref(false)
let barOffset = { x: 0, y: 0 }

const startBarDrag = (e) => {
  barDragging.value = true
  barOffset.x = e.clientX - barPos.value.x
  barOffset.y = e.clientY - barPos.value.y
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onBarMove)
  window.addEventListener('pointerup', onBarUp, { once: true })
}
const onBarMove = (e) => {
  if (!barDragging.value) return
  const barEl = controlBarRef.value
  const barW = barEl ? barEl.offsetWidth : 520
  const barH = barEl ? barEl.offsetHeight : 56
  const maxX = window.innerWidth - barW
  const maxY = window.innerHeight - barH
  barPos.value.x = Math.max(0, Math.min(e.clientX - barOffset.x, maxX))
  barPos.value.y = Math.max(0, Math.min(e.clientY - barOffset.y, maxY))
}
const onBarUp = () => {
  barDragging.value = false
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onBarMove)
}

// 进度条百分比
const progressPercent = computed(() => {
  if (store.totalSteps <= 1) return 0
  return (store.currentStep / (store.totalSteps - 1)) * 100
})

const displayStep = computed(() => {
  return store.totalSteps ? `${store.currentStep + 1} / ${store.totalSteps}` : '— / —'
})

// 进度条拖动
const isDraggingProgress = ref(false)

const startProgressDrag = (e) => {
  isDraggingProgress.value = true
  if (isAutoPlaying.value) stopAutoPlay()
  e.target.setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onProgressMove)
  window.addEventListener('pointerup', onProgressUp, { once: true })
}

const onProgressMove = (e) => {
  if (!isDraggingProgress.value || !progressRef.value) return
  const rect = progressRef.value.querySelector('.progress-track').getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const step = Math.round(ratio * (store.totalSteps - 1))
  store.goToStep(step)
}

const onProgressUp = () => {
  isDraggingProgress.value = false
  window.removeEventListener('pointermove', onProgressMove)
}

const onProgressClick = (e) => {
  if (!progressRef.value || store.totalSteps === 0) return
  const rect = progressRef.value.querySelector('.progress-track').getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const step = Math.round(ratio * (store.totalSteps - 1))
  store.goToStep(step)
}

const runCode = () => {
  if (editorRef.value) editorRef.value.clearHighlights()
  const code = editorRef.value?.getCode() || ''
  store.runCode(code)
  if (isAutoPlaying.value) stopAutoPlay()
}

function toggleUpload() {
  uploadOpen.value = !uploadOpen.value
}

const onFileLoad = ({ name, code }) => {
  editorRef.value?.setCode(code)
  store.addUploadRecord(name, code)
}

const startDrag = (e) => {
  isDragging.value = true
  if (isAutoPlaying.value) stopAutoPlay()
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e) => {
  if (!isDragging.value) return
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  let newWidth = e.clientX - rect.left
  const max = rect.width - MIN_RIGHT
  if (newWidth < MIN_LEFT) newWidth = MIN_LEFT
  if (newWidth > max) newWidth = max
  leftWidth.value = Math.round(newWidth)
}

const onMouseUp = () => {
  if (!isDragging.value) return
  isDragging.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const onWindowResize = () => {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  const max = rect.width - MIN_RIGHT
  if (leftWidth.value > max) leftWidth.value = Math.max(MIN_LEFT, Math.round(max))
  // 防止控制栏拖出窗口
  const barEl = controlBarRef.value
  if (barEl) {
    const maxX = window.innerWidth - barEl.offsetWidth
    const maxY = window.innerHeight - barEl.offsetHeight
    if (barPos.value.x > maxX) barPos.value.x = Math.max(0, maxX)
    if (barPos.value.y > maxY) barPos.value.y = Math.max(0, maxY)
  }
}

onMounted(async () => {
  await nextTick()
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) leftWidth.value = Math.round(rect.width / 2)

  // 控制栏默认居中于编辑区底部
  await nextTick()
  const barEl = controlBarRef.value
  const barW = barEl ? barEl.offsetWidth : 400
  const mainRect = containerRef.value?.getBoundingClientRect()
  const editorLeft = mainRect ? mainRect.left : 12
  const editorCenter = editorLeft + leftWidth.value / 2
  barPos.value = {
    x: Math.max(0, Math.round(editorCenter - barW / 2)),
    y: window.innerHeight - 80
  }
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('pointermove', onProgressMove)
})

// --- 自动播放 ---

const toggleAutoPlay = () => {
  if (isAutoPlaying.value) stopAutoPlay()
  else startAutoPlay()
}

const startAutoPlay = () => {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (store.currentStep + 1 >= store.totalSteps) {
      stopAutoPlay()
    } else if (store.autoExplain && store.isExplaining) {
      // 等待 AI 解说生成完毕再进入下一步
      return
    } else {
      store.nextStep()
    }
  }, speed.value)
  isAutoPlaying.value = true
}

const stopAutoPlay = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  isAutoPlaying.value = false
}

watch(speed, () => {
  if (isAutoPlaying.value) startAutoPlay()
})

watch(() => store.currentLine, async (line) => {
  if (line && editorRef.value) {
    await nextTick()
    editorRef.value.highlightLine(line)
  } else if (!line && editorRef.value) {
    editorRef.value.clearHighlights()
  }
})

// --- AI 解说 ---

function toggleAiPanel() {
  store.toggleExplainPanel()
}

// 步骤切换：自动模式请求解说，手动模式优先从历史恢复
watch(() => store.currentStep, (newVal, oldVal) => {
  if (newVal === oldVal) return
  if (store.autoExplain && store.explainExpanded) {
    store.requestExplain()
  } else if (!store.isExplaining) {
    const cached = store.explainHistory[newVal]
    if (cached) {
      store.explainText = cached
      store.explainError = null
    } else {
      store.explainText = ''
      store.explainError = null
    }
  }
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}

.main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 12px;
  gap: 0;
}

.editor-card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.editor-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

/* Upload toggle button in editor header */
.upload-toggle-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s, background 0.15s, border-color 0.2s;
}
.upload-toggle-btn:hover {
  color: var(--text-h);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}
.upload-toggle-btn.active {
  color: var(--primary);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}
.upload-toggle-label {
  font-size: 12px;
  font-weight: 500;
}

/* Upload panel wrapper — slides down from header */
.upload-panel-wrapper {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  max-height: 360px;
  overflow-y: auto;
  border-radius: 0 0 12px 12px;
}
.upload-slide-enter-active {
  transition: max-height 0.3s cubic-bezier(.22,.9,.27,1), opacity 0.25s, padding 0.25s;
}
.upload-slide-leave-active {
  transition: max-height 0.22s cubic-bezier(.22,.9,.27,1), opacity 0.2s, padding 0.2s;
}
.upload-slide-enter-from,
.upload-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.upload-slide-enter-to,
.upload-slide-leave-from {
  max-height: 360px;
  opacity: 1;
}

.right-card {
  overflow: hidden;
}
.right-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.rc-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
}
.right-card-body {
  padding: 12px;
}

/* Right card tabs — matches AiTutorPanel tab style */
.right-tab {
  background: none;
  border: none;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.15s;
}
.right-tab:hover { color: var(--text); background: rgba(255,255,255,0.04); }
.right-tab.active {
  color: var(--primary);
  background: var(--accent-bg);
}

.placeholder-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
}
.placeholder-text {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

/* Splitter */
.splitter {
  width: 8px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  user-select: none;
  flex-shrink: 0;
}
.splitter:hover { background-color: rgba(255,255,255,0.04); }
.splitter .splitter-handle {
  width: 2px; height: 40px;
  background-color: rgba(255,255,255,0.10);
  border-radius: 2px;
}
.splitter.dragging { background-color: rgba(255,255,255,0.06); }

/* --- Floating control bar --- */
.control-bar {
  position: fixed;
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: 8px 14px;
  background: var(--card-bg);
  border-radius: 16px;
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
  width: fit-content;
  max-width: calc(100vw - 40px);
  min-width: 380px;
  transition: box-shadow 0.2s;
  overflow: visible;
}
.control-bar:has(.drag-handle:active) {
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}

/* Control row */
.control-bar-top {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
}

/* AI panel wrapper — floating above the control bar with gap */
.ai-panel-wrapper {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 8px);
  overflow: hidden;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
  padding: 10px 15px;
}

/* Panel slide transition (expands upward) */
.panel-slide-enter-active {
  transition: max-height 0.28s cubic-bezier(.22,.9,.27,1), opacity 0.25s, padding 0.25s;
}
.panel-slide-leave-active {
  transition: max-height 0.22s cubic-bezier(.22,.9,.27,1), opacity 0.2s, padding 0.2s;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-width: 0;
}
.panel-slide-enter-to,
.panel-slide-leave-from {
  max-height: 400px;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .panel-slide-enter-active,
  .panel-slide-leave-active {
    transition: none;
  }
}

/* Drag handle */
.drag-handle {
  cursor: grab;
  display: flex;
  align-items: center;
  padding: 4px 2px;
  border-radius: 4px;
  color: var(--text-muted);
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.drag-handle:hover {
  color: var(--text);
  background: rgba(255,255,255,0.06);
}
.drag-handle:active {
  cursor: grabbing;
}

/* Button groups */
.ctrl-btn-group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ctrl-right-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* Control buttons */
.ctrl-btn {
  background: transparent;
  border: none;
  padding: 7px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.1s;
}
.ctrl-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.08);
}
.ctrl-btn:active:not(:disabled) {
  transform: scale(0.92);
}
.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ctrl-btn.run-btn {
  color: #10b981;
  padding: 8px;
  margin: 0 4px;
}
.ctrl-btn.run-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

/* AI toggle button */
.ai-toggle-btn {
  position: relative;
  transition: color 0.2s, background 0.15s;
}
.ai-toggle-btn.active {
  color: var(--primary);
  background: var(--accent-bg);
}
.ai-toggle-btn.pulsing {
  animation: ai-pulse 1.5s ease-in-out infinite;
}
@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* Spin animation */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 0.8s linear infinite;
}

/* Progress bar */
.progress-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 120px;
}
.progress-track {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  transition: height 0.15s;
}
.progress-track:hover { height: 8px; }
.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 3px;
  pointer-events: none;
  transition: width 0.08s ease-out;
}
.progress-thumb {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  background: #fff;
  border: 2px solid #6366f1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  transition: transform 0.1s, box-shadow 0.15s;
  z-index: 2;
}
.progress-thumb:hover {
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: 0 2px 10px rgba(99,102,241,0.5);
}
.progress-thumb:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.15);
}
.progress-label {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 52px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Custom speed picker */
.speed-picker {
  position: relative;
}
.speed-btn {
  gap: 4px;
  padding: 6px 10px;
  min-width: 62px;
  justify-content: center;
}
.speed-label {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.speed-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  padding: 4px;
  z-index: 110;
}
.speed-option {
  background: none;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  text-align: center;
  transition: color 0.15s, background 0.15s;
}
.speed-option:hover {
  color: var(--text-h);
  background: rgba(255,255,255,0.06);
}
.speed-option.active {
  color: var(--primary);
  background: var(--accent-bg);
}

/* Speed dropdown transition */
.speed-drop-enter-active {
  transition: opacity 0.15s ease, transform 0.18s cubic-bezier(.22,.9,.27,1);
}
.speed-drop-leave-active {
  transition: opacity 0.12s ease, transform 0.14s cubic-bezier(.22,.9,.27,1);
}
.speed-drop-enter-from,
.speed-drop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (max-width: 640px) {
  .splitter .splitter-handle { height: 28px }
  .main-area { padding: 8px; }
  .control-bar {
    padding: 6px 10px;
    min-width: 0;
    max-width: calc(100vw - 16px);
  }
  .control-bar.has-panel { min-width: 0; }
  .control-bar-top { gap: 6px; }
  .ctrl-btn { padding: 5px; }
  .ctrl-btn.run-btn { padding: 6px; }
  .progress-wrapper { min-width: 60px; }
}

@media (prefers-reduced-motion: reduce) {
  .ai-toggle-btn.pulsing { animation: none; }
  .spin { animation: none; }
}
</style>