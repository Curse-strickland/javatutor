<template>
  <div class="app-shell">
    <GlobalStatus />
    <!-- 主要内容区：左右两张圆角大卡片 -->
    <div ref="containerRef" class="main-area">
      <!-- 左侧：代码编辑器卡片 -->
      <div :style="{ width: leftWidth + 'px' }" class="editor-card flex-none">
        <Editor ref="editorRef" class="h-full" />
      </div>

      <!-- 可拖拽分割条 -->
      <div class="splitter" @mousedown.prevent="startDrag" :class="{ 'dragging': isDragging }" aria-hidden="true">
        <div class="splitter-handle" />
      </div>

      <!-- 右侧：变量展示卡片 -->
      <div class="flex-1 right-card card flex flex-col">
        <div class="right-card-header">
          <span class="rc-dot" />
          <h3 class="font-bold">变量展示区</h3>
        </div>
        <div class="flex-1 overflow-auto right-card-body">
          <VariablePanel />
          <HeapStackPanel />
          <ConsoleOutput />
        </div>
      </div>
    </div>

    <!-- 底部控制栏：浮动可拖动 -->
    <div
      class="control-bar"
      :style="{ left: barPos.x + 'px', top: barPos.y + 'px' }"
      @pointerdown.stop
    >
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

      <!-- 左侧：播放控制按钮组 -->
      <div class="ctrl-btn-group">
        <!-- 跳到第一步 -->
        <button class="ctrl-btn" @click="store.goToFirst" title="跳到第一步" :disabled="store.totalSteps === 0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <rect x="4" y="5" width="2.5" height="14" rx="0.5"/>
            <polygon points="20,5 9,12 20,19"/>
          </svg>
        </button>
        <!-- 上一步 -->
        <button class="ctrl-btn" @click="store.prevStep" title="上一步" :disabled="store.currentStep <= 0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="15,5 6,12 15,19"/>
          </svg>
        </button>
        <!-- 运行 / 运行中指示 -->
        <button class="ctrl-btn run-btn" @click="runCode" :disabled="store.isLoading" title="运行代码">
          <svg v-if="!store.isLoading" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <polygon points="6,3 21,12 6,21"/>
          </svg>
          <svg v-else class="spin" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="9" stroke-dasharray="42" stroke-dashoffset="14"/>
          </svg>
        </button>
        <!-- 下一步 -->
        <button class="ctrl-btn" @click="store.nextStep" title="下一步" :disabled="store.currentStep >= store.totalSteps - 1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="9,5 18,12 9,19"/>
          </svg>
        </button>
        <!-- 跳到最后一步 -->
        <button class="ctrl-btn" @click="store.goToLast" title="跳到最后" :disabled="store.totalSteps === 0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="4,5 15,12 4,19"/>
            <rect x="17.5" y="5" width="2.5" height="14" rx="0.5"/>
          </svg>
        </button>
      </div>

      <!-- 中间：可拖动进度条 -->
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

      <!-- 右侧：自动播放 + 速度选择 -->
      <div class="ctrl-right-group">
        <!-- 自动播放 / 暂停 -->
        <button class="ctrl-btn" @click="toggleAutoPlay" :title="isAutoPlaying ? '暂停自动播放' : '开始自动播放'" :disabled="store.totalSteps === 0">
          <!-- 暂停图标：两竖 -->
          <svg v-if="isAutoPlaying" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" rx="1"/>
            <rect x="14" y="4" width="5" height="16" rx="1"/>
          </svg>
          <!-- 播放图标：三角形 -->
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="7,4 19,12 7,20"/>
          </svg>
        </button>
        <!-- 速度选择 -->
        <select v-model="speed" class="speed-select" title="播放速度">
          <option value="500">2x</option>
          <option value="1000">1x</option>
          <option value="2000">0.5x</option>
        </select>
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

const store = usePlayerStore()
const editorRef = ref(null)
const containerRef = ref(null)
const progressRef = ref(null)
const leftWidth = ref(0)
const isDragging = ref(false)
const MIN_LEFT = 200
const MIN_RIGHT = 200
const isAutoPlaying = ref(false)
const speed = ref(1000)
let timer = null

// 控制栏拖动
const barPos = ref({ x: 0, y: 0 })
const barDragging = ref(false)
let barOffset = { x: 0, y: 0 }
const controlBarRef = ref(null)

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
  const maxX = window.innerWidth - 480
  const maxY = window.innerHeight - 60
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
  const code = editorRef.value?.getCode() || ''
  store.runCode(code)   // （已改）暂时使用 mock，后续改为真实 API
  if (isAutoPlaying.value) stopAutoPlay()
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
}

onMounted(() => {
  nextTick(() => {
    const rect = containerRef.value?.getBoundingClientRect()
    if (rect) leftWidth.value = Math.round(rect.width / 2)
    // 初始化控制栏位置：底部居中
    const barW = Math.min(520, window.innerWidth - 40)
    barPos.value = {
      x: Math.round((window.innerWidth - barW) / 2),
      y: window.innerHeight - 70
    }
  })
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('pointermove', onProgressMove)
})

const toggleAutoPlay = () => {
  if (isAutoPlaying.value) stopAutoPlay()
  else startAutoPlay()
}

const startAutoPlay = () => {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (store.currentStep + 1 >= store.totalSteps) {
      stopAutoPlay()
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
  }
})
</script>

<style scoped>
/* Shell — subtle dot grid texture for depth */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* Main area — breathing room between cards */
.main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 12px;
  gap: 0;
}

/* Editor card — card visuals inline, Monaco fills it */
.editor-card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
  padding: 0;
}

/* Right card — header + scroll body */
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

/* Splitter — subtle drag handle between cards */
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

/* Floating control bar — fixed, draggable */
.control-bar {
  position: fixed;
  z-index: 100;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 14px;
  background: var(--card-bg);
  border-radius: 16px;
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
  width: fit-content;
  max-width: calc(100vw - 24px);
  transition: box-shadow 0.2s;
}
.control-bar:has(.drag-handle:active) {
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}

/* 拖动手柄 */
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

/* 按钮组 */
.ctrl-btn-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 右侧功能组（自动播放 + 速度） */
.ctrl-right-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* 控制按钮基础样式 */
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

/* 运行按钮特殊样式 */
.ctrl-btn.run-btn {
  color: #10b981;
  padding: 8px;
  margin: 0 4px;
}
.ctrl-btn.run-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

/* 旋转动画（运行中） */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 0.8s linear infinite;
}

/* 进度条 */
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
.progress-track:hover {
  height: 8px;
}
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
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 52px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.speed-select {
  background: var(--code-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 13px;
  cursor: pointer;
}

@media (max-width: 640px) {
  .splitter .splitter-handle { height: 28px }
  .main-area { padding: 8px; gap: 4px }
  .control-bar { padding: 6px 10px; gap: 6px; max-width: calc(100vw - 16px); }
  .ctrl-btn { padding: 5px; }
  .ctrl-btn.run-btn { padding: 6px; }
  .progress-wrapper { min-width: 80px; }
}
</style>