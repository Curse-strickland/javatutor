<template>
  <div class="sd-panel">
    <div class="sd-toolbar">
      <button class="sd-btn" :disabled="store.multiState.isAnalyzingProject || !files.length" @click="store.analyzeProject()">
        {{ store.multiState.isAnalyzingProject ? '分析中…' : '重新分析' }}
      </button>
      <span v-if="store.multiState.projectAnalysisError" class="sd-error">{{ store.multiState.projectAnalysisError }}</span>
    </div>

    <div class="sd-body">
      <div v-if="!analysis" class="sd-state">请点击「重新分析」生成结构图</div>
      <div v-else-if="!packages.length" class="sd-state">未找到可解析的类</div>
      <div v-else>
        <div ref="mermaidRef" class="sd-mermaid" v-html="svgContent"></div>
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
let renderId = 0

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

mermaid.initialize({ startOnLoad: false, theme: 'default', themeVariables: { fontSize: '13px' } })

async function render() {
  const text = toMermaid()
  if (!packages.value.length) { svgContent.value = ''; return }
  const seq = ++renderId
  try {
    const id = 'sd-' + seq
    const { svg } = await mermaid.render(id, text)
    if (seq !== renderId) return
    svgContent.value = svg
    document.getElementById('d' + id)?.remove()
  } catch (e) {
    if (seq === renderId) svgContent.value = ''
  }
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
.sd-body { flex: 1; min-height: 0; overflow: auto; }
.sd-state { font-family: var(--mono); font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center; }
.sd-mermaid { min-height: 200px; }
</style>
