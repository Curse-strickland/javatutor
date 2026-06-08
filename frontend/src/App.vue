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

    <!-- 底部控制栏：浮动圆角 -->
    <div class="control-bar">
      <button @click="runCode" :disabled="store.isLoading" :class="['btn', store.isLoading ? '' : 'btn-primary']">
        <span v-if="!store.isLoading">运行</span>
        <span v-else>运行中...</span>
      </button>
      <button @click="store.prevStep" class="btn">上一步</button>
      <button @click="store.nextStep" class="btn">下一步</button>
      <button @click="gotoLastStep" class="btn">跳到最后</button>
      <button @click="toggleAutoPlay" :class="['btn', isAutoPlaying ? '' : 'btn-primary']">
        {{ isAutoPlaying ? '暂停' : '自动播放' }}
      </button>
      <select v-model="speed" class="speed-select">
        <option value="500">2x</option>
        <option value="1000">1x</option>
        <option value="2000">0.5x</option>
      </select>
      <span class="text-sm step-counter">步骤: {{ store.currentStep + 1 }} / {{ store.totalSteps }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from './stores/player'
import Editor from './components/Editor.vue'
import VariablePanel from './components/VariablePanel.vue'
import ConsoleOutput from './components/ConsoleOutput.vue'
import GlobalStatus from './components/GlobalStatus.vue'
import HeapStackPanel from './components/HeapStackPanel.vue'

const store = usePlayerStore()
const editorRef = ref(null)
const containerRef = ref(null)
const leftWidth = ref(0)
const isDragging = ref(false)
const MIN_LEFT = 200
const MIN_RIGHT = 200
const isAutoPlaying = ref(false)
const speed = ref(1000)
let timer = null

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
  })
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
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

const gotoLastStep = () => {
  if (store.totalSteps > 0) store.currentStep = store.totalSteps - 1
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

/* Floating control bar — rounded, no border, subtle lift */
.control-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-start;
  margin: 0 12px 12px;
  padding: 10px 16px;
  background: var(--card-bg);
  border-radius: 16px;
  border: 1px solid var(--border);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  backdrop-filter: blur(8px);
}
.speed-select {
  background: var(--code-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 14px;
}
.step-counter {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .splitter .splitter-handle { height: 28px }
  .main-area { padding: 8px; gap: 4px }
  .control-bar { margin: 0 8px 8px; padding: 8px 12px }
}
</style>