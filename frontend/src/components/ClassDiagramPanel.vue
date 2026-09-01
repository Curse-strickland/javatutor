<template>
  <div class="cd-panel">
    <div class="cd-toolbar">
      <button class="cd-btn" :disabled="store.multiState.isAnalyzingProject || !files.length" @click="store.analyzeProject()">
        {{ store.multiState.isAnalyzingProject ? '分析中…' : '重新分析' }}
      </button>
      <span v-if="store.multiState.projectAnalysisError" class="cd-error">{{ store.multiState.projectAnalysisError }}</span>
    </div>

    <div class="cd-body">
      <div v-if="!analysis" class="cd-state">请点击「重新分析」生成类图</div>
      <div v-else-if="!classes.length" class="cd-state">未找到可解析的类</div>
      <div v-else>
        <div ref="mermaidRef" class="cd-mermaid" v-html="svgContent"></div>
        <div class="cd-detail" v-if="selectedClass">
          <div class="cd-detail-h">{{ selectedClass.label }} — 成员</div>
          <div v-if="selectedClass.fields.length" class="cd-detail-sec">
            <div class="cd-detail-sub">字段</div>
            <div v-for="f in selectedClass.fields" :key="f" class="cd-detail-line">{{ f }}</div>
          </div>
          <div v-if="selectedClass.methods.length" class="cd-detail-sec">
            <div class="cd-detail-sub">方法</div>
            <div v-for="m in selectedClass.methods" :key="m" class="cd-detail-line">{{ m }}</div>
          </div>
        </div>
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
const selectedClass = ref(null)
let renderId = 0

const classes = computed(() => analysis.value?.classDiagram?.classes || [])
const relations = computed(() => analysis.value?.classDiagram?.relations || [])

function shortName(qualified) {
  const idx = String(qualified || '').lastIndexOf('.')
  return idx >= 0 ? String(qualified).slice(idx + 1) : String(qualified || '')
}

function toMermaid() {
  const lines = ['classDiagram']
  for (const c of classes.value) {
    const id = mermaidId(c.id)
    // 类声明 + 成员（字段/方法直接渲染进格子）
    lines.push('  class ' + id + '["' + c.label + '"] {')
    for (const f of c.fields || []) {
      lines.push('    ' + toMermaidMember(f, true))
    }
    for (const m of c.methods || []) {
      lines.push('    ' + toMermaidMember(m, false))
    }
    lines.push('  }')
  }
  for (const r of relations.value) {
    const from = mermaidId(r.from)
    const to = mermaidId(r.to)
    if (r.type === 'extends') lines.push('  ' + to + ' <|-- ' + from)
    else if (r.type === 'implements') lines.push('  ' + to + ' <|.. ' + from)
    else lines.push('  ' + from + ' --> ' + to)
  }
  return lines.join('\n')
}

// 把后端成员串（如 "- name: String"）转成 mermaid 成员声明
// mermaid classDiagram 用 +/-/#/~ 前缀表示可见性
function toMermaidMember(member, isField) {
  let s = String(member || '').trim()
  let vis = ''
  const ch = s.charAt(0)
  if (ch === '+' || ch === '-' || ch === '#' || ch === '~') {
    vis = ch + ' '
    s = s.slice(1).trim()
  }
  if (isField) {
    // "name: String" → "String name"
    const idx = s.indexOf(':')
    if (idx >= 0) {
      const name = s.slice(0, idx).trim()
      const type = s.slice(idx + 1).trim()
      return vis + type + ' ' + name
    }
    return vis + s
  }
  // "run(int): int" → "run(int) int"
  return vis + s.replace(/\)\s*:/, ') ')
}

// mermaid classDiagram 的 id 不能含点号，做安全替换
function mermaidId(id) {
  return 'C' + String(id || '').replace(/[^a-zA-Z0-9_]/g, '_')
}

// mermaid.initialize 是全局单例，其他面板（流程图/调用关系）会设置白色文字，
// 若切到类图时不重置主题，浅色背景 + 白字会导致文字不可见。
// 这里用明确的浅色主题 + 深色文字。
function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    themeVariables: {
      fontSize: '14px',
      // 类图浅色卡片，强制深色文字
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
  if (!classes.value.length) { svgContent.value = ''; return }
  const seq = ++renderId
  try {
    initMermaid() // 每次渲染前重置主题，避免被其他面板污染
    const id = 'cd-' + seq
    const { svg } = await mermaid.render(id, text)
    if (seq !== renderId) return
    svgContent.value = svg
    document.getElementById('d' + id)?.remove()
    await nextTick()
    bindClicks()
  } catch (e) {
    if (seq === renderId) svgContent.value = ''
  }
}

function bindClicks() {
  const svgEl = mermaidRef.value?.querySelector('svg')
  if (!svgEl) return
  svgEl.querySelectorAll('.node').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.id || ''
      // mermaid class node id 形如 classId-Cxxx-0
      const m = id.match(/-C([a-zA-Z0-9_]+)/)
      if (m) {
        const target = classes.value.find(c => mermaidId(c.id) === 'C' + m[1])
        if (target) selectedClass.value = target
      }
    })
  })
}

watch(() => classes.value, () => { render() }, { immediate: true })

defineExpose({})
</script>

<style scoped>
.cd-panel { display: flex; flex-direction: column; height: 100%; gap: 10px; }
.cd-toolbar { display: flex; align-items: center; gap: 10px; }
.cd-btn {
  padding: 5px 12px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--accent); font-family: var(--mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.08em; cursor: pointer;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
}
.cd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cd-error { font-family: var(--mono); font-size: 10.5px; color: var(--danger, #ef476f); }
.cd-body { flex: 1; min-height: 0; overflow: auto; }
.cd-state { font-family: var(--mono); font-size: 12px; color: var(--text-muted); padding: 20px; text-align: center; }
.cd-mermaid { min-height: 200px; }
.cd-detail { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; }
.cd-detail-h { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 6px; }
.cd-detail-sec { margin-bottom: 8px; }
.cd-detail-sub { font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 3px; text-transform: uppercase; }
.cd-detail-line { font-family: var(--mono); font-size: 11px; color: var(--text-h); padding: 1px 0; }
</style>
