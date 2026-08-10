<template>
  <div class="ll-canvas">
    <div v-if="nodes.length === 0" class="ll-empty">链表为空</div>
    <div
      v-else
      class="ll-inner"
      :class="{ 'll-dragging': dragState.nodeId }"
      ref="innerRef"
      :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
    >
      <svg
        class="ll-svg-overlay"
        :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
      >
        <path
          v-for="a in arrowLines"
          :key="a.key"
          :d="a.d"
          fill="none"
          stroke="var(--primary)"
          stroke-width="2"
          stroke-linecap="round"
          :style="a.style"
        />
        <path
          v-for="a in prevArrowLines"
          :key="a.key"
          :d="a.d"
          fill="none"
          stroke="var(--primary)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-dasharray="4 3"
          opacity="0.5"
          :style="a.style"
        />
      </svg>

      <!-- Variable pointer labels above nodes -->
      <TransitionGroup name="pointer" tag="div" class="ll-pointers">
        <div
          v-for="entry in pointerEntries"
          :key="entry.varName"
          class="ll-pointer-label"
          :style="pointerLabelStyle(entry)"
        >
          <div class="ll-pointer-inner">
            <span class="ll-pointer-text">{{ entry.varName }}</span>
            <svg class="ll-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <polygon points="0,0 5,6 10,0" fill="var(--primary)" opacity="0.7" />
            </svg>
          </div>
        </div>
      </TransitionGroup>

      <TransitionGroup name="node" tag="div" class="ll-nodes-layer">
        <div
          v-for="node in nodes"
          :key="node.id"
          class="ll-node"
          :data-node-id="node.id"
          :class="{
            highlighted: highlightedNodeIdsSet.has(node.id),
            compare: compareNodeIdsSet.has(node.id),
            cycle: node._cycle,
            detached: node._detached,
            dragging: dragState.nodeId === node.id,
            'll-doubly': 'prev' in node,
          }"
          :style="nodeTransformStyle(node.id)"
          @pointerdown="onNodePointerDown($event, node.id)"
          @pointermove="onNodePointerMove"
          @pointerup="onNodePointerUp"
          @pointercancel="onNodePointerUp"
        >
          <div v-if="'prev' in node" class="ll-cell ll-cell-prev">
            <div class="ll-dot ll-dot-prev" :data-dot-id="node.id + '-prev'"></div>
            <span v-if="!node.prev && node.prev !== undefined" class="ll-null-mark">⏚</span>
          </div>
          <div v-if="'prev' in node" class="ll-cell-sep ll-cell-sep-left"></div>
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
</template>

<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { layoutLinkedList, buildLinkedListArrowPaths, buildPrevArrowPaths } from '../utils/linkedListLayout.js'

const LAYOUT_OPTS = {
  nodeW: 102,
  nodeH: 52,
  gapX: 48,
  gapY: 72,
  padding: 24,
  baseY: 64,
  colsPerRow: 3,
  cycleLift: 0,
  arcPad: 36,
}

const TRANSITION_MS = 360

const props = defineProps({
  nodes: { type: Array, required: true },
  highlightedNodeIds: { type: Array, default: () => [] },
  compareNodeIds: { type: Array, default: () => [] },
  pointerLabels: { type: Object, default: () => ({}) },
  layoutEpoch: { type: Number, default: 0 },
})

const innerRef = ref(null)

const dragOffset = reactive({})

const dragState = reactive({
  nodeId: null,
  startX: 0,
  startY: 0,
  origDx: 0,
  origDy: 0,
})

function clearDragOffset() {
  for (const key of Object.keys(dragOffset)) {
    delete dragOffset[key]
  }
}

function onNodePointerDown(e, nodeId) {
  if (e.button !== 0) return
  e.currentTarget.setPointerCapture(e.pointerId)
  dragState.nodeId = nodeId
  dragState.startX = e.clientX
  dragState.startY = e.clientY
  const off = dragOffset[nodeId] || { dx: 0, dy: 0 }
  dragState.origDx = off.dx
  dragState.origDy = off.dy
}

function onNodePointerMove(e) {
  if (!dragState.nodeId) return
  const dx = dragState.origDx + (e.clientX - dragState.startX)
  const dy = dragState.origDy + (e.clientY - dragState.startY)
  dragOffset[dragState.nodeId] = { dx, dy }
  syncArrowsFromDisplay()
}

function onNodePointerUp(e) {
  if (!dragState.nodeId) return
  if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  dragState.nodeId = null
  syncArrowsFromDisplay()
}

const highlightedNodeIdsSet = computed(() => new Set(props.highlightedNodeIds || []))
const compareNodeIdsSet = computed(() => new Set(props.compareNodeIds || []))

const layout = computed(() => layoutLinkedList(props.nodes, LAYOUT_OPTS))

// ── Transition state ──
const arrowEntering = reactive({})
const arrowLeaving = reactive({})

const pointerEntries = computed(() => {
  const entries = []
  const labels = props.pointerLabels || {}
  const { positions } = layout.value
  const { nodeW } = LAYOUT_OPTS
  const labelOffsetY = 28

  for (const [nodeId, varNames] of Object.entries(labels)) {
    if (!varNames || varNames.length === 0) continue
    const pos = positions[nodeId]
    if (!pos) continue
    const baseX = pos.x + nodeW / 2
    const baseY = pos.y - labelOffsetY
    const count = varNames.length
    varNames.forEach((name, i) => {
      const offset = count > 1 ? (i - (count - 1) / 2) * 32 : 0
      entries.push({ varName: name, x: baseX + offset, y: baseY })
    })
  }
  return entries
})

function nodeTransformStyle(nodeId) {
  const pos = layout.value.positions[nodeId]
  if (!pos) return {}
  const offset = dragOffset[nodeId] || { dx: 0, dy: 0 }
  return {
    transform: `translate(${pos.x + offset.dx}px, ${pos.y + offset.dy}px)`,
  }
}

function pointerLabelStyle(entry) {
  return {
    transform: `translate(${Math.round(entry.x)}px, ${Math.round(entry.y)}px)`,
  }
}

function displayPositions() {
  const { positions } = layout.value
  const out = {}
  for (const [id, pos] of Object.entries(positions)) {
    const offset = dragOffset[id] || { dx: 0, dy: 0 }
    out[id] = { x: pos.x + offset.dx, y: pos.y + offset.dy }
  }
  return out
}

function positionsFromDOM() {
  if (!innerRef.value) return displayPositions()
  const innerRect = innerRef.value.getBoundingClientRect()
  const out = {}
  innerRef.value.querySelectorAll('.ll-node').forEach((el) => {
    const nodeId = el.dataset.nodeId
    if (!nodeId) return
    const rect = el.getBoundingClientRect()
    out[nodeId] = {
      x: rect.left - innerRect.left,
      y: rect.top - innerRect.top,
    }
  })
  return Object.keys(out).length ? out : displayPositions()
}

function decorateArrowPaths(positions) {
  const paths = buildLinkedListArrowPaths(props.nodes, positions, LAYOUT_OPTS)
  return paths.map((p) => {
    const entering = !!arrowEntering[p.key]
    const leaving = !!arrowLeaving[p.key]
    const len = p.length
    const dur = entering ? 400 : 200
    return {
      key: p.key,
      d: p.d,
      style: {
        strokeDasharray: len,
        strokeDashoffset: entering ? len : 0,
        transition: `stroke-dashoffset ${dur}ms cubic-bezier(.22,.9,.27,1), opacity 250ms ease`,
        opacity: leaving ? 0 : 0.85,
      },
    }
  })
}

const arrowLines = ref([])
const prevArrowLines = ref([])

function decoratePrevArrowPaths(positions) {
  const paths = buildPrevArrowPaths(props.nodes, positions, LAYOUT_OPTS)
  return paths.map((p) => {
    const len = p.length
    return {
      key: p.key,
      d: p.d,
      style: {
        strokeDasharray: `${len}`,
        strokeDashoffset: 0,
        transition: `stroke-dashoffset 200ms cubic-bezier(.22,.9,.27,1), opacity 250ms ease`,
        opacity: 0.5,
      },
    }
  })
}

function syncArrowsFromLayout() {
  arrowLines.value = decorateArrowPaths(layout.value.positions)
  prevArrowLines.value = decoratePrevArrowPaths(layout.value.positions)
}

function syncArrowsFromDisplay() {
  const pos = displayPositions()
  arrowLines.value = decorateArrowPaths(pos)
  prevArrowLines.value = decoratePrevArrowPaths(pos)
}

let arrowRafId = null

function followArrowsDuringTransition() {
  if (arrowRafId) cancelAnimationFrame(arrowRafId)
  const start = performance.now()

  function tick(now) {
    const pos = positionsFromDOM()
    arrowLines.value = decorateArrowPaths(pos)
    prevArrowLines.value = decoratePrevArrowPaths(pos)
    if (now - start < TRANSITION_MS + 40) {
      arrowRafId = requestAnimationFrame(tick)
    } else {
      arrowRafId = null
      syncArrowsFromDisplay()
    }
  }

  arrowRafId = requestAnimationFrame(tick)
}

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

  nextTick(() => {
    followArrowsDuringTransition()
  })
}, { deep: true })

watch(layout, () => {
  if (!arrowRafId) syncArrowsFromLayout()
}, { deep: true })

watch(() => props.layoutEpoch, () => {
  clearDragOffset()
  dragState.nodeId = null
})

onMounted(() => {
  nextTick(syncArrowsFromLayout)
})

onBeforeUnmount(() => {
  if (arrowRafId) cancelAnimationFrame(arrowRafId)
})

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
  min-height: 140px;
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
}
.ll-inner {
  position: relative;
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

.ll-pointers,
.ll-nodes-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* ── Pointer labels ── */
.ll-pointer-label {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  pointer-events: none;
  transition: transform 360ms cubic-bezier(.22,.9,.27,1);
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

.ll-inner.ll-dragging {
  cursor: grabbing;
}
.ll-node {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-shrink: 0;
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition:
    transform 360ms cubic-bezier(.22,.9,.27,1),
    background 520ms cubic-bezier(.22,.9,.27,1),
    box-shadow 320ms ease,
    border-color 320ms ease;
  overflow: hidden;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
}
.ll-node.dragging {
  cursor: grabbing;
  z-index: 10;
  transition:
    background 520ms cubic-bezier(.22,.9,.27,1),
    box-shadow 320ms ease,
    border-color 320ms ease;
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
.ll-node.detached {
  border-style: dashed;
  opacity: 0.95;
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
.ll-cell-prev {
  width: 44px; height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--primary) 4%, var(--card-bg));
  position: relative;
}
.ll-dot-prev {
  background: color-mix(in srgb, var(--primary) 60%, var(--text-muted));
}
.ll-doubly {
  /* Allow slightly wider layout for doubly-linked nodes */
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

/* ── Node enter/leave (opacity only — transform reserved for layout slide) ── */
.node-enter-active { transition: opacity 420ms cubic-bezier(.22,.9,.27,1); }
.node-leave-active  { transition: opacity 300ms ease; position: absolute; }
.node-enter-from { opacity: 0; }
.node-leave-to   { opacity: 0; }

/* ── Pointer enter/leave ── */
.pointer-enter-active { transition: opacity 350ms cubic-bezier(.22,.9,.27,1), transform 350ms cubic-bezier(.22,.9,.27,1); }
.pointer-leave-active { transition: opacity 200ms ease, transform 200ms ease; position: absolute; }
.pointer-enter-from { opacity: 0; transform: translateY(4px); }
.pointer-leave-to   { opacity: 0; transform: translateY(-4px); }
.pointer-move { transition: transform 360ms cubic-bezier(.22,.9,.27,1); }

@media (prefers-reduced-motion: reduce) {
  .ll-node,
  .ll-pointer-label {
    transition: none !important;
  }
  .node-enter-active,
  .node-leave-active,
  .pointer-enter-active,
  .pointer-leave-active,
  .pointer-move {
    transition: none !important;
  }
}

@media (max-width: 640px) {
  .ll-cell-val { width: 48px; height: 44px; }
  .ll-cell-next { width: 36px; height: 44px; }
  .ll-val-text { font-size: 15px; }
  .ll-node { border-radius: 8px; }
}
</style>
