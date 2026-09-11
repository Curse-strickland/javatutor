<template>
  <div class="uml-panel">
    <div class="uml-toolbar">
      <button class="uml-regen-btn" @click="regenerate" :disabled="loading || !files.length">
        {{ loading ? '生成中…' : '重新生成' }}
      </button>
      <span v-if="cached?.ts" class="uml-ts">{{ formatTs(cached.ts) }}</span>
      <span v-if="cached?.source" class="uml-badge" :class="cached.source">
        {{ cached.source === 'ai' ? 'AI' : '静态' }}
      </span>
    </div>

    <div class="uml-body">
      <div v-if="loading" class="uml-state">正在生成 UML…</div>
      <div v-else-if="displaySvg" class="uml-svg-wrap" v-html="displaySvg" />
      <div v-else class="uml-state">
        <p>{{ emptyMessage }}</p>
        <button v-if="files.length" class="uml-regen-btn inline" @click="regenerate">重新生成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { http } from '../utils/http.js'
import { getStaticFallback, sanitizeSvg } from '../utils/umlFallback.js'
import { generateClassDiagramSvg } from '../utils/staticClassDiagram.js'

const props = defineProps({
  kind: {
    type: String,
    required: true,
    validator: (v) => ['flow', 'dataflow', 'structure', 'class', 'usecase'].includes(v),
  },
  files: {
    type: Array,
    default: () => [],
  },
})

const store = usePlayerStore()
const loading = ref(false)

const cached = computed(() => store.multiState.umlCache[props.kind] || null)

const displaySvg = computed(() => {
  const svg = cached.value?.svg
  return svg ? sanitizeSvg(svg) : ''
})

const emptyMessage = computed(() => {
  if (!props.files.length) return '请先上传 .java 文件'
  if (props.kind === 'class') return '正在解析类图…'
  return '点击「重新生成」生成 UML 图'
})

function formatTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function applyCache(svg, source) {
  store.setUmlCache(props.kind, {
    svg: sanitizeSvg(svg),
    ts: Date.now(),
    source,
  })
}

function staticForKind() {
  if (props.kind === 'class') {
    return generateClassDiagramSvg(props.files)
  }
  return getStaticFallback(props.kind)
}

function autoGenerateClass() {
  if (!props.files.length) return
  const svg = generateClassDiagramSvg(props.files)
  applyCache(svg, 'static')
}

async function regenerate() {
  if (!props.files.length) return
  loading.value = true
  try {
    const res = await http('/api/ai/uml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'uml',
        kind: props.kind,
        files: props.files.map(f => ({ name: f.name, code: f.code })),
      }),
    })
    const data = await res.json()
    if (data.svg && !data.error) {
      applyCache(data.svg, data.source === 'ai' ? 'ai' : 'static')
    } else {
      applyCache(staticForKind(), 'static')
    }
  } catch {
    applyCache(staticForKind(), 'static')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.files.map(f => f.name + f.code).join('\n'),
  () => {
    if (props.kind === 'class') autoGenerateClass()
  },
)

onMounted(() => {
  if (props.kind === 'class') {
    autoGenerateClass()
  } else if (!cached.value && props.files.length) {
    // Optional: show static fallback immediately for non-class kinds
    // Spec: others show empty until regenerate OR static fallback immediately
    // Using cached only; empty state until user clicks regenerate
  }
})
</script>

<style scoped>
.uml-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 280px;
}
.uml-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
  flex-shrink: 0;
}
.uml-regen-btn {
  padding: 5px 12px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: background 0.15s, border-color 0.15s;
}
.uml-regen-btn:hover:not(:disabled) {
  background: var(--accent-bg);
  border-color: var(--accent);
}
.uml-regen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.uml-regen-btn.inline {
  margin-top: 10px;
}
.uml-ts {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
}
.uml-badge {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  letter-spacing: 0.1em;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
}
.uml-badge.ai {
  color: var(--accent);
  border: 1px solid var(--accent);
  background: var(--accent-bg);
}
.uml-badge.static {
  color: var(--text-muted);
  border: 1px solid var(--border);
}
.uml-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.uml-svg-wrap {
  width: 100%;
}
.uml-svg-wrap :deep(svg) {
  width: 100%;
  height: auto;
  max-height: 480px;
}
.uml-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
}
</style>
