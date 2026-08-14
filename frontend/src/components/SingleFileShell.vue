<template>
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
        <button class="right-tab" :class="{ active: store.rightTab === 'variables' }" @click="store.switchRightTab('variables')">变量</button>
        <button class="right-tab" :class="{ active: store.rightTab === 'flow' }" @click="store.switchRightTab('flow')">流程</button>
        <button class="right-tab" :class="{ active: store.rightTab === 'datastructure' }" @click="store.switchRightTab('datastructure')">数据结构</button>
        <button class="right-tab" :class="{ active: store.rightTab === 'algorithm' }" @click="store.switchRightTab('algorithm')">算法</button>
        <button class="right-tab" :class="{ active: store.rightTab === 'tutor' }" @click="store.switchRightTab('tutor')">问答</button>
        <button class="right-tab" :class="{ active: store.rightTab === 'animate' }" @click="store.switchRightTab('animate')">动画</button>
        <!-- 壁纸选择器 -->
        <WallpaperSelector />
      </div>
      <div class="flex-1 right-card-body" :class="{ 'body-fill': store.rightTab === 'tutor' }">
        <!-- v-show：避免切换时卸载/重挂载导致高度跳动 -->
        <div v-show="store.rightTab === 'variables'" class="right-pane">
          <MemoryPanel />
          <ConsoleOutput />
        </div>
        <div v-show="store.rightTab === 'flow'" class="right-pane">
          <ControlFlowPanel v-if="store.rightTab === 'flow'" :active="true" />
        </div>
        <div v-show="store.rightTab === 'datastructure'" class="right-pane">
          <DataStructureTab />
        </div>
        <div v-show="store.rightTab === 'algorithm'" class="right-pane">
          <AlgoTab @loadCode="onClassicLoad" />
        </div>
        <div v-show="store.rightTab === 'tutor'" class="right-pane right-pane-fill">
          <AiTutorPanel embedded />
        </div>
        <div v-show="store.rightTab === 'animate'" class="right-pane">
          <SvgAnimatePanel />
        </div>
      </div>
    </div>

  </div>

  <!-- 底部控制栏：浮动可拖动，默认位于编辑区下方居中 -->
  <ControlBar mode="single" @run-single="runCode" />
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import Editor from './Editor.vue'
import MemoryPanel from './MemoryPanel.vue'
import ConsoleOutput from './ConsoleOutput.vue'
import AiTutorPanel from './AiTutorPanel.vue'
import FileUploadPanel from './FileUploadPanel.vue'
import ControlFlowPanel from './ControlFlowPanel.vue'
import WallpaperSelector from './WallpaperSelector.vue'
import TestCasePanel from './TestCasePanel.vue'
import DataStructureTab from './right-tabs/DataStructureTab.vue'
import AlgoTab from './right-tabs/AlgoTab.vue'
import SvgAnimatePanel from './SvgAnimatePanel.vue'
import ControlBar from './ControlBar.vue'

const store = usePlayerStore()
const editorRef = ref(null)
const containerRef = ref(null)
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

/** 上一次 step 的行号（灰色高亮），下一次 step 的行号（蓝色高亮） */
const prevLine = ref(null)
const nextLine = ref(null)

const runCode = async () => {
  if (editorRef.value) editorRef.value.clearHighlights()
  const code = editorRef.value?.getCode() || ''
  await store.runCode(code)
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

const startDrag = () => {
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
}

onMounted(async () => {
  await nextTick()
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    containerWidth.value = rect.width
    // ✅ 保持与初始值一致，使用0.55而不是0.5
    splitRatio.value = 0.55
  }
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

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

</script>

<style scoped>
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
.right-card-body.body-fill {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.right-pane {
  min-width: 0;
}
.right-pane-fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.right-pane-fill > * {
  flex: 1;
  min-height: 0;
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

@media (max-width: 640px) {
  .splitter .splitter-handle { height: 28px }
  .main-area { padding: 8px; }
}
</style>