<template>
  <!-- 底部控制栏：浮动可拖动，默认位于底部居中 -->
  <div
    ref="controlBarRef"
    class="control-bar"
    :class="{ 'has-panel': store.explainExpanded }"
    :style="{ left: barPos.x + 'px', top: barPos.y + 'px', width: barWidth ? barWidth + 'px' : undefined }"
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
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter">
            <path d="M5 5v14" />
            <path d="M19 5l-10 7 10 7V5z" />
          </svg>
        </button>
        <button class="ctrl-btn" @click="store.prevStep" title="上一步" :disabled="store.currentStep <= 0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter">
            <path d="M15.5 5L7 12l8.5 7V5z" />
          </svg>
        </button>
        <button class="ctrl-btn run-btn" @click="onRun" :disabled="runDisabled" :title="mode === 'single' ? '运行代码' : '运行整个项目'">
          <svg v-if="!store.isLoading" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7 4.2v15.6L19.5 12 7 4.2z" />
          </svg>
          <svg v-else class="spin" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="12" r="8.5" stroke-dasharray="40" stroke-dashoffset="12" />
          </svg>
        </button>
        <button class="ctrl-btn" @click="store.nextStep" title="下一步" :disabled="store.currentStep >= store.totalSteps - 1">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter">
            <path d="M8.5 5L17 12l-8.5 7V5z" />
          </svg>
        </button>
        <button class="ctrl-btn" @click="store.goToLast" title="跳到最后" :disabled="store.totalSteps === 0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter">
            <path d="M5 5l10 7-10 7V5z" />
            <path d="M19 5v14" />
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
          <svg v-if="isAutoPlaying" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="miter">
            <path d="M8 5.2v13.6L18.5 12 8 5.2z" />
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
            <div v-if="speedOpen" class="speed-menu">
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
          aria-label="AI 解说"
        >
          <!-- 对话气泡 + AI 星芒：概括「智能解说」 -->
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3.5 4.5h12.5v9.5H10l-3.5 3v-3H3.5V4.5z"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linejoin="miter"
            />
            <path d="M7 8h6M7 11h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" />
            <path
              d="M18.2 3.2l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55.55-1.45z"
              fill="currentColor"
            />
            <path
              d="M20.8 8.2l.35.9.9.35-.9.35-.35.9-.35-.9-.9-.35.9-.35.35-.9z"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 右边缘：左右拖拽调整宽度 -->
    <div class="resize-handle" @pointerdown.prevent="startResize" title="左右拖拽调整宽度">
      <span class="resize-grip" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import AiTutorPanel from './AiTutorPanel.vue'

const props = defineProps({
  /** 'single' | 'multi' */
  mode: { type: String, default: 'single' },
})

const emit = defineEmits(['run-single', 'run-project'])

const store = usePlayerStore()
const controlBarRef = ref(null)
const progressRef = ref(null)
const speedPickerRef = ref(null)

// 运行按钮是否禁用：加载中禁用；多文件模式还需有文件
const runDisabled = computed(() => {
  if (store.isLoading) return true
  if (props.mode === 'multi') return store.multiState.files.length === 0
  return false
})

// --- 运行按钮 ---
async function onRun() {
  stopAutoPlay()
  if (props.mode === 'single') {
    emit('run-single')
  } else {
    emit('run-project')
  }
}

// --- 控制栏拖动 ---
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

// --- 运行栏宽度调整（左右拖拽，只能拖大不能拖小）---
const barWidth = ref(null)  // null = 自适应内容宽
const minBarWidth = ref(null)  // 原始长度作为最小宽度
const resizing = ref(false)
let resizeStartX = 0
let resizeStartW = 0

const startResize = (e) => {
  resizing.value = true
  const barEl = controlBarRef.value
  resizeStartW = barEl ? barEl.offsetWidth : 520
  if (minBarWidth.value == null) minBarWidth.value = resizeStartW
  resizeStartX = e.clientX
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp, { once: true })
}
const onResizeMove = (e) => {
  if (!resizing.value) return
  const dx = e.clientX - resizeStartX
  const maxW = window.innerWidth - 40
  const minW = minBarWidth.value ?? 380
  barWidth.value = Math.max(minW, Math.min(resizeStartW + dx, maxW))
}
const onResizeUp = () => {
  resizing.value = false
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onResizeMove)
}

// --- 进度条 ---
const progressPercent = computed(() => {
  if (store.totalSteps <= 1) return 0
  return (store.currentStep / (store.totalSteps - 1)) * 100
})

const displayStep = computed(() => {
  return store.totalSteps ? `${store.currentStep + 1} / ${store.totalSteps}` : '— / —'
})

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

// --- 自动播放 ---
const isAutoPlaying = ref(false)
const speed = ref(1000)
const speedOpen = ref(false)
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

// --- AI 解说 ---
function toggleAiPanel() {
  store.toggleExplainPanel()
}

// 步骤切换：自动模式请求解说当前步骤（自由问答聊天）
watch(() => store.currentStep, (newVal, oldVal) => {
  if (newVal === oldVal) return
  if (store.autoExplain && store.explainExpanded) {
    store.requestExplain()
  }
})

// --- 窗口调整 ---
const onWindowResize = () => {
  const barEl = controlBarRef.value
  if (barEl) {
    const maxX = window.innerWidth - barEl.offsetWidth
    const maxY = window.innerHeight - barEl.offsetHeight
    if (barPos.value.x > maxX) barPos.value.x = Math.max(0, maxX)
    if (barPos.value.y > maxY) barPos.value.y = Math.max(0, maxY)
  }
  if (barWidth.value != null) {
    barWidth.value = Math.min(barWidth.value, window.innerWidth - 40)
  }
}

onMounted(() => {
  // 等待两帧，确保 CSS 布局与字体渲染完成后再测量，避免 offsetWidth 读错导致定位偏移
  const position = () => {
    const barEl = controlBarRef.value
    const barW = barEl ? barEl.offsetWidth : 400
    // 默认出现在代码编辑区（.editor-card）下方居中位置
    const editorCard = document.querySelector('.editor-card')
    const rect = editorCard ? editorCard.getBoundingClientRect() : null
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    barPos.value = {
      x: Math.max(0, Math.round(centerX - barW / 2)),
      y: window.innerHeight - 80
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(position))
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  stopAutoPlay()
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('pointermove', onBarMove)
  window.removeEventListener('pointermove', onProgressMove)
  document.removeEventListener('click', onSpeedOutside)
})
</script>

<style scoped>
/* --- Floating control bar --- */
.control-bar {
  position: fixed;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  padding: 8px 14px;
  background: var(--card-bg);
  border-radius: 0;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
  width: fit-content;
  max-width: calc(100vw - 40px);
  min-width: 380px;
  transition: box-shadow 0.2s;
  overflow: visible;
}
.control-bar::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
  pointer-events: none;
}
.control-bar:has(.drag-handle:active) {
  box-shadow: 0 18px 40px -20px rgba(18, 22, 29, 0.45);
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
  border-radius: 0;
  clip-path: none;
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
  padding: 10px 15px;
  z-index: 5100;
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
  border-radius: 0;
  color: var(--text-muted);
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.drag-handle:hover {
  color: var(--text-h);
  background: var(--accent-bg);
}
.drag-handle:active {
  cursor: grabbing;
}

/* Resize handle（右边缘左右拖拽调整宽度） */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  color: var(--accent);
  z-index: 3;
}
.resize-grip {
  display: block;
  width: 3px;
  height: 28px;
  background: currentColor;
  opacity: 0.6;
  border-radius: 0;
}

/* Button groups */
.ctrl-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ctrl-right-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

/* Control buttons — Rhodes HUD */
.ctrl-btn {
  background: var(--btn-bg);
  border: none;
  padding: 7px;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-h);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: color 0.15s, transform 0.12s, box-shadow 0.15s, background 0.15s;
}
.ctrl-btn:hover:not(:disabled) {
  background: var(--accent-bg);
  box-shadow: inset 0 0 0 1px var(--accent);
  color: var(--accent);
  transform: translateY(-1px);
}
.ctrl-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.96);
}
.ctrl-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ctrl-btn.run-btn {
  color: #fff;
  background: var(--accent);
  box-shadow: 0 10px 22px -12px rgba(13, 158, 196, 0.65);
  padding: 8px;
  margin: 0 4px;
}
.ctrl-btn.run-btn:hover:not(:disabled) {
  background: var(--primary-600);
  color: #fff;
  box-shadow: 0 12px 24px -12px rgba(13, 158, 196, 0.75);
}

/* AI toggle button */
.ai-toggle-btn {
  position: relative;
  gap: 4px;
  padding: 6px 10px;
  background: var(--btn-bg);
}
.ai-toggle-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-bg);
}
.ai-toggle-btn.active {
  color: var(--accent);
  background: var(--accent-bg);
  box-shadow: inset 0 0 0 1px var(--accent);
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
  background: var(--border);
  border-radius: 0;
  clip-path: polygon(3px 0, 100% 0, 100% 100%, 0 100%, 0 3px);
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
  background: repeating-linear-gradient(-45deg, var(--accent) 0 6px, rgba(13, 158, 196, 0.55) 6px 12px);
  border-radius: 0;
  pointer-events: none;
  transition: width 0.08s ease-out;
}
.progress-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: var(--btn-bg);
  border: 2px solid var(--accent);
  border-radius: 0;
  clip-path: polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px);
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: 0 2px 6px rgba(18, 22, 29, 0.18);
  transition: transform 0.1s, box-shadow 0.15s;
  z-index: 2;
}
.progress-thumb:hover {
  transform: translate(-50%, -50%) scale(1.15);
  box-shadow: 0 2px 10px rgba(13, 158, 196, 0.35);
}
.progress-thumb:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.1);
}
.progress-label {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 5.5em;
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
  background: var(--btn-bg);
}
.speed-label {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
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
  z-index: 5100;
  clip-path: none;
  border-radius: 0;
  background: var(--card-bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
}
.speed-option {
  background: none;
  border: none;
  padding: 6px 12px;
  border-radius: 0;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  cursor: pointer;
  text-align: center;
  transition: color 0.15s, background 0.15s;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
}
.speed-option:hover {
  color: var(--text-h);
  background: var(--accent-bg);
}
.speed-option.active {
  color: var(--accent);
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
