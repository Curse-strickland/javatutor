<template>
  <div class="ll-canvas" ref="canvasRef">
    <div v-if="nodes.length === 0" class="ll-empty">链表为空</div>
    <div v-else class="ll-inner" ref="innerRef">
      <svg
        class="ll-svg-overlay"
        ref="svgRef"
        :style="{ width: contentW + 'px', height: contentH + 'px' }"
      >
        <line
          v-for="a in arrows"
          :key="a.key"
          :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2"
          stroke="var(--primary)"
          stroke-width="2"
          :style="a.style"
        />
      </svg>

      <!-- Variable pointer labels above nodes -->
      <TransitionGroup name="pointer" tag="div">
        <div
          v-for="entry in pointerEntries"
          :key="entry.varName"
          class="ll-pointer-label"
          :style="{ left: entry.x + 'px' }"
        >
          <div class="ll-pointer-inner">
            <span class="ll-pointer-text">{{ entry.varName }}</span>
            <svg class="ll-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <polygon points="0,0 5,6 10,0" fill="var(--primary)" opacity="0.7" />
            </svg>
          </div>
        </div>
      </TransitionGroup>

      <div
        class="ll-nodes-row"
        ref="nodesRowRef"
        :style="{ paddingTop: (hasPointerLabels ? pointerPadTop : 0) + 'px' }"
      >
        <TransitionGroup name="node" tag="div" class="ll-nodes-inner">
          <div
            v-for="node in nodes"
            :key="node.id"
            class="ll-node"
            :data-node-id="node.id"
            :class="{
              highlighted: highlightedNodeIdsSet.has(node.id),
              compare: compareNodeIdsSet.has(node.id),
              cycle: node._cycle,
            }"
          >
            <div class="ll-cell ll-cell-val">
              <span class="ll-val-text">{{ formatValue(node.val) }}</span>
            </div>
            <div class="ll-cell-sep"></div>
            <div class="ll-cell ll-cell-next">
              <div class="ll-dot" :data-dot-id="node.id"></div>
              <span v-if="!node.next" class="ll-null-mark">⏚</span>
              <span v-if="node._cycle && node.next" class="ll-cycle-mark">⟳</span>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
  highlightedNodeIds: { type: Array, default: () => [] },
  compareNodeIds: { type: Array, default: () => [] },
  pointerLabels: { type: Object, default: () => ({}) },
})

const canvasRef = ref(null)
const innerRef = ref(null)
const nodesRowRef = ref(null)
const svgRef = ref(null)
const contentW = ref(0)
const contentH = ref(0)
const nodeMetrics = ref({})
const pointerPadTop = ref(28)

const highlightedNodeIdsSet = computed(() => new Set(props.highlightedNodeIds || []))
const compareNodeIdsSet = computed(() => new Set(props.compareNodeIds || []))
const hasPointerLabels = computed(() => props.pointerLabels && Object.keys(props.pointerLabels).length > 0)

// ── Transition state ──
const arrowEntering = reactive({})
const arrowLeaving = reactive({})

const pointerEntries = computed(() => {
  const entries = []
  const labels = props.pointerLabels || {}
  const metrics = nodeMetrics.value
  for (const [nodeId, varNames] of Object.entries(labels)) {
    if (!varNames || varNames.length === 0) continue
    const m = metrics[nodeId]
    if (!m) continue
    const baseX = m.left + m.w / 2
    const count = varNames.length
    varNames.forEach((name, i) => {
      const offset = count > 1 ? (i - (count - 1) / 2) * 32 : 0
      entries.push({ varName: name, x: Math.round(baseX + offset) })
    })
  }
  return entries
})

// ── Arrows: straight line from dot center to left edge of next node ──
const arrows = computed(() => {
  const result = []
  const nds = props.nodes
  const metrics = nodeMetrics.value
  if (!nds || nds.length < 2) return result

  const nodeMap = {}
  nds.forEach(n => { if (n.id) nodeMap[n.id] = n })

  for (const cur of nds) {
    if (!cur.next) continue
    const nxt = nodeMap[cur.next]
    if (!nxt) continue

    const cm = metrics[cur.id]
    const nm = metrics[nxt.id]
    if (!cm || !nm) continue

    const key = `${cur.id}->${cur.next}`
    const entering = !!arrowEntering[key]
    const leaving = !!arrowLeaving[key]

    const x1 = Math.round(cm.dotCx)
    const y1 = Math.round(cm.dotCy)
    const x2 = Math.round(nm.left)
    const y2 = Math.round(nm.top + nm.h / 2)

    // Simple length approx for draw-in animation
    const len = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2))
    const dur = entering ? 400 : 200

    result.push({
      key,
      x1, y1, x2, y2,
      style: {
        strokeDasharray: len,
        strokeDashoffset: entering ? len : 0,
        transition: `stroke-dashoffset ${dur}ms cubic-bezier(.22,.9,.27,1), opacity 250ms ease`,
        opacity: leaving ? 0 : 0.85,
      },
    })
  }

  return result
})

// ── Transition triggers ──
watch(() => props.nodes, (newNodes, oldNodes) => {
  if (!newNodes) return
  const curMap = {}
  for (const n of newNodes) { if (n.id) curMap[n.id] = n.next || null }
  const oldMap = {}
  if (oldNodes) {
    for (const n of oldNodes) { if (n.id) oldMap[n.id] = n.next || null }
  }

  for (const nodeId of Object.keys(curMap)) {
    const curTarget = curMap[nodeId]
    const oldTarget = oldMap[nodeId] !== undefined ? oldMap[nodeId] : curTarget

    if (curTarget !== oldTarget) {
      if (oldTarget) {
        const oldKey = `${nodeId}->${oldTarget}`
        arrowLeaving[oldKey] = true
        arrowEntering[oldKey] = false
        setTimeout(() => { delete arrowLeaving[oldKey] }, 350)
      }
      if (curTarget) {
        const newKey = `${nodeId}->${curTarget}`
        arrowEntering[newKey] = true
        arrowLeaving[newKey] = false
        setTimeout(() => { delete arrowEntering[newKey] }, 550)
      }
    } else if (curTarget) {
      const key = `${nodeId}->${curTarget}`
      if (arrowEntering[key]) delete arrowEntering[key]
    }
  }
}, { deep: true })

// ── Measurement ──
function measureAll() {
  if (!innerRef.value || !canvasRef.value) return
  const innerRect = innerRef.value.getBoundingClientRect()
  contentW.value = innerRef.value.scrollWidth
  contentH.value = innerRef.value.scrollHeight

  const nodeEls = innerRef.value.querySelectorAll('.ll-node')
  const metrics = {}
  nodeEls.forEach((el) => {
    const nodeId = el.dataset.nodeId
    if (!nodeId) return
    const rect = el.getBoundingClientRect()
    metrics[nodeId] = {
      left: rect.left - innerRect.left,
      top: rect.top - innerRect.top,
      w: rect.width,
      h: rect.height,
    }
    const dotEl = el.querySelector('.ll-dot')
    if (dotEl) {
      const dotRect = dotEl.getBoundingClientRect()
      metrics[nodeId].dotCx = dotRect.left + dotRect.width / 2 - innerRect.left
      metrics[nodeId].dotCy = dotRect.top + dotRect.height / 2 - innerRect.top
    } else {
      metrics[nodeId].dotCx = metrics[nodeId].left + metrics[nodeId].w - 22
      metrics[nodeId].dotCy = metrics[nodeId].top + metrics[nodeId].h / 2
    }
  })
  nodeMetrics.value = metrics
}

let resizeObs = null
onMounted(() => {
  nextTick(measureAll)
  if (canvasRef.value) {
    resizeObs = new ResizeObserver(() => nextTick(measureAll))
    resizeObs.observe(canvasRef.value)
  }
})
onBeforeUnmount(() => { if (resizeObs) resizeObs.disconnect() })

watch(() => props.nodes, () => nextTick(measureAll), { deep: true })
watch(() => props.pointerLabels, () => nextTick(measureAll), { deep: true })

function formatValue(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.ll-canvas {
  width: 100%;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-height: 88px;
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
}
.ll-inner {
  position: relative;
  display: inline-block;
  min-width: 100%;
  padding: 8px 14px 14px;
}
.ll-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

.ll-svg-overlay {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

/* ── Pointer labels ── */
.ll-pointer-label {
  position: absolute;
  top: 4px;
  z-index: 3;
  pointer-events: none;
  transition: left 420ms cubic-bezier(.22,.9,.27,1);
}
.ll-pointer-inner {
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ll-pointer-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  background: var(--accent-bg);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
}
.ll-pointer-triangle { flex-shrink: 0; margin-top: -1px; }

/* ── Nodes row ── */
.ll-nodes-row { overflow: visible; }
.ll-nodes-inner {
  display: flex;
  flex-wrap: nowrap;
  gap: 44px;
  align-items: center;
}

.ll-node {
  display: flex;
  flex-shrink: 0;
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition:
    background 520ms cubic-bezier(.22,.9,.27,1),
    transform 320ms cubic-bezier(.22,.9,.27,1),
    box-shadow 320ms ease,
    border-color 320ms ease;
  overflow: hidden;
}
.ll-node.highlighted {
  border-color: var(--accent-border);
  box-shadow: 0 4px 14px rgba(37,99,235,0.15);
}
.ll-node.compare {
  border-color: rgba(255,199,44,0.25);
  box-shadow: 0 3px 10px rgba(255,199,44,0.08);
}
.ll-node.cycle {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
}

.ll-cell-val {
  width: 56px; height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
}
.ll-val-text { font-size: 17px; font-weight: 700; color: var(--text-h); }
.ll-cell-sep {
  width: 2px;
  align-self: stretch;
  background: var(--border);
  flex-shrink: 0;
}
.ll-cell-next {
  width: 44px; height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--primary) 4%, var(--card-bg));
  position: relative;
}
.ll-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--primary);
  border: 2px solid color-mix(in srgb, var(--primary) 70%, white);
  flex-shrink: 0;
}
.ll-null-mark {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 700;
  position: absolute;
  bottom: 2px;
}
.ll-cycle-mark {
  font-size: 14px;
  color: var(--primary);
  position: absolute;
  bottom: 0;
}

/* ── Node enter/leave ── */
.node-enter-active { transition: all 420ms cubic-bezier(.22,.9,.27,1); }
.node-leave-active  { transition: all 300ms ease; position: absolute; }
.node-enter-from { opacity: 0; transform: scale(0.7) translateY(8px); }
.node-leave-to   { opacity: 0; transform: scale(0.7) translateY(-8px); }

/* ── Pointer enter/leave ── */
.pointer-enter-active { transition: opacity 350ms cubic-bezier(.22,.9,.27,1), transform 350ms cubic-bezier(.22,.9,.27,1); }
.pointer-leave-active { transition: opacity 200ms ease, transform 200ms ease; position: absolute; }
.pointer-enter-from { opacity: 0; transform: translateY(4px); }
.pointer-leave-to   { opacity: 0; transform: translateY(-4px); }
.pointer-move { transition: left 420ms cubic-bezier(.22,.9,.27,1); }

@media (max-width: 640px) {
  .ll-cell-val { width: 48px; height: 44px; }
  .ll-cell-next { width: 36px; height: 44px; }
  .ll-val-text { font-size: 15px; }
  .ll-node { border-radius: 8px; }
  .ll-nodes-inner { gap: 32px; }
}
</style>
