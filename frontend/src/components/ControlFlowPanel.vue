<template>
  <div class="cf-panel">
    <div v-if="!controlFlowData" class="cf-empty">运行代码后自动生成控制流图</div>
    <div v-else>
      <div class="cf-toolbar">
        <div v-if="store.cfViewStack.length > 1" class="cf-breadcrumb">
          <button class="cf-back-btn" @click="goBack">← 返回</button>
          <span class="cf-method-name">{{ currentMethod }}</span>
        </div>
        <div v-else class="cf-method-name">{{ currentMethod }}</div>
        <div class="cf-toolbar-actions">
          <button class="cf-icon-btn" title="放大查看" @click="openFullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <button class="cf-icon-btn" title="下载控制流图" @click="downloadSvg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      </div>
      <div ref="mermaidRef" class="cf-mermaid" v-html="svgContent"></div>
      <div v-if="hasCallNodes" class="cf-hint">点击蓝色节点查看方法详情</div>
    </div>

    <!-- 全屏 Modal -->
    <Teleport to="body">
      <div v-if="showFullscreen" class="cf-fullscreen-overlay" @click.self="closeFullscreen">
        <div class="cf-fullscreen-container">
          <div class="cf-fullscreen-toolbar">
            <span class="cf-method-name">{{ currentMethod }}</span>
            <div class="cf-toolbar-actions">
              <button class="cf-icon-btn" title="缩小" @click="zoomOut">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <span class="cf-zoom-label">{{ Math.round(zoomLevel * 100) }}%</span>
              <button class="cf-icon-btn" title="放大" @click="zoomIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <button class="cf-icon-btn" title="重置缩放" @click="resetZoom">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <div class="cf-toolbar-divider"></div>
              <button class="cf-icon-btn" title="下载控制流图" @click="downloadSvg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="cf-icon-btn" title="关闭" @click="closeFullscreen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="cf-fullscreen-body">
            <div ref="fullscreenSvgRef" class="cf-fullscreen-svg" v-html="svgContent" :style="zoomWrapperStyle"></div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../stores/player'
import mermaid from 'mermaid'

const store = usePlayerStore()
const { controlFlowData } = storeToRefs(store)
const mermaidRef = ref(null)
const fullscreenSvgRef = ref(null)
const svgContent = ref('')
const showFullscreen = ref(false)
const currentLine = ref(null)
const zoomLevel = ref(1)
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3.0
const ZOOM_STEP = 0.15
let renderId = 0
const svgNaturalWidth = ref(0)

const zoomWrapperStyle = computed(() => {
  if (!svgNaturalWidth.value) return {}
  return {
    width: (svgNaturalWidth.value * zoomLevel.value) + 'px',
    transition: 'width 0.15s ease-out',
  }
})

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#0a84ff', primaryTextColor: '#f0f4f4', primaryBorderColor: '#1a5fb4',
    lineColor: '#444', secondaryColor: '#37373f', tertiaryColor: '#37373f', fontSize: '14px',
  },
  flowchart: { htmlLabels: true, curve: 'basis' },
})

const currentMethod = computed(() => store.cfViewStack[store.cfViewStack.length - 1] || '')
const methods = computed(() => controlFlowData.value?.methods || {})
const hasCallNodes = computed(() => {
  const m = methods.value[currentMethod.value]
  return m?.nodes?.some(n => n.target)
})

function toMermaid(methodName) {
  const method = methods.value[methodName]
  if (!method?.nodes?.length) return ''

  const lines = ['flowchart TD']
  const shape = {
    entry: ['([', '])'], exit: ['([', '])'],
    for: ['{', '}'], while: ['{', '}'], if: ['{', '}'],
    block: ['[', ']'], call: ['[', ']'],
  }

  for (const n of method.nodes) {
    const label = (n.label || '').replace(/"/g, "'").slice(0, 60)
    const s = shape[n.type] || ['[', ']']
    lines.push('  ' + n.id + s[0] + '"' + label + '"' + s[1])
  }

  for (const n of method.nodes) {
    if (n.type === 'entry' || n.type === 'exit')
      lines.push('  style ' + n.id + ' fill:#0a334d,stroke:#0a84ff,color:#93c5fd')
    else if (n.type === 'for' || n.type === 'while')
      lines.push('  style ' + n.id + ' fill:#2a1845,stroke:#a78bfa,color:#c4b5fd')
    else if (n.type === 'if')
      lines.push('  style ' + n.id + ' fill:#3d2e0a,stroke:#fbbf24,color:#fde68a')
    else if (n.type === 'call')
      lines.push('  style ' + n.id + ' fill:#0a1a2e,stroke:#0a84ff,color:#93c5fd')
    else if (n.type === 'block')
      lines.push('  style ' + n.id + ' fill:#222,stroke:#444,color:#d4d4d8')
  }
  for (const n of method.nodes) {
    if (n.target) lines.push('  style ' + n.id + ' fill:#0a1a2e,stroke:#0a84ff,color:#93c5fd')
  }

  for (const e of method.edges || []) {
    if (e.label === 'next') lines.push('  ' + e.from + ' -->|next| ' + e.to)
    else lines.push('  ' + e.from + ' --> ' + e.to)
  }

  return lines.join('\n')
}

function findSvgNodes(container) {
  if (!container) return []
  return container.querySelectorAll ? container.querySelectorAll('.node') : []
}

function applyHighlight(container, methodName) {
  if (!container || !controlFlowData.value) return
  const line = currentLine.value
  const method = methods.value[methodName]
  if (!method) return

  // Clear previous highlights
  container.querySelectorAll('.cf-active').forEach(el => el.classList.remove('cf-active'))
  container.querySelectorAll('.cf-edge-active').forEach(el => el.classList.remove('cf-edge-active'))

  if (!line) return

  // Find nodes matching current line
  const matchedNodes = method.nodes.filter(n => n.line === line)
  if (!matchedNodes.length) return

  // Highlight matched SVG nodes
  const nodeEls = container.querySelectorAll('.node')
  nodeEls.forEach(el => {
    const labelEl = el.querySelector('.nodeLabel')
    const label = labelEl?.textContent?.trim() || ''
    const match = matchedNodes.find(n => label.startsWith(n.label?.slice(0, 25)))
    if (match) {
      el.classList.add('cf-active')
    }
  })

  // Highlight only edges pointing to matched nodes
  const matchedIds = matchedNodes.map(n => n.id)
  const incomingEdges = method.edges.filter(e => matchedIds.includes(e.to))
  incomingEdges.forEach(edge => {
    const edgeEl = container.querySelector(`[id*="L-${edge.from}-${edge.to}"]`)
    if (edgeEl) edgeEl.classList.add('cf-edge-active')
  })
}

async function render() {
  const methodName = currentMethod.value
  const text = toMermaid(methodName)
  if (!text) { svgContent.value = ''; return }
  try {
    const id = 'cf-' + methodName.replace(/[^a-zA-Z0-9]/g, '') + '-' + (renderId++)
    const { svg } = await mermaid.render(id, text)
    svgContent.value = svg
    await nextTick()
    // Bind click events for drill-down
    if (mermaidRef.value) {
      const callNodes = (methods.value[methodName]?.nodes || []).filter(n => n.target)
      const svgEl = mermaidRef.value.querySelector('svg')
      if (svgEl) {
        svgEl.querySelectorAll('.node').forEach(el => {
          const label = el.querySelector('.nodeLabel')?.textContent?.trim() || ''
          const cn = callNodes.find(n => label.startsWith(n.label?.slice(0, 25)))
          if (cn) {
            el.style.cursor = 'pointer'
            el.addEventListener('click', () => drillDown(cn.target))
          }
        })
      }
    }
    // Apply line-based highlight after render
    await nextTick()
    if (mermaidRef.value) {
      applyHighlight(mermaidRef.value, methodName)
    }
  } catch (e) { svgContent.value = '' }
}

function drillDown(methodName) {
  if (methods.value[methodName]) store.cfViewStack.push(methodName)
}

function goBack() { if (store.cfViewStack.length > 1) store.cfViewStack.pop() }

function openFullscreen() {
  showFullscreen.value = true
  zoomLevel.value = 1
  // Measure from main panel SVG (already rendered, more reliable)
  if (mermaidRef.value) {
    const svg = mermaidRef.value.querySelector('svg')
    if (svg) {
      svgNaturalWidth.value = svg.getBoundingClientRect().width
    }
  }
  nextTick(() => {
    applyZoom()
    if (fullscreenSvgRef.value) {
      applyHighlight(fullscreenSvgRef.value, currentMethod.value)
    }
  })
}

function closeFullscreen() {
  showFullscreen.value = false
}

function applyZoom() {
  // Wrapper width is driven reactively by zoomWrapperStyle.
  // Scale the SVG inside to visually fill the wrapper.
  if (!fullscreenSvgRef.value || !svgNaturalWidth.value) return
  const svg = fullscreenSvgRef.value.querySelector('svg')
  if (svg) {
    svg.style.transform = `scale(${zoomLevel.value})`
    svg.style.transformOrigin = 'top left'
    svg.style.transition = 'transform 0.15s ease-out'
  }
}

function zoomIn() {
  zoomLevel.value = Math.min(ZOOM_MAX, zoomLevel.value + ZOOM_STEP)
  applyZoom()
}

function zoomOut() {
  zoomLevel.value = Math.max(ZOOM_MIN, zoomLevel.value - ZOOM_STEP)
  applyZoom()
}

function resetZoom() {
  zoomLevel.value = 1
  applyZoom()
}

function onWheel(e) {
  if (!showFullscreen.value) return
  if (e.ctrlKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    zoomLevel.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel.value + delta))
    applyZoom()
  }
}

function downloadSvg() {
  const svgEl = mermaidRef.value?.querySelector('svg')
  if (!svgEl) return
  const clone = svgEl.cloneNode(true)
  clone.querySelectorAll('.cf-active').forEach(el => el.classList.remove('cf-active'))
  clone.querySelectorAll('.cf-edge-active').forEach(el => el.classList.remove('cf-edge-active'))
  const svgStr = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    svgStr
  ], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'controlflow-' + currentMethod.value.replace(/[^a-zA-Z0-9]/g, '_') + '.svg'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function onKeydown(e) {
  if (e.key === 'Escape' && showFullscreen.value) {
    closeFullscreen()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('wheel', onWheel, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('wheel', onWheel)
})

// Track current line from steps
watch(() => store.currentStep, () => {
  currentLine.value = store.currentLine
  if (mermaidRef.value && controlFlowData.value) {
    applyHighlight(mermaidRef.value, currentMethod.value)
  }
  // Also update fullscreen if open
  if (showFullscreen.value && fullscreenSvgRef.value) {
    applyHighlight(fullscreenSvgRef.value, currentMethod.value)
  }
})

watch(controlFlowData, (data) => {
  if (data && !store.cfViewStack.length) {
    store.cfViewStack = [data.default || 'main']
  }
  if (data) render()
}, { immediate: true })

watch(() => store.cfViewStack, () => render(), { deep: true })
</script>

<style scoped>
.cf-panel { position: relative; }

.cf-empty { text-align: center; font-size: 13px; color: var(--text-muted); padding: 24px 0; }

/* Toolbar */
.cf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 8px;
}
.cf-breadcrumb { display: flex; align-items: center; gap: 8px; }
.cf-back-btn {
  background: none; border: 1px solid var(--border); border-radius: 6px;
  padding: 3px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer;
}
.cf-back-btn:hover { color: var(--text); border-color: var(--accent-border); }
.cf-method-name { font-size: 12px; color: var(--primary); font-family: var(--mono); }
.cf-toolbar-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.cf-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: none; border: 1px solid transparent;
  color: var(--text-muted); cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.cf-icon-btn:hover { color: var(--primary); border-color: var(--accent-border); background: var(--accent-bg); }
.cf-zoom-label {
  font-size: 12px; color: var(--text-muted); font-family: var(--mono);
  min-width: 36px; text-align: center; user-select: none;
}
.cf-toolbar-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }

/* Mermaid container */
.cf-mermaid {
  display: flex; justify-content: center; overflow-x: auto;
  position: relative; min-height: 100px;
}
.cf-mermaid :deep(svg) { max-width: 100%; height: auto; }

.cf-hint { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 6px; }

/* Breathing glow — pure filter, no transform (avoids SVG positioning conflicts) */
.cf-mermaid :deep(.cf-active),
.cf-fullscreen-svg :deep(.cf-active) {
  animation: cfBreathe 1.2s ease-in-out infinite;
}

@keyframes cfBreathe {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.4)) brightness(1);
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.9)) brightness(1.3);
  }
}

/* Active edge highlight */
.cf-mermaid :deep(.cf-edge-active path),
.cf-fullscreen-svg :deep(.cf-edge-active path) {
  stroke: #fbbf24 !important;
  stroke-width: 2.5px !important;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.5));
  transition: stroke 0.3s, stroke-width 0.3s;
}

/* Fullscreen modal */
.cf-fullscreen-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  animation: cfFadeIn 0.2s ease-out;
}
@keyframes cfFadeIn { from { opacity: 0; } to { opacity: 1; } }

.cf-fullscreen-container {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  width: 92vw; max-width: 1200px;
  max-height: 90vh;
  display: flex; flex-direction: column;
  animation: cfScaleIn 0.25s cubic-bezier(0.22, 0.9, 0.27, 1);
}
@keyframes cfScaleIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.cf-fullscreen-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.cf-fullscreen-body {
  flex: 1; overflow: auto; padding: 16px;
}

.cf-fullscreen-svg {
  margin: 0 auto;
}
.cf-fullscreen-svg :deep(svg) {
  display: block;
  height: auto;
}
</style>
