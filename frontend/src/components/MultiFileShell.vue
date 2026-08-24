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
      </div>

      <FileTabsBar />

      <div class="flex-1 min-h-0 editor-wrap">
        <Editor
          v-if="activeCode !== null"
          ref="editorRef"
          class="h-full"
          :read-only="false"
        />
        <div v-else class="editor-empty">
          <p>点击「+ 上传」添加 .java 文件</p>
        </div>
      </div>
    </div>

    <!-- 可拖拽分割条 -->
    <div class="splitter" @mousedown.prevent="startDrag" aria-hidden="true">
      <div class="splitter-handle" />
    </div>

    <!-- 右侧：UML 标签页卡片 -->
    <div :style="{ width: rightWidth + 'px', minWidth: MIN_RIGHT + 'px' }" class="right-card card flex flex-col">
      <div class="right-card-header">
        <span class="rc-dot" />
        <span class="panel-kicker">INSPECT</span>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'variables' }" @click="store.switchMultiRightTab('variables')">变量</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'controlflow' }" @click="store.switchMultiRightTab('controlflow')">流程</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'flow' }" @click="store.switchMultiRightTab('flow')">流程图</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'dataflow' }" @click="store.switchMultiRightTab('dataflow')">数据流</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'structure' }" @click="store.switchMultiRightTab('structure')">结构</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'class' }" @click="store.switchMultiRightTab('class')">类图</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'usecase' }" @click="store.switchMultiRightTab('usecase')">用例</button>
      </div>
      <div class="flex-1 right-card-body">
        <div v-show="store.multiRightTab === 'variables'" class="right-pane">
          <MemoryPanel />
          <ConsoleOutput />
        </div>
        <div v-show="store.multiRightTab === 'controlflow'" class="right-pane">
          <ControlFlowPanel v-if="store.multiRightTab === 'controlflow'" :active="true" />
        </div>
        <div v-show="store.multiRightTab === 'flow'" class="right-pane">
          <UmlPanel kind="flow" :files="store.multiState.files" />
        </div>
        <div v-show="store.multiRightTab === 'dataflow'" class="right-pane">
          <UmlPanel kind="dataflow" :files="store.multiState.files" />
        </div>
        <div v-show="store.multiRightTab === 'structure'" class="right-pane">
          <UmlPanel kind="structure" :files="store.multiState.files" />
        </div>
        <div v-show="store.multiRightTab === 'class'" class="right-pane">
          <UmlPanel kind="class" :files="store.multiState.files" />
        </div>
        <div v-show="store.multiRightTab === 'usecase'" class="right-pane">
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
import UmlPanel from './UmlPanel.vue'
import MemoryPanel from './MemoryPanel.vue'
import ConsoleOutput from './ConsoleOutput.vue'
import ControlFlowPanel from './ControlFlowPanel.vue'
import ControlBar from './ControlBar.vue'

const store = usePlayerStore()
const editorRef = ref(null)
const containerRef = ref(null)
const containerWidth = ref(0)
const splitRatio = ref(0.55)
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

// 运行整个项目：先保存当前文件编辑内容再运行
async function onRunProject() {
  saveActiveFile()
  const files = store.multiState.files
  if (!files.length) return
  await store.runProject()
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
