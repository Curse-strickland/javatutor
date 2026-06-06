<template>
  <div class="flex flex-col h-screen">
    <GlobalStatus />
    <!-- 主要内容区：左右两栏（支持拖拽调整宽度） -->
    <div ref="containerRef" class="flex-1 flex min-h-0">
      <!-- 左侧：代码编辑器（宽度由 leftWidth 控制） -->
      <div :style="{ width: leftWidth + 'px' }" class="border-r flex flex-col flex-none">
        <div class="flex-1 min-h-0">
          <Editor ref="editorRef" class="h-full" />
        </div>
      </div>

      <!-- 可拖拽分割条 -->
      <div class="splitter" @mousedown.prevent="startDrag" :class="{ 'dragging': isDragging }" aria-hidden="true">
        <div class="splitter-handle" />
      </div>

      <!-- 右侧：变量展示区（F2） -->
      <div class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div class="p-4 border-b">
          <h3 class="font-bold">变量展示区</h3>
        </div>
        <div class="flex-1 p-4 overflow-auto">
          <VariablePanel />
        </div>
      </div>
    </div>

    <!-- 底部控制栏（Apple 风格） -->
    <div class="control-bar p-2">
      <button @click="runCode" :disabled="store.isLoading" :class="['btn', store.isLoading ? '' : 'btn-primary']">
        <span v-if="!store.isLoading">运行</span>
        <span v-else>运行中...</span>
      </button>
      <button @click="store.prevStep" class="btn">上一步</button>
      <button @click="store.nextStep" class="btn">下一步</button>
      <button @click="toggleAutoPlay" :class="['btn', isAutoPlaying ? '' : 'btn-primary']">
        {{ isAutoPlaying ? '暂停' : '自动播放' }}
      </button>
      <select v-model="speed" class="border rounded px-2 py-1 bg-white dark:bg-gray-800">
        <option value="500">0.5x</option>
        <option value="1000">1x</option>
        <option value="2000">2x</option>
      </select>
      <span class="text-sm">步骤: {{ store.currentStep + 1 }} / {{ store.totalSteps }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from './stores/player'
import Editor from './components/Editor.vue'
import VariablePanel from './components/VariablePanel.vue'
import GlobalStatus from './components/GlobalStatus.vue'

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
.splitter {
  width: 8px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  user-select: none;
}
.splitter:hover {
  background-color: rgba(0,0,0,0.04);
}
.splitter .splitter-handle {
  width: 2px;
  height: 40px;
  background-color: rgba(156,163,175,0.6);
  border-radius: 2px;
}
.splitter.dragging {
  background-color: rgba(0,0,0,0.06);
}
@media (max-width: 640px) { .splitter .splitter-handle { height: 28px } }
</style>