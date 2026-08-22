<template>
  <div class="es-card">
    <div class="es-header">
      <span class="es-dot" />
      <span class="es-title">编辑建议（{{ edits.length }} 处）</span>
    </div>

    <div v-for="(e, i) in edits" :key="i" class="es-edit">
      <div class="es-edit-title">{{ e.title }}</div>
      <pre class="es-diff es-old"><code>{{ e.old_string }}</code></pre>
      <pre class="es-diff es-new"><code>{{ e.new_string }}</code></pre>
      <div v-if="e.explanation" class="es-expl">{{ e.explanation }}</div>
      <div v-if="skipReason(i)" class="es-skip">已跳过：{{ skipReason(i) }}</div>
    </div>

    <div v-if="status === 'pending'" class="es-actions">
      <button class="es-btn es-apply" :disabled="!applyAiEdits" @click="apply">应用全部</button>
      <button class="es-btn" @click="status = 'dismissed'">忽略</button>
      <span v-if="applyError" class="es-error">{{ applyError }}</span>
    </div>
    <div v-else-if="status === 'applied'" class="es-actions">
      <span class="es-done">已应用 {{ result?.applied ?? 0 }} 处修改</span>
      <button class="es-btn" @click="undo">撤销</button>
      <span v-if="undoError" class="es-error">{{ undoError }}</span>
    </div>
    <div v-else class="es-actions">
      <span class="es-dismissed">已忽略</span>
    </div>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'

const props = defineProps({
  edits: { type: Array, required: true },
})

const applyAiEdits = inject('applyAiEdits', null)
const undoAiEdits = inject('undoAiEdits', null)

const status = ref('pending') // 'pending' | 'applied' | 'dismissed'
const result = ref(null)
const applyError = ref('')
const undoError = ref('')

const SKIP_LABELS = {
  'not-found': '在当前代码中找不到该片段',
  ambiguous: '该片段在代码中出现多次，无法定位',
  conflict: '与另一处修改范围重叠',
}

function skipReason(i) {
  const p = result.value?.planned?.[i]
  if (!p || p.status === 'ok') return ''
  return SKIP_LABELS[p.status] || p.status
}

function apply() {
  if (!applyAiEdits) return
  const res = applyAiEdits(props.edits)
  if (!res) {
    applyError.value = '编辑器不可用'
    return
  }
  result.value = res
  if (res.applied > 0) status.value = 'applied'
}

function undo() {
  const ok = undoAiEdits?.(result.value?.undoToken) ?? false
  if (ok) {
    status.value = 'pending'
    result.value = null
    undoError.value = ''
  } else {
    undoError.value = '代码已改动，无法撤销'
  }
}
</script>

<style scoped>
.es-card {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  background: var(--card-bg);
  padding: 8px 10px;
}
.es-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.es-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
}
.es-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-h);
}
.es-edit {
  margin-bottom: 8px;
}
.es-edit-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 4px;
}
.es-diff {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  margin: 2px 0;
  padding: 4px 8px;
  overflow-x: auto;
  white-space: pre;
}
.es-old {
  background: rgba(220, 38, 38, 0.08);
  border-left: 2px solid #dc2626;
}
.es-new {
  background: rgba(22, 163, 74, 0.08);
  border-left: 2px solid #16a34a;
}
.es-expl {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
.es-skip {
  font-size: 11px;
  color: #b45309;
  margin-top: 2px;
}
.es-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.es-btn {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.es-btn:hover { color: var(--text-h); background: var(--accent-bg); }
.es-apply {
  color: var(--accent);
  border-color: var(--accent);
}
.es-done { font-size: 12px; color: #16a34a; }
.es-dismissed { font-size: 12px; color: var(--text-muted); }
.es-error { font-size: 11px; color: #dc2626; }
</style>
