<template>
  <div class="flex flex-col h-screen">
    <!-- 主要内容区：左右两栏 -->
    <div class="flex-1 flex min-h-0">
      <!-- 左侧：代码编辑器 -->
      <div class="w-1/2 border-r flex flex-col">
        <div class="flex-1 min-h-0">
          <Editor ref="editorRef" class="h-full" />
        </div>
      </div>

      <!-- 右侧：变量展示区（F2） -->
      <div class="w-1/2 bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div class="p-4 border-b">
          <h3 class="font-bold">变量展示区</h3>
        </div>
        <div class="flex-1 p-4 overflow-auto">
          <VariablePanel />
        </div>
      </div>
    </div>

    <!-- 底部控制栏（保持不变） -->
    <div class="p-2 border-t flex gap-2 items-center flex-wrap">
      <button @click="runCode" class="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded">
        运行
      </button>
      <button @click="store.prevStep" class="bg-gray-300 dark:bg-gray-700 px-3 py-1 rounded">
        上一步
      </button>
      <button @click="store.nextStep" class="bg-gray-300 dark:bg-gray-700 px-3 py-1 rounded">
        下一步
      </button>
      <button @click="toggleAutoPlay" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">
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
import { ref, watch, nextTick } from 'vue'
import { usePlayerStore } from './stores/player'
import Editor from './components/Editor.vue'
import VariablePanel from './components/VariablePanel.vue'

const store = usePlayerStore()
const editorRef = ref(null)
const isAutoPlaying = ref(false)
const speed = ref(1000)
let timer = null

const runCode = () => {
  const code = editorRef.value?.getCode() || ''
  store.runMock()   // 暂时使用 mock，后续改为真实 API
  if (isAutoPlaying.value) stopAutoPlay()
}

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