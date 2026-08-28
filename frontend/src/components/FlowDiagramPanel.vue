<template>
  <div class="fd-panel">
    <div class="fd-toolbar">
      <button class="fd-btn" :disabled="store.multiState.isAnalyzingProject || !files.length" @click="store.analyzeProject()">
        {{ store.multiState.isAnalyzingProject ? '分析中…' : '重新分析' }}
      </button>
      <span v-if="store.multiState.projectAnalysisError" class="fd-error">{{ store.multiState.projectAnalysisError }}</span>
    </div>

    <div class="fd-body">
      <div v-if="!analysis" class="fd-state">请点击「重新分析」生成调用关系图</div>
      <div v-else-if="!callGraphClasses.length" class="fd-state">未找到可解析的类</div>
      <div v-else>
        <div v-if="renderError" class="fd-state fd-error-text">{{ renderError }}</div>
        <div ref="mermaidRef" class="fd-mermaid" v-html="svgContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import mermaid from 'mermaid'

const store = usePlayerStore()
const files = computed(() => store.multiState.files)
const analysis = computed(() => store.multiState.projectAnalysis)

const mermaidRef = ref(null)
const svgContent = ref('')
const renderError = ref('')

let renderId = 0

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
  } catch (e) {
    if (seq === renderId) {
      svgContent.value = ''
      renderError.value = e?.message || '渲染失败'
    }
  }
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
.fd-body { flex: 1; min-height: 0; overflow: auto; }
.fd-state { font-family: var(--mono); font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center; }
.fd-error-text { color: var(--danger, #ef476f); }
.fd-mermaid { min-height: 200px; }
</style>
