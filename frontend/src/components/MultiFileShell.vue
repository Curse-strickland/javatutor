<template>
  <div ref="containerRef" class="main-area">
    <!-- 左侧：多文件编辑器卡片 -->
    <div :style="{ width: leftWidth + 'px' }" class="editor-card flex-none flex flex-col">
      <div class="editor-card-header">
        <span class="rc-dot" />
        <span class="panel-kicker">PROJECT</span>
        <span class="text-sm font-semibold" style="color: var(--text-h)">多文件项目</span>
        <span class="multi-readonly-hint">只读预览</span>
      </div>

      <FileTabsBar />

      <div class="flex-1 min-h-0 editor-wrap">
        <Editor
          v-if="activeCode !== null"
          ref="editorRef"
          class="h-full"
          :read-only="true"
        />
        <div v-else class="editor-empty">
          <p>点击「+ 上传」添加 .java 文件</p>
        </div>
      </div>

      <ProjectRunBar />
    </div>

    <!-- 可拖拽分割条 -->
    <div class="splitter" @mousedown.prevent="startDrag" aria-hidden="true">
      <div class="splitter-handle" />
    </div>

    <!-- 右侧：UML 标签页卡片 -->
    <div :style="{ width: rightWidth + 'px', minWidth: MIN_RIGHT + 'px' }" class="right-card card flex flex-col">
      <div class="right-card-header">
        <span class="rc-dot" />
        <span class="panel-kicker">UML</span>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'flow' }" @click="store.switchMultiRightTab('flow')">流程</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'dataflow' }" @click="store.switchMultiRightTab('dataflow')">数据流</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'structure' }" @click="store.switchMultiRightTab('structure')">结构</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'class' }" @click="store.switchMultiRightTab('class')">类图</button>
        <button class="right-tab" :class="{ active: store.multiRightTab === 'usecase' }" @click="store.switchMultiRightTab('usecase')">用例</button>
      </div>
      <div class="flex-1 right-card-body">
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
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore } from '../stores/player'
import Editor from './Editor.vue'
import FileTabsBar from './FileTabsBar.vue'
import ProjectRunBar from './ProjectRunBar.vue'
import UmlPanel from './UmlPanel.vue'

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

watch(
  () => [store.multiState.activeFileIndex, activeCode.value],
  async () => {
    if (activeCode.value === null) return
    await nextTick()
    editorRef.value?.setCode(activeCode.value)
  },
)

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

.multi-readonly-hint {
  margin-left: auto;
  padding: 2px 8px;
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border: 1px dashed var(--border);
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
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
