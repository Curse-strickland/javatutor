<template>
  <div ref="containerRef" class="main-area">
    <!-- 左侧：多文件编辑器卡片 -->
    <div :style="{ width: leftWidth + 'px' }" class="editor-card flex-none flex flex-col">
      <div class="editor-card-header">
        <span class="rc-dot" />
        <span class="panel-kicker">PROJECT</span>
        <span class="text-sm font-semibold" style="color: var(--text-h)">多文件项目</span>
        <span class="highlight-legend">
          <span class="legend-item"><span class="legend-arrow" style="color: rgba(128,128,128,0.50)">▶</span>上一步</span>
          <span class="legend-item"><span class="legend-arrow" style="color: #fbbf24">▶</span>当前</span>
          <span class="legend-item"><span class="legend-arrow" style="color: rgba(13,158,196,0.55)">▶</span>下一步</span>
        </span>
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
          <FileUploadPanel mode="multi" @load-files="onLoadFiles" />
        </div>
      </transition>

      <FileTabsBar />

      <div class="flex-1 min-h-0 editor-wrap">
        <Editor
          v-if="activeCode !== null"
          ref="editorRef"
          class="h-full"
          :read-only="false"
        />
        <div v-else class="editor-empty">
          <p>点击「导入」添加 .java 文件</p>
        </div>
      </div>
    </div>

    <!-- 可拖拽分割条 -->
    <div class="splitter" @mousedown.prevent="startDrag" aria-hidden="true">
      <div class="splitter-handle" />
    </div>

    <!-- 右侧：标签页卡片（与单文件一致 + UML 架构图） -->
    <div :style="{ width: rightWidth + 'px', minWidth: MIN_RIGHT + 'px' }" class="right-card card flex flex-col">
      <div class="right-card-header">
        <span class="rc-dot" />
        <span class="panel-kicker">INSPECT</span>
        <button class="right-tab" :class="{ active: activeTab === 'variables' }" @click="switchTab('variables')">变量</button>
        <button class="right-tab" :class="{ active: activeTab === 'flow' }" @click="switchTab('flow')">流程</button>
        <button class="right-tab" :class="{ active: activeTab === 'datastructure' }" @click="switchTab('datastructure')">数据结构</button>
        <button class="right-tab" :class="{ active: activeTab === 'algorithm' }" @click="switchTab('algorithm')">算法</button>
        <button class="right-tab" :class="{ active: activeTab === 'tutor' }" @click="switchTab('tutor')">问答</button>
        <button class="right-tab" :class="{ active: activeTab === 'animate' }" @click="switchTab('animate')">动画</button>
        <button class="right-tab" :class="{ active: activeTab === 'uml-flow' }" @click="switchTab('uml-flow')">调用关系</button>
        <button class="right-tab" :class="{ active: activeTab === 'uml-dataflow' }" @click="switchTab('uml-dataflow')">数据流</button>
        <button class="right-tab" :class="{ active: activeTab === 'uml-structure' }" @click="switchTab('uml-structure')">结构</button>
        <button class="right-tab" :class="{ active: activeTab === 'uml-class' }" @click="switchTab('uml-class')">类图</button>
        <button class="right-tab" :class="{ active: activeTab === 'uml-usecase' }" @click="switchTab('uml-usecase')">用例</button>
        <!-- 壁纸选择器 -->
        <WallpaperSelector />
      </div>
      <div class="flex-1 right-card-body" :class="{ 'body-fill': activeTab === 'tutor' }">
        <!-- v-show：避免切换时卸载/重挂载导致高度跳动 -->
        <div v-show="activeTab === 'variables'" class="right-pane">
          <MemoryPanel />
          <ConsoleOutput />
        </div>
        <div v-show="activeTab === 'flow'" class="right-pane">
          <ControlFlowPanel v-if="activeTab === 'flow'" :active="true" />
        </div>
        <div v-show="activeTab === 'datastructure'" class="right-pane">
          <DataStructureTab />
        </div>
        <div v-show="activeTab === 'algorithm'" class="right-pane">
          <AlgoTab @loadCode="onClassicLoad" />
        </div>
        <div v-show="activeTab === 'tutor'" class="right-pane right-pane-fill">
          <AiTutorPanel embedded />
        </div>
        <div v-show="activeTab === 'animate'" class="right-pane">
          <SvgAnimatePanel />
        </div>
        <div v-show="activeTab === 'uml-flow'" class="right-pane">
          <FlowDiagramPanel />
        </div>
        <div v-show="activeTab === 'uml-dataflow'" class="right-pane">
          <UmlPanel kind="dataflow" :files="store.multiState.files" />
        </div>
        <div v-show="activeTab === 'uml-structure'" class="right-pane">
          <StructureDiagramPanel />
        </div>
        <div v-show="activeTab === 'uml-class'" class="right-pane">
          <ClassDiagramPanel />
        </div>
        <div v-show="activeTab === 'uml-usecase'" class="right-pane">
          <UmlPanel kind="usecase" :files="store.multiState.files" />
        </div>
      </div>
    </div>
  </div>

  <!-- 底部控制栏：浮动可拖动，默认位于编辑区下方居中 -->
  <ControlBar mode="multi" @run-project="onRunProject" />
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import Editor from './Editor.vue'
import FileTabsBar from './FileTabsBar.vue'
import FileUploadPanel from './FileUploadPanel.vue'
import MemoryPanel from './MemoryPanel.vue'
import ConsoleOutput from './ConsoleOutput.vue'
import AiTutorPanel from './AiTutorPanel.vue'
import ControlFlowPanel from './ControlFlowPanel.vue'
import WallpaperSelector from './WallpaperSelector.vue'
import DataStructureTab from './right-tabs/DataStructureTab.vue'
import AlgoTab from './right-tabs/AlgoTab.vue'
import SvgAnimatePanel from './SvgAnimatePanel.vue'
import UmlPanel from './UmlPanel.vue'
import FlowDiagramPanel from './FlowDiagramPanel.vue'
import ClassDiagramPanel from './ClassDiagramPanel.vue'
import StructureDiagramPanel from './StructureDiagramPanel.vue'
import ControlBar from './ControlBar.vue'

const store = usePlayerStore()
const editorRef = ref(null)
const containerRef = ref(null)
const containerWidth = ref(0)
const splitRatio = ref(0.55)
const uploadOpen = ref(false)
// UML 栏目：null 表示未选中 UML（显示基础 6 栏），否则为 flow/dataflow/structure/class/usecase
const activeUmlKind = ref(null)
const activeTab = computed(() => activeUmlKind.value ? `uml-${activeUmlKind.value}` : store.rightTab)
const MIN_LEFT = 400
const MIN_RIGHT = 350

const leftWidth = computed(() => {
  const raw = containerWidth.value * splitRatio.value
  return Math.round(Math.max(MIN_LEFT, Math.min(raw, containerWidth.value - MIN_RIGHT)))
})
const rightWidth = computed(() => Math.max(MIN_RIGHT, containerWidth.value - leftWidth.value - 12))

const activeCode = computed(() => {
  const files = store.multiState.files
  const idx = store.multiState.activeFileIndex
  if (!files.length || idx < 0 || idx >= files.length) return null
  return files[idx].code
})

const activeFileName = computed(() => {
  const files = store.multiState.files
  const idx = store.multiState.activeFileIndex
  if (!files.length || idx < 0 || idx >= files.length) return null
  return files[idx].name
})

// 保存当前文件编辑内容到 store（切换文件 / 运行前调用）
function saveActiveFile() {
  const idx = store.multiState.activeFileIndex
  if (idx < 0 || idx >= store.multiState.files.length) return
  const code = editorRef.value?.getCode()
  if (typeof code === 'string') {
    store.multiState.files[idx].code = code
  }
}

function toggleUpload() {
  uploadOpen.value = !uploadOpen.value
}

// 切换右侧栏目：基础 6 栏复用 store.rightTab；UML 5 栏用组件内 activeUmlKind
function switchTab(tab) {
  if (tab.startsWith('uml-')) {
    activeUmlKind.value = tab.slice('uml-'.length)
  } else {
    activeUmlKind.value = null
    store.switchRightTab(tab)
  }
}

// 运行整个项目：先保存当前文件编辑内容再运行
async function onRunProject() {
  saveActiveFile()
  const files = store.multiState.files
  if (!files.length) return
  await store.runProject()
}

// 经典算法加载：把代码作为新文件加入多文件项目（若已存在同名文件则替换内容）
function onClassicLoad({ name, code }) {
  store.addMultiFile({ name: name || 'Classic.java', code })
  const idx = store.multiState.files.findIndex(f => f.name === (name || 'Classic.java'))
  if (idx >= 0) store.setActiveMultiFile(idx)
}

// 多文件上传：批量追加文件到项目，并激活第一个新文件
function onLoadFiles(files) {
  if (!Array.isArray(files) || !files.length) return
  let firstNewIdx = -1
  files.forEach((f) => {
    if (!f?.name) return
    const existed = store.multiState.files.some(x => x.name === f.name)
    store.addMultiFile({ name: f.name, code: f.code || '' })
    if (!existed && firstNewIdx === -1) {
      firstNewIdx = store.multiState.files.findIndex(x => x.name === f.name)
    }
  })
  if (firstNewIdx >= 0) store.setActiveMultiFile(firstNewIdx)
}

/**
 * 计算「当前显示文件」的三色高亮行。
 * 上一步 / 下一步是全局唯一的（即 step-1 和 step+1），
 * 只有当它们恰好也属于当前文件时才在当前文件里高亮；
 * 若属于其他文件，则当前文件只显示属于它的那些，等切到对应文件时再各自显示。
 */
function computeHighlight() {
  const file = activeFileName.value
  const steps = store.steps
  const step = store.currentStep
  if (!file || !steps.length) return { curr: null, prev: null, next: null }

  const currStep = steps[step]
  const curr = (currStep && currStep.file === file) ? currStep.line : null

  const prevStep = step > 0 ? steps[step - 1] : null
  const prev = (prevStep && prevStep.file === file) ? prevStep.line : null

  const nextStep = step < steps.length - 1 ? steps[step + 1] : null
  const next = (nextStep && nextStep.file === file) ? nextStep.line : null

  return { curr, prev, next }
}

// 对当前显示文件应用高亮（幂等，可重复调用）
async function applyHighlight() {
  await nextTick()
  if (!editorRef.value) return
  const { curr, prev, next } = computeHighlight()
  if (curr || prev || next) {
    editorRef.value.highlightLine(curr, prev, next)
  } else {
    editorRef.value.clearHighlights()
  }
}

/**
 * 将视图同步到指定步骤：
 * 若该步骤属于其他文件则自动切换（切换时由 watch 负责保存旧文件）；随后应用高亮。
 */
async function syncToStep(step) {
  const steps = store.steps
  if (!steps.length) return
  const s = Math.max(0, Math.min(step, steps.length - 1))
  const targetFile = steps[s]?.file
  if (targetFile && targetFile !== activeFileName.value) {
    const idx = store.multiState.files.findIndex(f => f.name === targetFile)
    if (idx >= 0) {
      store.setActiveMultiFile(idx)
      await nextTick()
    }
  }
  await applyHighlight()
}

// 切换文件或内容变化 → 先保存旧文件，再载入新文件代码，并恢复高亮
// 注意：必须同时监听 activeFileIndex 和 activeCode，
// 因为首次上传时 activeFileIndex 保持 0 不变，只有 activeCode 从 null 变为内容，
// 若只监听 activeFileIndex 会导致编辑器不加载文件内容。
watch(
  () => [store.multiState.activeFileIndex, activeCode.value],
  async ([newIdx, newCode], [oldIdx, oldCode]) => {
    // 切换文件时先保存旧文件内容（此时编辑器仍是旧文件内容）
    if (oldIdx !== undefined && oldIdx !== newIdx && oldIdx >= 0 && oldIdx < store.multiState.files.length) {
      const code = editorRef.value?.getCode()
      if (typeof code === 'string') {
        store.multiState.files[oldIdx].code = code
      }
    }
    if (newCode === null) return
    if (newCode !== oldCode) {
      await nextTick()
      editorRef.value?.setCode(newCode)
    }
    await applyHighlight()
  },
)

// 运行后 steps 整体替换 → 同步到当前步骤所在文件并高亮
watch(() => store.steps, async (steps) => {
  if (steps && steps.length) await syncToStep(store.currentStep)
})

// 步进切换 → 自动跳文件 + 高亮
watch(() => store.currentStep, async (step) => {
  await syncToStep(step)
})

onMounted(async () => {
  await nextTick()
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    containerWidth.value = rect.width
    splitRatio.value = 0.55
  }
  if (activeCode.value !== null) {
    await nextTick()
    editorRef.value?.setCode(activeCode.value)
  }
  // 恢复高亮（例如从单文件切回来时 steps 仍在）
  await applyHighlight()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

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
  if (rect) containerWidth.value = rect.width
}
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

/* 高亮图例 — 与单文件一致 */
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

.editor-wrap {
  min-height: 0;
}

.editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
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

@keyframes wire-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.18; }
}

.right-card-body {
  padding: 12px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.right-pane {
  min-width: 0;
  height: 100%;
}

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

.splitter {
  width: 12px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  user-select: none;
  flex-shrink: 0;
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
</style>
