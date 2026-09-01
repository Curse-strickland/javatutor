<template>
  <div class="fd-panel">
    <div class="fd-toolbar">
      <button class="fd-btn" :disabled="store.multiState.isAnalyzingProject || !files.length" @click="store.analyzeProject()">
        {{ store.multiState.isAnalyzingProject ? '分析中…' : '重新分析' }}
      </button>
      <span v-if="store.multiState.projectAnalysisError" class="fd-error">{{ store.multiState.projectAnalysisError }}</span>
      <div class="zoom-group">
        <button class="fd-btn zoom-btn" title="缩小" @click="zoomOut">−</button>
        <span class="zoom-label">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="fd-btn zoom-btn" title="放大" @click="zoomIn">+</button>
        <button class="fd-btn zoom-btn" title="重置缩放" @click="resetZoom">重置</button>
      </div>
    </div>

    <div class="fd-body" @wheel="onWheel">
      <div v-if="!analysis" class="fd-state">请点击「重新分析」生成调用关系图</div>
      <div v-else-if="!callGraphClasses.length" class="fd-state">未找到可解析的类</div>
      <div v-else>
        <div v-if="renderError" class="fd-state fd-error-text">{{ renderError }}</div>
        <div ref="mermaidRef" class="fd-mermaid" :style="{ zoom: zoomLevel }" v-html="svgContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import mermaid from 'mermaid'

const store = usePlayerStore()
const files = computed(() => store.multiState.files)
const analysis = computed(() => store.multiState.projectAnalysis)

const mermaidRef = ref(null)
const svgContent = ref('')
const renderError = ref('')
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

const callGraphClasses = computed(() => analysis.value?.callGraph?.classes || [])

function shortName(qualified) {
  const idx = String(qualified || '').lastIndexOf('.')
  return idx >= 0 ? String(qualified).slice(idx + 1) : String(qualified || '')
}

function escapeLabel(s) {
  return String(s || '').replace(/"/g, "'").slice(0, 80)
}

function toMermaid() {
  const lines = ['flowchart TD']

  // 用索引生成无冲突 id：subgraph SG{i}，节点 M{j}
  let methodSeq = 0
  const nodeIds = new Map() // key: className + '#' + methodName → nodeId
  for (const c of callGraphClasses.value) {
    for (const m of c.methods || []) {
      nodeIds.set(c.name + '#' + m.name, 'M' + (methodSeq++))
    }
  }

  let classSeq = 0
  for (const c of callGraphClasses.value) {
    const short = shortName(c.name)
    lines.push('  subgraph SG' + classSeq + '["' + short + '"]')
    for (const m of c.methods || []) {
      const nid = nodeIds.get(c.name + '#' + m.name)
      lines.push('    ' + nid + '["' + escapeLabel(m.name + '()') + '"]')
    }
    lines.push('  end')
    classSeq++
  }

  // 跨方法调用边
  for (const c of callGraphClasses.value) {
    for (const m of c.methods || []) {
      const from = nodeIds.get(c.name + '#' + m.name)
      for (const target of m.calls || []) {
        let toClass = null
        let toMethod = null
        const colon = target.lastIndexOf(':')
        if (colon >= 0) {
          toClass = target.slice(0, colon)
          toMethod = target.slice(colon + 1)
        } else {
          toMethod = target
        }
        let to = null
        if (toClass) {
          to = nodeIds.get(toClass + '#' + toMethod) || null
        }
        if (!to) {
          // 短名兜底：找唯一匹配的方法
          const matches = [...nodeIds.entries()].filter(([k]) => k.endsWith('#' + toMethod))
          if (matches.length === 1) to = matches[0][1]
        }
        if (to && to !== from) {
          lines.push('  ' + from + ' --> ' + to)
        }
      }
    }
  }

  return lines.join('\n')
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: '#0a84ff', primaryTextColor: '#f0f4f4', primaryBorderColor: '#1a5fb4',
    lineColor: '#444', secondaryColor: '#37373f', tertiaryColor: '#37373f', fontSize: '13px',
  },
  flowchart: { htmlLabels: true, curve: 'basis' },
})

async function render() {
  const text = toMermaid()
  if (!callGraphClasses.value.length) { svgContent.value = ''; return }
  const seq = ++renderId
  renderError.value = ''
  try {
    const id = 'fd-' + seq
    const { svg } = await mermaid.render(id, text)
    if (seq !== renderId) return
    svgContent.value = svg
    document.getElementById('d' + id)?.remove()
    await nextTick()
    fixSvgWidth()
  } catch (e) {
    if (seq === renderId) {
      svgContent.value = ''
      renderError.value = e?.message || '渲染失败'
    }
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

watch(() => callGraphClasses.value, () => { render() }, { immediate: true })

onMounted(() => {
  if (!analysis.value && files.value.length) {
    store.analyzeProject()
  }
})
</script>

<style scoped>
.fd-panel { display: flex; flex-direction: column; height: 100%; gap: 10px; }
.fd-toolbar { display: flex; align-items: center; gap: 10px; }
.fd-btn {
  padding: 5px 12px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--accent); font-family: var(--mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
}
.fd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fd-error { font-family: var(--mono); font-size: 10.5px; color: var(--danger, #ef476f); }
.zoom-group { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.zoom-btn { padding: 3px 8px; }
.zoom-label {
  font-family: var(--mono); font-size: 10.5px; color: var(--text-muted);
  min-width: 38px; text-align: center;
}
.fd-body { flex: 1; min-height: 0; overflow: auto; }
.fd-state { font-family: var(--mono); font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center; }
.fd-error-text { color: var(--danger, #ef476f); }
/* 容器宽度由 SVG 内容决定，避免块级撑满导致 zoom 放大时 width:100% 反向收缩 */
.fd-mermaid { min-height: 200px; width: fit-content; }
/* SVG 实际宽度由 render 后的 fixSvgWidth 设为固定像素，这里仅移除内联 max-width 限制 */
.fd-mermaid :deep(svg) { max-width: none !important; }
</style>
