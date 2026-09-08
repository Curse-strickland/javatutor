<template>
  <div class="sd-panel">
    <div class="sd-toolbar">
      <button class="sd-btn" :disabled="store.multiState.isAnalyzingProject || !files.length" @click="store.analyzeProject()">
        {{ store.multiState.isAnalyzingProject ? '分析中…' : '重新分析' }}
      </button>
      <span v-if="store.multiState.projectAnalysisError" class="sd-error">{{ store.multiState.projectAnalysisError }}</span>
      <div class="zoom-group">
        <button class="sd-btn zoom-btn" title="缩小" @click="zoomOut">−</button>
        <span class="zoom-label">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="sd-btn zoom-btn" title="放大" @click="zoomIn">+</button>
        <button class="sd-btn zoom-btn" title="重置缩放" @click="resetZoom">重置</button>
      </div>
    </div>

    <div class="sd-body" @wheel="onWheel">
      <div v-if="!analysis" class="sd-state">请点击「重新分析」生成结构图</div>
      <div v-else-if="!packages.length" class="sd-state">未找到可解析的类</div>
      <div v-else>
        <div ref="mermaidRef" class="sd-mermaid" :style="{ zoom: zoomLevel }" v-html="svgContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'
import mermaid from 'mermaid'

const store = usePlayerStore()
const files = computed(() => store.multiState.files)
const analysis = computed(() => store.multiState.projectAnalysis)

const mermaidRef = ref(null)
const svgContent = ref('')
const zoomLevel = ref(1)
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3.0
const ZOOM_STEP = 0.15
let renderId = 0

function zoomIn() {
  zoomLevel.value = Math.min(ZOOM_MAX, zoomLevel.value + ZOOM_STEP)
}
function zoomOut() {
  zoomLevel.value = Math.max(ZOOM_MIN, zoomLevel.value - ZOOM_STEP)
}
function resetZoom() {
  zoomLevel.value = 1
}
function onWheel(e) {
  if (!e.ctrlKey) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
  zoomLevel.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel.value + delta))
}

const packages = computed(() => analysis.value?.structure?.packages || [])
const dependencies = computed(() => analysis.value?.structure?.dependencies || [])

function shortName(qualified) {
  const idx = String(qualified || '').lastIndexOf('.')
  return idx >= 0 ? String(qualified).slice(idx + 1) : String(qualified || '')
}

function pkgId(p) {
  return 'P' + String(p).replace(/[^a-zA-Z0-9_]/g, '_')
}
function clsId(c) {
  return 'C' + String(c).replace(/[^a-zA-Z0-9_]/g, '_')
}

function toMermaid() {
  const lines = ['flowchart TD']
  // 包节点（subgraph）
  const classPkg = {}
  for (const p of packages.value) {
    for (const c of p.classes) classPkg[c] = p.id
  }
  for (const p of packages.value) {
    const id = pkgId(p.id)
    lines.push('  subgraph ' + id + '["' + p.id + '"]')
    for (const c of p.classes) {
      lines.push('    ' + clsId(c) + '["' + shortName(c) + '"]')
    }
    lines.push('  end')
  }
  for (const d of dependencies.value) {
    lines.push('  ' + clsId(d.from) + ' --> ' + clsId(d.to))
  }
  return lines.join('\n')
}

// mermaid.initialize 是全局单例，其他面板（流程图/调用关系）会设置白色文字，
// 若切到结构图时不重置主题，浅色背景 + 白字会导致文字不可见。
// 这里用明确的浅色主题 + 深色文字。
function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    themeVariables: {
      fontSize: '13px',
      primaryColor: '#ffffff',
      primaryTextColor: '#1f2937',
      primaryBorderColor: '#94a3b8',
      lineColor: '#475569',
      secondaryColor: '#f8fafc',
      tertiaryColor: '#f1f5f9',
    },
  })
}
initMermaid()

async function render() {
  const text = toMermaid()
  if (!packages.value.length) { svgContent.value = ''; return }
  const seq = ++renderId
  try {
    initMermaid() // 每次渲染前重置主题，避免被其他面板污染
    const id = 'sd-' + seq
    const { svg } = await mermaid.render(id, text)
    if (seq !== renderId) return
    svgContent.value = svg
    document.getElementById('d' + id)?.remove()
    await nextTick()
    fixSvgWidth()
  } catch (e) {
    if (seq === renderId) svgContent.value = ''
  }
}

// mermaid svg 默认 width="100%" + viewBox，zoom 放大时 width:100% 会反向收缩。
// 改为固定像素宽度（取 viewBox 宽度），让 zoom 能正确放大。
function fixSvgWidth() {
  const svgEl = mermaidRef.value?.querySelector('svg')
  if (!svgEl) return
  const vb = svgEl.getAttribute('viewBox')
  if (!vb) return
  const vbW = parseFloat(vb.split(/\s+/)[2])
  if (!vbW || isNaN(vbW)) return
  svgEl.style.maxWidth = 'none'
  svgEl.setAttribute('width', String(vbW))
  svgEl.style.width = vbW + 'px'
}

watch(() => packages.value, () => { render() }, { immediate: true })

defineExpose({})
</script>

<style scoped>
.sd-panel { display: flex; flex-direction: column; height: 100%; gap: 10px; }
.sd-toolbar { display: flex; align-items: center; gap: 10px; }
.sd-btn {
  padding: 5px 12px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--accent); font-family: var(--mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
}
.sd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sd-error { font-family: var(--mono); font-size: 10.5px; color: var(--danger, #ef476f); }
.zoom-group { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.zoom-btn { padding: 3px 8px; }
.zoom-label {
  font-family: var(--mono); font-size: 10.5px; color: var(--text-muted);
  min-width: 38px; text-align: center;
}
.sd-body { flex: 1; min-height: 0; overflow: auto; }
.sd-state { font-family: var(--mono); font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center; }
/* 容器宽度由 SVG 内容决定，避免块级撑满导致 zoom 放大时 width:100% 反向收缩 */
.sd-mermaid { min-height: 200px; width: fit-content; }
/* SVG 实际宽度由 render 后的 fixSvgWidth 设为固定像素，这里仅移除内联 max-width 限制 */
.sd-mermaid :deep(svg) { max-width: none !important; }
</style>
