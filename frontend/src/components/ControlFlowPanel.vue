<template>
  <div class="cf-panel">
    <div v-if="!controlFlowData" class="cf-empty">运行代码后自动生成控制流图</div>
    <div v-else>
      <div v-if="store.cfViewStack.length > 1" class="cf-breadcrumb">
        <button class="cf-back-btn" @click="goBack">← 返回</button>
        <span class="cf-method-name">{{ currentMethod }}</span>
      </div>
      <div ref="mermaidRef" class="cf-mermaid" v-html="svgContent"></div>
      <div v-if="hasCallNodes" class="cf-hint">点击蓝色节点查看方法详情</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '../stores/player'
import mermaid from 'mermaid'

const store = usePlayerStore()
const { controlFlowData } = storeToRefs(store)
const mermaidRef = ref(null)
const svgContent = ref('')
let renderId = 0

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

async function render() {
  const methodName = currentMethod.value
  const text = toMermaid(methodName)
  if (!text) { svgContent.value = ''; callBtns.value = []; return }
  try {
    const id = 'cf-' + methodName.replace(/[^a-zA-Z0-9]/g, '') + '-' + (renderId++)
    const { svg } = await mermaid.render(id, text)
    svgContent.value = svg
    // 为调用节点直接绑定点击事件
    await nextTick()
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
  } catch (e) { svgContent.value = '' }
}

function drillDown(methodName) {
  if (methods.value[methodName]) store.cfViewStack.push(methodName)
}

function goBack() { if (store.cfViewStack.length > 1) store.cfViewStack.pop() }

watch(controlFlowData, (data) => {
  if (data && !store.cfViewStack.length) {
    store.cfViewStack = [data.default || 'main']
  }
  if (data) render()
}, { immediate: true })

watch(() => store.cfViewStack, () => render(), { deep: true })
</script>

<style scoped>
.cf-panel { }
.cf-empty { text-align: center; font-size: 13px; color: var(--text-muted); padding: 24px 0; }
.cf-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.cf-back-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
.cf-back-btn:hover { color: var(--text); border-color: var(--accent-border); }
.cf-method-name { font-size: 12px; color: var(--primary); font-family: var(--mono); }
.cf-mermaid { display: flex; justify-content: center; overflow-x: auto; position: relative; }
.cf-mermaid :deep(svg) { max-width: 100%; height: auto; }
.cf-hint { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 6px; }
</style>
