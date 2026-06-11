<template>
  <div class="heap-stack-panel card p-3 mb-3">
    <div class="hs-header" @click="isOpen = !isOpen">
      <div class="flex items-center gap-2">
        <span class="hs-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">堆 & 栈</span>
      </div>
      <svg class="hs-chevron" :class="{ rotated: isOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <div v-show="isOpen" class="hs-body">
      <!-- Stack -->
      <div class="stack-area">
        <div class="hs-label">栈 Stack</div>
        <div v-if="stackFrames.length === 0" class="hs-empty">暂无栈帧</div>
        <div v-for="(frame, fi) in stackFrames" :key="'f'+fi" class="stack-frame">
          <div class="frame-title">{{ frame.method }}(..)</div>
          <div class="frame-vars">
            <div
              v-for="item in getFrameItems(frame, fi)" :key="item.name"
              class="stack-item"
              :class="{ 'is-ref': item.isRef }"
              :style="item.isRef ? { '--ref-color': item.refColor } : {}"
              @mouseenter="item.isRef && (hoveredRefId = item.refId)"
              @mouseleave="hoveredRefId = null"
            >
              <span class="si-name">{{ item.name }}</span>
              <span class="si-eq">=</span>
              <template v-if="item.isRef">
                <span class="si-ref-label" :class="{ 'si-ref-transition': item.refTransition }">{{ item.refLabel }}</span>
              </template>
              <span v-else class="si-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Heap -->
      <div class="heap-area">
        <div class="hs-label">堆 Heap</div>
        <div v-if="heapObjects.length === 0" class="hs-empty">暂无对象 / 数组</div>
        <div
          v-for="obj in heapObjects" :key="obj.name"
          class="heap-object"
          :class="{ 'ho-highlight': hoveredRefId === obj.refId }"
          :style="objColorStyle(obj)"
        >
          <div class="ho-header">
            <span class="ho-tag" :style="{ color: obj.color.text, background: obj.color.bg }">{{ obj.label }}</span>
            <span class="ho-type">{{ obj.type }}</span>
          </div>
          <div class="ho-cells">
            <template v-if="obj.slots && obj.slots.length">
              <div v-for="slot in obj.slots" :key="'s'+slot.index" class="ho-cell">
                <span class="hoc-idx">[{{ slot.index }}]</span>
                <span class="hoc-val">{{ slot.value }}</span>
              </div>
            </template>
            <template v-else-if="obj.fields && Object.keys(obj.fields).length">
              <div
                v-for="(fv, fk) in obj.fields" :key="'f'+fk"
                class="ho-cell ho-field"
                :class="{ 'ho-field-ref': fv && fv.ref && idToHeapKey[fv.ref] }"
                @mouseenter="fv && fv.ref && (hoveredRefId = fv.ref)"
                @mouseleave="hoveredRefId = null"
              >
                <span class="hoc-idx">{{ fk }}</span>
                <template v-if="fv && fv.ref && idToHeapKey[fv.ref]">
                  <span class="hoc-ref-label" :style="{ color: refColorByHeapId(fv.ref).text }">
                    {{ labelMap[idToHeapKey[fv.ref]]?.label || '?' }}
                  </span>
                </template>
                <span v-else class="hoc-val">{{ formatVal(fv) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const isOpen = ref(true)
const hoveredRefId = ref(null)

// ===== Color palette =====
const PALETTE = [
  { text: '#4ade80', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', glow: 'rgba(34,197,94,0.25)' },
  { text: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', glow: 'rgba(59,130,246,0.25)' },
  { text: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', glow: 'rgba(168,85,247,0.25)' },
  { text: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', glow: 'rgba(245,158,11,0.25)' },
  { text: '#fb7185', bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.35)',  glow: 'rgba(244,63,94,0.25)' },
  { text: '#22d3ee', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.35)',  glow: 'rgba(6,182,212,0.25)' },
  { text: '#fdba74', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)', glow: 'rgba(251,146,60,0.25)' },
  { text: '#6ee7b7', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)', glow: 'rgba(52,211,153,0.25)' },
]

// ===== Data =====
const heapMap = computed(() => store.currentHeap || {})

const idToHeapKey = computed(() => {
  const map = {}
  for (const key of Object.keys(heapMap.value)) {
    const obj = heapMap.value[key]
    if (obj.id) map[obj.id] = key
  }
  return map
})

const stackFrames = computed(() => {
  const frames = store.activeStackFrames
  if (frames && frames.length) return [...frames].reverse()
  const sf = store.currentStackFrame
  return sf ? [sf] : []
})

// ===== Label + Color assignment =====
const labelMap = computed(() => {
  const map = {}
  const heap = heapMap.value
  const keys = Object.keys(heap).sort()
  let nodeIdx = 0
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const obj = heap[key]
    const f = obj.fields || {}
    const isListNode = f.hasOwnProperty('val') && f.hasOwnProperty('next')
    const label = isListNode ? `[节点${++nodeIdx}]` : `[数组 ${obj.name || key}]`
    map[key] = { label, colorIdx: i % PALETTE.length }
  }
  return map
})

function colorFor(key) {
  const m = labelMap.value[key]
  return PALETTE[m?.colorIdx ?? 0]
}

function refColorByHeapId(hexId) {
  const key = idToHeapKey.value[hexId]
  return key ? colorFor(key) : PALETTE[0]
}

function objColorStyle(obj) {
  const c = obj.color
  return { '--obj-border': c.border, '--obj-glow': c.glow }
}

// ===== Stack frame items =====
function getFrameItems(frame, _fi) {
  const items = []
  const locals = frame.locals || {}
  const idMap = idToHeapKey.value
  const heap = heapMap.value
  for (const name of Object.keys(locals)) {
    if (name === 'args' && Array.isArray(locals[name]) && locals[name].length === 0) continue
    const val = locals[name]
    if (typeof val === 'string' && idMap[val]) {
      const lm = labelMap.value[idMap[val]]
      items.push({ name, isRef: true, refId: val, refLabel: lm?.label || '?', refColor: (colorFor(idMap[val])).text })
    } else if (Array.isArray(val) && heap[name]) {
      const lm = labelMap.value[name]
      items.push({ name, isRef: true, refId: heap[name].id || name, refLabel: lm?.label || '?', refColor: (colorFor(name)).text })
    } else {
      items.push({ name, isRef: false, value: formatVal(val) })
    }
  }
  return items
}

// ===== Heap objects =====
const heapObjects = computed(() => {
  const objs = []
  const heap = heapMap.value
  const keys = Object.keys(heap).sort()
  for (const name of keys) {
    const obj = heap[name]
    const lm = labelMap.value[name]
    objs.push({
      name: obj.name || name,
      refId: obj.id || name,
      type: obj.type || 'unknown',
      slots: obj.slots || [],
      fields: obj.fields || {},
      label: lm?.label || name,
      color: colorFor(name),
    })
  }
  return objs
})

function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// Reset hover on step change
watch(() => store.runId, () => { hoveredRefId.value = null })
</script>

<style scoped>
.heap-stack-panel { background: var(--card-bg); overflow: hidden; }

.hs-header {
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; user-select: none;
}
.hs-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); opacity: 0.8; }
.hs-chevron { color: var(--text-muted); transition: transform 0.25s ease; }
.hs-chevron.rotated { transform: rotate(180deg) }

.hs-body { display: flex; gap: 0; margin-top: 10px; }
.hs-label { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
.hs-empty { font-size: 13px; color: var(--text-muted); padding: 8px; text-align: center; }

/* ===== Stack ===== */
.stack-area { flex: 0 0 42%; min-width: 0; padding-right: 12px; }
.stack-frame {
  background: var(--code-bg); border-radius: 8px;
  padding: 10px 12px; border: 1px solid var(--border);
}
.frame-title {
  font-size: 14px; font-weight: 600; color: var(--primary);
  margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.frame-vars { display: flex; flex-direction: column; gap: 4px; }
.stack-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; padding: 4px 8px; border-radius: 6px;
  position: relative; transition: background 0.2s ease;
}
.si-name { color: var(--text-h); font-weight: 500; min-width: 24px; }
.si-eq   { color: var(--text-muted); font-size: 13px; }
.si-value { color: var(--text); font-size: 13px; }
.stack-item.is-ref {
  background: rgba(255,255,255,0.03); cursor: pointer;
}
.stack-item.is-ref:hover {
  background: rgba(255,255,255,0.06);
}
.si-ref-label {
  font-size: 13px; font-weight: 600; color: var(--ref-color, var(--primary));
  transition: color 0.2s ease;
}

/* ===== Heap ===== */
.heap-area { flex: 1; min-width: 0; }
.heap-object {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--obj-border, var(--border));
  border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;
  transition: border-color 0.25s cubic-bezier(.22,.9,.27,1),
              box-shadow 0.25s cubic-bezier(.22,.9,.27,1),
              transform 0.25s cubic-bezier(.22,.9,.27,1);
}
.ho-highlight {
  border-color: var(--obj-border, var(--primary)) !important;
  box-shadow: 0 0 14px var(--obj-glow, rgba(10,132,255,0.2));
  transform: scale(1.02);
}
.ho-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.ho-tag {
  font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 5px;
}
.ho-type { font-size: 12px; color: var(--text-muted); }
.ho-cells { display: flex; flex-wrap: wrap; gap: 5px; }
.ho-cell {
  display: flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--border);
  border-radius: 5px; padding: 4px 8px; font-size: 13px;
}
.hoc-idx { color: var(--text-muted); font-size: 12px; }
.hoc-val { color: var(--text-h); font-weight: 500; }
.ho-field-ref { cursor: pointer; }
.ho-field-ref:hover { background: rgba(255,255,255,0.07); }
.hoc-ref-label {
  font-size: 13px; font-weight: 600;
  transition: color 0.2s ease;
}

@media (max-width: 640px) {
  .hs-body { flex-direction: column; }
  .stack-area { flex: none; padding-right: 0; margin-bottom: 10px; }
}
</style>
