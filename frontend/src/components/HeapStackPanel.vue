<template>
  <div class="heap-stack-panel card p-3 mb-3" ref="panelRef">
    <div class="hs-header" @click="isOpen = !isOpen">
      <div class="flex items-center gap-2">
        <span class="hs-dot" />
        <span class="text-sm font-semibold" style="color: var(--text-h)">堆 & 栈</span>
      </div>
      <svg
        class="hs-chevron"
        :class="{ rotated: isOpen }"
        width="14" height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <div v-show="isOpen" class="hs-body" ref="bodyRef">
      <!-- Stack -->
      <div class="stack-area">
        <div class="hs-label">栈 Stack</div>
        <div v-if="stackFrames.length === 0" class="hs-empty">暂无栈帧</div>
        <div v-for="(frame, fi) in stackFrames" :key="'f'+fi" class="stack-frame">
          <div class="frame-title">{{ frame.method }}(..)</div>
          <div class="frame-vars">
            <div v-for="item in getFrameItems(frame, fi)" :key="item.name" class="stack-item" :class="{ 'is-ref': item.isRef }">
              <span class="si-name">{{ item.name }}</span>
              <span class="si-eq">=</span>
              <template v-if="item.isRef">
                <span class="si-dot" :data-port="'s:' + item.name" :data-target="item.refId" />
              </template>
              <span v-else class="si-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Divider between stack and heap -->
      <div class="hs-divider">
        <svg width="2" height="100%"><line x1="1" y1="0" x2="1" y2="100%" stroke="var(--border)" stroke-dasharray="3 3" /></svg>
      </div>

      <!-- Heap -->
      <div class="heap-area">
        <div class="hs-label">堆 Heap</div>
        <div v-if="heapObjects.length === 0" class="hs-empty">暂无对象 / 数组</div>
        <div v-for="obj in heapObjects" :key="obj.name" class="heap-object" :data-heap-id="obj.id">
          <div class="ho-header">
            <span class="ho-ref">{{ obj.id }}</span>
            <span class="ho-type">{{ obj.type }}</span>
            <span class="ho-name">({{ obj.name }})</span>
          </div>
          <div class="ho-cells">
            <template v-if="obj.slots && obj.slots.length">
              <div v-for="slot in obj.slots" :key="'s'+slot.index" class="ho-cell">
                <span class="hoc-idx">[{{ slot.index }}]</span>
                <span class="hoc-val">{{ slot.value }}</span>
              </div>
            </template>
            <template v-else-if="obj.fields && Object.keys(obj.fields).length">
              <div v-for="(fv, fk) in obj.fields" :key="'f'+fk" class="ho-cell ho-field">
                <span class="hoc-idx">{{ fk }}</span>
                <template v-if="fv && fv.ref && idToHeapKey[fv.ref]">
                  <span class="hoc-dot" :data-port="'f:' + obj.name + '.' + fk" :data-target="fv.ref" />
                </template>
                <span v-else class="hoc-val">{{ formatVal(fv) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- SVG connection overlay -->
      <svg class="conn-overlay" :class="{ hidden: connPaths.length === 0 }" aria-hidden="true">
        <defs>
          <marker id="conn-arrow" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
            <polygon points="0 0, 7 2.5, 0 5" fill="#0a84ff" opacity="0.55" />
          </marker>
        </defs>
        <path v-for="p in connPaths" :key="p.id"
          :d="p.d"
          class="conn-line"
          :class="[p.state]"
          :style="p.style"
          marker-end="url(#conn-arrow)"
        />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()
const isOpen = ref(true)
const panelRef = ref(null)
const bodyRef = ref(null)
const connPaths = ref([])
let resizeObserver = null
// Track previous connection targets for change detection (connId → targetHeapId)
const prevConnTargets = ref(new Map())

// 从后端堆快照读取真实堆对象
const heapMap = computed(() => store.currentHeap || {})

// hexID → heap entry key 反向映射
const idToHeapKey = computed(() => {
  const map = {}
  const heap = heapMap.value
  for (const key of Object.keys(heap)) {
    const obj = heap[key]
    if (obj.id) map[obj.id] = key
  }
  return map
})

// 栈帧反转：后端追加新帧到数组末尾，前端需要最新帧显示在顶部
const stackFrames = computed(() => {
  const frames = store.activeStackFrames
  if (frames && frames.length) return [...frames].reverse()
  const sf = store.currentStackFrame
  return sf ? [sf] : []
})

// 每个栈帧的局部变量
function getFrameItems(frame, frameIndex) {
  const items = []
  const locals = frame.locals || {}
  const idMap = idToHeapKey.value
  for (const name of Object.keys(locals)) {
    if (name === 'args' && Array.isArray(locals[name]) && locals[name].length === 0) continue
    const val = locals[name]
    // 检查值是否为已知堆 ID
    if (typeof val === 'string' && idMap[val]) {
      items.push({ name, isRef: true, refId: val })
    } else {
      items.push({ name, isRef: false, value: formatVal(val) })
    }
  }
  return items
}

// 堆对象
const heapObjects = computed(() => {
  const objs = []
  const heap = heapMap.value
  for (const name of Object.keys(heap)) {
    const obj = heap[name]
    objs.push({
      name: obj.name || name,
      id: obj.id || '0x????',
      type: obj.type || 'unknown',
      slots: obj.slots || [],
      fields: obj.fields || {}
    })
  }
  return objs
})

function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ===== Connection mapping =====

const connections = computed(() => {
  const conns = []
  const heap = heapMap.value
  const idMap = idToHeapKey.value

  // Stack ref → Heap card
  for (const frame of store.activeStackFrames || []) {
    const locals = frame.locals || {}
    for (const [name, val] of Object.entries(locals)) {
      if (typeof val !== 'string' || !idMap[val]) continue
      conns.push({
        id: 's:' + name,
        sourcePort: 's:' + name,
        sourceTarget: val,
        targetHeapId: val,
      })
    }
  }

  // Heap field ref → Heap card
  for (const [key, obj] of Object.entries(heap)) {
    const fields = obj.fields || {}
    for (const [fk, fv] of Object.entries(fields)) {
      if (!fv || !fv.ref || !idMap[fv.ref]) continue
      conns.push({
        id: 'f:' + obj.name + '.' + fk,
        sourcePort: 'f:' + obj.name + '.' + fk,
        sourceTarget: fv.ref,
        targetHeapId: fv.ref,
      })
    }
  }

  return conns
})

// ===== SVG Path computation =====

function getAnchor(selector, side) {
  if (!bodyRef.value) return null
  const el = bodyRef.value.querySelector(selector)
  if (!el) return null
  const bodyRect = bodyRef.value.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return {
    x: side === 'right' ? elRect.right - bodyRect.left : elRect.left - bodyRect.left,
    y: elRect.top + elRect.height / 2 - bodyRect.top,
  }
}

function buildPath(x1, y1, x2, y2) {
  const dx = Math.max(Math.abs(x2 - x1) * 0.42, 30)
  const cx1 = x1 + dx
  const cx2 = x2 - dx
  return `M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`
}

function computePaths() {
  const paths = []
  const currentTargets = new Map() // connId → targetHeapId

  for (const conn of connections.value) {
    currentTargets.set(conn.id, conn.targetHeapId)
    const from = getAnchor(`[data-port="${conn.sourcePort}"]`, 'right')
    const to = getAnchor(`[data-heap-id="${conn.targetHeapId}"]`, 'left')
    if (!from || !to) continue

    const d = buildPath(from.x, from.y, to.x, to.y)
    const prevTarget = prevConnTargets.value.get(conn.id)
    let state = 'active'
    if (!prevTarget) {
      state = 'entering'
    } else if (prevTarget !== conn.targetHeapId) {
      state = 'reconnecting'
    }

    paths.push({
      id: conn.id,
      d,
      state,
      style: state === 'entering'
        ? { animation: `conn-enter 0.45s cubic-bezier(.22,.9,.27,1)` }
        : {},
    })
  }

  prevConnTargets.value = currentTargets
  return paths
}

function updatePaths() {
  connPaths.value = computePaths()
}

// Recompute on step change or data change
watch([() => store.currentStep, isOpen, heapMap, () => store.activeStackFrames], () => {
  nextTick(() => {
    if (isOpen.value) updatePaths()
  })
}, { deep: true })

// Reset connections on new run
watch(() => store.runId, () => {
  prevConnTargets.value = new Map()
  connPaths.value = []
})

// ResizeObserver for dynamic repositioning
onMounted(() => {
  if (bodyRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (isOpen.value) updatePaths()
    })
    resizeObserver.observe(bodyRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<style scoped>
.heap-stack-panel {
  background: var(--card-bg);
  overflow: hidden;
}

.hs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.hs-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.8;
}
.hs-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.hs-chevron.rotated { transform: rotate(180deg) }

.hs-body {
  display: flex;
  gap: 0;
  margin-top: 10px;
  position: relative;
}

/* Labels */
.hs-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
}

/* Stack */
.stack-area { flex: 0 0 45%; min-width: 0 }
.stack-frame {
  background: var(--code-bg);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
}
.frame-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.frame-vars { display: flex; flex-direction: column; gap: 4px }
.stack-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  padding: 3px 6px;
  border-radius: 5px;
  position: relative;
}
.si-name { color: var(--text-h); font-weight: 500; min-width: 24px }
.si-eq   { color: var(--text-muted); font-size: 13px }
.si-value { color: var(--text); font-size: 13px }
.stack-item.is-ref { background: var(--accent-bg) }

/* Port dots */
.si-dot, .hoc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.7;
  flex-shrink: 0;
  margin-left: auto;
  transition: opacity 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  z-index: 11;
}
.si-dot:hover, .hoc-dot:hover {
  opacity: 1;
  box-shadow: 0 0 6px rgba(10,132,255,0.4);
}

/* Divider */
.hs-divider {
  flex: 0 0 20px;
  display: flex;
  justify-content: center;
  padding-top: 24px;
}
.hs-divider svg { width: 2px; height: 100% }

/* Heap */
.heap-area { flex: 1; min-width: 0 }
.heap-object {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
}
.ho-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.ho-ref {
  font-size: 12px;
  color: var(--primary);
  background: var(--accent-bg);
  padding: 1px 6px;
  border-radius: 4px;
}
.ho-type {
  font-size: 13px;
  color: var(--text-muted);
}
.ho-name {
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.7;
}
.ho-cells {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ho-cell {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 3px 7px;
  font-size: 13px;
}
.hoc-idx { color: var(--text-muted); font-size: 12px }
.hoc-val { color: var(--text-h); font-weight: 500 }

.hs-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px;
  text-align: center;
}

/* SVG connection overlay */
.conn-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}
.conn-overlay.hidden {
  opacity: 0;
}

.conn-line {
  fill: none;
  stroke: var(--primary);
  stroke-width: 1.8;
  opacity: 0.55;
  transition: d 0.4s cubic-bezier(.22,.9,.27,1), opacity 0.3s ease;
}
.conn-line:hover {
  opacity: 0.85;
}
.conn-line.entering {
  animation: conn-enter 0.45s cubic-bezier(.22,.9,.27,1);
}
.conn-line.reconnecting {
  animation: conn-reconnect 0.52s cubic-bezier(.22,.9,.27,1);
}

@keyframes conn-enter {
  from {
    stroke-dasharray: 300;
    stroke-dashoffset: 300;
    opacity: 0.2;
  }
  to {
    stroke-dasharray: 300;
    stroke-dashoffset: 0;
    opacity: 0.55;
  }
}
@keyframes conn-reconnect {
  0%   { stroke: #60a5fa; stroke-width: 3; opacity: 0.95; }
  20%  { stroke: #60a5fa; stroke-width: 3; opacity: 0.95; }
  100% { stroke: var(--primary); stroke-width: 1.8; opacity: 0.55; }
}

@media (max-width: 640px) {
  .hs-body { flex-direction: column }
  .stack-area { flex: none }
  .hs-divider { display: none }
}
</style>
