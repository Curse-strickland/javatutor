<template>
  <div class="app-shell">
    <BootIntro v-if="showBootIntro" @done="showBootIntro = false" />
    <ModeBar />
    <VideoBackground />
    <AudioBackground />
    <Live2DWidget />
    <GlobalStatus />

    <div class="runtime-wire" aria-label="运行时数据流">
      <div class="wire-left">
        <span class="wire-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
            <path d="M5 1h18l4 4v18l-4 4H5l-4-4V5l4-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/>
            <circle class="wire-pulse-dot" cx="14" cy="14" r="4.5" fill="currentColor" opacity="1"/>
            <circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 3.5" opacity="0.4"/>
          </svg>
        </span>
        <span class="wire-title">
          <b>RUNTIME WIRE</b>
          <span>教学终端 · HEARTBEAT</span>
        </span>
      </div>
      <div class="wire-row">
        <div class="marquee-track">
          <span v-for="(item, i) in wireItems" :key="'a'+i" class="wire-item">
            <span class="wire-dot">·</span>{{ item.name }}
            <span class="wire-coord">{{ item.coord }}</span>
          </span>
          <span v-for="(item, i) in wireItems" :key="'b'+i" class="wire-item" aria-hidden="true">
            <span class="wire-dot">·</span>{{ item.name }}
            <span class="wire-coord">{{ item.coord }}</span>
          </span>
        </div>
      </div>
    </div>

    <div ref="containerRef" class="main-area">
      <!-- 左侧：代码编辑器卡片 -->
      <div :style="{ width: leftWidth + 'px' }" class="editor-card flex-none flex flex-col">
        <div class="editor-card-header">
          <span class="rc-dot" />
          <span class="panel-kicker"> CODE</span>
          <span class="text-sm font-semibold" style="color: var(--text-h)">你的代码</span>
          <span v-if="!store.testMode" class="testmode-hint" title="非测试模式：请输入包含 main 方法的完整 Java 代码">非测试模式请输完整代码</span>
          <span class="highlight-legend">
            <span class="legend-item"><span class="legend-arrow" style="color: rgba(128,128,128,0.50)">▶</span>上一步</span>
            <span class="legend-item"><span class="legend-arrow" style="color: #fbbf24">▶</span>当前</span>
            <span class="legend-item"><span class="legend-arrow" style="color: rgba(13,158,196,0.55)">▶</span>下一步</span>
          </span>
          <button
            class="testmode-btn"
            :class="{ active: store.testCases.length > 0, open: testCaseOpen }"
            @click="toggleTestCase"
            title="测试模式"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="9" x2="15" y2="9"/>
              <line x1="9" y1="13" x2="15" y2="13"/>
              <line x1="9" y1="17" x2="12" y2="17"/>
            </svg>
            <span class="upload-toggle-label">测试</span>
          </button>
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
        <!-- 测试用例面板（向下滑出） -->
        <transition name="upload-slide">
          <div v-if="testCaseOpen" class="upload-panel-wrapper">
            <TestCasePanel @save="onSaveTestCases" @clear="onClearTestCases" />
          </div>
        </transition>
        <div class="flex-1 min-h-0">
          <Editor ref="editorRef" class="h-full" />
        </div>
      </div>

      <!-- 可拖拽分割条 -->
      <div class="splitter" @mousedown.prevent="startDrag" aria-hidden="true">
        <div class="splitter-handle" />
      </div>

      <!-- 右侧：标签页卡片 -->
      <div :style="{ width: rightWidth + 'px', minWidth: MIN_RIGHT + 'px' }" class="right-card card flex flex-col">
        <div class="right-card-header">
          <span class="rc-dot" />
          <span class="panel-kicker">INSPECT</span>
          <button
            class="right-tab"
            :class="{ active: store.rightTab === 'variables' }"
            @click="store.switchRightTab('variables')"
          >变量</button>
          <button
            class="right-tab"
            :class="{ active: store.rightTab === 'flow' }"
            @click="store.switchRightTab('flow')"
          >流程</button>
          <button
            class="right-tab"
            :class="{ active: store.rightTab === 'files' }"
            @click="store.switchRightTab('files')"
          >经典</button>
          <!-- 壁纸选择器 -->
          <WallpaperSelector />
        </div>
        <div class="flex-1 right-card-body">
          <!-- v-show：避免切换时卸载/重挂载导致高度跳动 -->
          <div v-show="store.rightTab === 'variables'" class="right-pane">
            <MemoryPanel />
            <ConsoleOutput />
          </div>
          <div v-show="store.rightTab === 'flow'" class="right-pane">
            <ControlFlowPanel />
          </div>
          <div v-show="store.rightTab === 'files'" class="right-pane">
            <ClassicCodePanel @loadCode="onClassicLoad" />
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
          <button class="ctrl-btn run-btn" @click="runCode" :disabled="store.isLoading" title="运行代码">
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
    </div>

    <footer class="site-disclaimer" role="contentinfo">
      本网站为非官方的个人开源教学项目，与鹰角网络（Hypergryph）无关。 网站内出现的「拉普兰德」角色形象及相关视觉元素版权归鹰角网络所有；Live2D 模型作者为 @人形社畜（原画/UI）、@小布朗尼OwO（建模）。 本站承诺不进行任何商业化盈利。
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, provide } from 'vue'
import { usePlayerStore } from './stores/player'
import Editor from './components/Editor.vue'
import MemoryPanel from './components/MemoryPanel.vue'
import ConsoleOutput from './components/ConsoleOutput.vue'
import GlobalStatus from './components/GlobalStatus.vue'
import AiTutorPanel from './components/AiTutorPanel.vue'
import FileUploadPanel from './components/FileUploadPanel.vue'
import ClassicCodePanel from './components/ClassicCodePanel.vue'
import ControlFlowPanel from './components/ControlFlowPanel.vue'
import WallpaperSelector from './components/WallpaperSelector.vue'
import VideoBackground from './components/VideoBackground.vue'
import AudioBackground from './components/AudioBackground.vue'
import Live2DWidget from './components/Live2DWidget.vue'
import TestCasePanel from './components/TestCasePanel.vue'
import BootIntro from './components/BootIntro.vue'
import ModeBar from './components/ModeBar.vue'

const showBootIntro = ref(true)
/** intro 期间压住看板娘；主界面出来后再升起（不改版面） */
watch(showBootIntro, (active) => {
  document.body.classList.toggle('boot-intro-active', active)
}, { immediate: true })
onBeforeUnmount(() => {
  document.body.classList.remove('boot-intro-active')
})
const store = usePlayerStore()
const wireItems = [
  { name: 'TRACE', coord: 'AST' },
  { name: 'STEP', coord: 'PLAYBACK' },
  { name: 'HEAP', coord: 'VIEW' },
  { name: 'STACK', coord: 'FRAME' },
  { name: 'AI TUTOR', coord: 'COZE' },
  { name: 'SANDBOX', coord: 'JDK17' },
  { name: 'LIVE2D', coord: 'OP' },
]
const videoSrc = ref('')
provide('videoSrc', videoSrc)
const audioSrc = ref('')
provide('audioSrc', audioSrc)
const audioVolume = ref(0.3)
provide('audioVolume', audioVolume)
const editorRef = ref(null)
const containerRef = ref(null)
const progressRef = ref(null)
const controlBarRef = ref(null)
const containerWidth = ref(0)
const splitRatio = ref(0.55)  // 默认左侧占55%，右侧45%
const uploadOpen = ref(false)
const testCaseOpen = ref(false)
const MIN_LEFT = 400   // 增加最小宽度从200到400
const MIN_RIGHT = 350  // 增加最小宽度从200到350
const leftWidth = computed(() => {
  const raw = containerWidth.value * splitRatio.value
  // ✅ 确保在居中布局下也能正确计算宽度
  return Math.round(Math.max(MIN_LEFT, Math.min(raw, containerWidth.value - MIN_RIGHT)))
})
const rightWidth = computed(() => {
  // 右侧宽度 = 总宽度 - 左侧宽度 - 分割条宽度(12px)
  return Math.max(MIN_RIGHT, containerWidth.value - leftWidth.value - 12)
})
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

const runCode = async () => {
  if (editorRef.value) editorRef.value.clearHighlights()
  const code = editorRef.value?.getCode() || ''
  await store.runCode(code)
  if (isAutoPlaying.value) stopAutoPlay()
  // 显式高亮第一步：黄色=step0，蓝色=step1，灰色=无
  prevLine.value = null
  nextLine.value = store.totalSteps > 1 ? (store.steps[1]?.line || null) : null
  await nextTick()
  if (editorRef.value && store.currentLine) {
    editorRef.value.highlightLine(store.currentLine, null, nextLine.value)
  }
}

function toggleUpload() {
  uploadOpen.value = !uploadOpen.value
}

function toggleTestCase() {
  testCaseOpen.value = !testCaseOpen.value
}

const onSaveTestCases = (testCases) => {
  store.saveTestCases(testCases)
  testCaseOpen.value = false
}

const onClearTestCases = () => {
  store.clearTestCases()
  testCaseOpen.value = false
}

const onFileLoad = ({ name, code }) => {
  editorRef.value?.setCode(code)
  store.addUploadRecord(name, code)
}

const onClassicLoad = ({ name, code }) => {
  editorRef.value?.setCode(code)
  store.addUploadRecord(name, code)
}

const startDrag = (e) => {
  if (isAutoPlaying.value) stopAutoPlay()
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e) => {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  containerWidth.value = rect.width
  splitRatio.value = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

const onMouseUp = () => {
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const onWindowResize = () => {
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  containerWidth.value = rect.width
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
  if (rect) {
    containerWidth.value = rect.width
    // ✅ 保持与初始值一致，使用0.55而不是0.5
    splitRatio.value = 0.55
  }

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

/** 上一次 step 的行号（灰色高亮），下一次 step 的行号（蓝色高亮） */
const prevLine = ref(null)
const nextLine = ref(null)

watch(() => store.currentStep, async (step) => {
  prevLine.value = step > 0 ? (store.steps[step - 1]?.line || null) : null
  nextLine.value = step < store.totalSteps - 1 ? (store.steps[step + 1]?.line || null) : null
  const line = store.currentLine
  if (line && editorRef.value) {
    await nextTick()
    editorRef.value.highlightLine(line, prevLine.value, nextLine.value)
  } else if (!line && editorRef.value) {
    editorRef.value.clearHighlights()
  }
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

</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: transparent;
  position: relative;
  font-family: var(--sans);
  z-index: 1;
}
.site-disclaimer {
  position: fixed;
  right: 12px;
  left: auto;
  bottom: 8px;
  z-index: 3;
  margin: 0;
  padding: 0;
  pointer-events: none;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  opacity: 0.78;
  text-align: right;
  max-width: min(420px, calc(100vw - 24px));
}
@media (max-width: 720px) {
  .site-disclaimer {
    font-size: 11px;
    opacity: 0.72;
  }
}
/* 蓝图网格铺底（模板装饰，不占布局） */
.app-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(18, 22, 29, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(18, 22, 29, 0.045) 1px, transparent 1px);
  background-size: 56px 56px;
}

/* ---- Runtime wire banner (prototype .wire, compact) ---- */
.runtime-wire {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(170px, 240px) 1fr;
  align-items: stretch;
  min-height: 44px;
  margin: 10px 12px 0;
  background: var(--card-bg);
  border: 1px solid var(--line, var(--border));
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: var(--shadow);
}
.runtime-wire::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 120px;
  height: 2px;
  background: var(--accent);
}
.wire-left {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-right: 1px solid var(--line, var(--border));
}
.wire-mark {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}
.wire-pulse-dot {
  animation: wire-pulse 1.6s steps(2) infinite;
}
@keyframes wire-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.18; }
}
.wire-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}
.wire-title b {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-h);
}
.wire-title span {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.wire-row {
  overflow: hidden;
  display: flex;
  align-items: center;
  white-space: nowrap;
  min-width: 0;
}
.marquee-track {
  display: inline-flex;
  gap: 28px;
  padding-right: 28px;
  animation: wire-marquee 42s linear infinite;
}
.wire-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
}
.wire-dot { color: var(--accent); }
.wire-coord {
  color: var(--text-muted);
  font-size: 9px;
}
@keyframes wire-marquee { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
  .wire-pulse { animation: none; }
}
@media (max-width: 720px) {
  .runtime-wire { grid-template-columns: 1fr; }
  .wire-left { border-right: none; border-bottom: 1px solid var(--border); }
}

.main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 10px 12px 12px;
  gap: 0;
  background: transparent;
  align-items: stretch;
  position: relative;
  z-index: 1;
}

.editor-card {
  --cut: 12px;
  background: var(--card-bg);
  border-radius: 0;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
  min-width: 0;
  clip-path: polygon(
    var(--cut) 0, 100% 0,
    100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%,
    0 100%, 0 var(--cut)
  );
  /* 不加重 blur：与 right-card 一致，透明度只由 --card-bg 决定 */
}
.editor-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: relative;
  background: var(--editor-header-bg);
}
.editor-card-header::after,
.right-card-header::after {
  content: '';
  position: absolute;
  left: 16px;
  bottom: -1px;
  width: 88px;
  height: 2px;
  background: var(--accent);
}
.panel-kicker {
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Upload toggle button in editor header */
.upload-toggle-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 0;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.2s, background 0.15s, border-color 0.2s;
  position: relative;
  z-index: 100;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
}
.upload-toggle-btn:hover {
  color: var(--text-h);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.upload-toggle-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.upload-toggle-label {
  font-size: 11px;
  font-weight: 700;
}

/* 测试模式按钮：与导入按钮共享样式，但独立 class 供看板娘精准匹配 */
.testmode-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 0;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.2s, background 0.15s, border-color 0.2s;
  position: relative;
  z-index: 100;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
}
.testmode-btn:hover {
  color: var(--text-h);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.testmode-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.testmode-btn + .upload-toggle-btn {
  margin-left: 6px;
}

/* 非测试模式提示 */
.testmode-hint {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 0;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
  background: rgba(13, 158, 196, 0.08);
  border: 1px solid var(--accent-border);
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--accent);
  white-space: nowrap;
  cursor: default;
}

/* 高亮图例 — "你的代码"右侧 */
.highlight-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 12px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.legend-arrow {
  font-size: 10px;
  line-height: 1;
}

/* Upload panel wrapper — slides down from header */
.upload-panel-wrapper {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  max-height: 360px;
  overflow-y: auto;
  border-radius: 0;
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
  --cut: 12px;
  background: var(--card-bg);
  border: 1px solid var(--line, var(--border));
  box-shadow: var(--shadow);
  clip-path: polygon(
    var(--cut) 0, 100% 0,
    100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%,
    0 100%, 0 var(--cut)
  );
}
.right-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  position: relative;
  background: var(--editor-header-bg);
}
.rc-dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  background: var(--accent);
  clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  opacity: 1;
  animation: wire-pulse 2s steps(2) infinite;
}
.right-card-body {
  padding: 12px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  /* 预留滚动条槽，避免变量/流程内容高度不同时出现/消失导致横向抖动 */
  scrollbar-gutter: stable;
}
.right-pane {
  min-width: 0;
}

/* Right card tabs — matches AiTutorPanel tab style */
.right-tab {
  background: none;
  border: none;
  padding: 5px 12px 6px;
  border-radius: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.15s, box-shadow 0.15s;
  position: relative;
}
.right-tab:hover { color: var(--text-h); background: var(--accent-bg); }
.right-tab.active {
  color: var(--accent);
  background: transparent;
  box-shadow: inset 0 -2px 0 var(--accent);
}

/* Splitter */
.splitter {
  width: 12px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  user-select: none;
  flex-shrink: 0;
  position: relative;
}
.splitter:hover {
  background-color: rgba(13, 158, 196, 0.06);
}
.splitter:hover .splitter-handle {
  background-color: var(--accent);
  opacity: 0.9;
}
.splitter .splitter-handle {
  width: 3px;
  height: 60px;
  background-color: var(--line-strong);
  border-radius: 0;
  transition: all 0.2s ease;
}
.splitter.dragging {
  background-color: rgba(13, 158, 196, 0.1);
}
.splitter.dragging .splitter-handle {
  background-color: var(--accent);
  opacity: 1;
  transform: scaleY(1.1);
}

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
  /* 不可对整栏用 clip-path：会裁掉上方展开的速度菜单 / AI 面板 */
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
  min-width: 5.5em; /* 稳定「1 / 999」宽度，避免运行后底栏变宽抖动 */
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