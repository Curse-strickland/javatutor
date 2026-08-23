<template>
  <div class="graph-canvas">
    <div v-if="!graph.nodes.length" class="gc-empty">图为空</div>
    <div
      v-else
      class="gc-inner"
      :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
    >
      <svg
        class="gc-svg"
        :width="layout.width"
        :height="layout.height"
      >
        <defs>
          <marker
            id="gc-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
          </marker>
        </defs>
        <line
          v-for="edge in edgeLines"
          :key="edge.key"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          stroke="var(--primary)"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.85"
          :marker-end="edge.directed ? 'url(#gc-arrow)' : undefined"
        />
        <text
          v-for="label in weightLabels"
          :key="label.key"
          :x="label.x"
          :y="label.y"
          class="gc-weight"
          text-anchor="middle"
          dominant-baseline="middle"
        >{{ label.text }}</text>
      </svg>
      <GraphNode
        v-for="node in graph.nodes"
        :key="node.id"
        :id="node.id"
        :val="node.val"
        :x="layout.positions[node.id].x - NODE_RADIUS"
        :y="layout.positions[node.id].y - NODE_RADIUS - topLabelOffset(node.id)"
        :flow-label="flowLabelFor(node.id)"
        :index-label="indexLabelFor(node)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import GraphNode from './GraphNode.vue'

const NODE_RADIUS = 22
const PADDING = 40
const FLOW_LABEL_HEIGHT = 18
const INDEX_LABEL_HEIGHT = 14
const COL_GAP = 110
const ROW_GAP = 72

const props = defineProps({
  graph: {
    type: Object,
    required: true,
    default: () => ({
      nodes: [],
      edges: [],
      directed: false,
      source: null,
      sink: null,
      kind: 'undirected',
    }),
  },
})

const isFlowLayout = computed(() =>
  props.graph.kind === 'flow' || !!props.graph.source || !!props.graph.sink,
)

function flowLabelFor(nodeId) {
  if (props.graph.source === nodeId) return '源'
  if (props.graph.sink === nodeId) return '汇'
  return ''
}

function indexLabelFor(node) {
  if (node.index == null) return ''
  return `node[${node.index}]`
}

function topLabelOffset(nodeId) {
  const node = (props.graph.nodes || []).find((n) => n.id === nodeId)
  let offset = 0
  if (node?.index != null) offset += INDEX_LABEL_HEIGHT
  if (flowLabelFor(nodeId)) offset += FLOW_LABEL_HEIGHT
  return offset
}

const layout = computed(() => {
  const nodes = props.graph.nodes || []
  if (isFlowLayout.value) return layoutFlowLR(nodes, props.graph)
  if (nodes.length === 3 && !props.graph.directed && props.graph.kind === 'undirected') {
    return layoutTriangle(nodes)
  }
  return layoutCircle(nodes)
})

const edgeLines = computed(() => {
  const positions = layout.value.positions
  const showDirected = props.graph.directed || props.graph.kind === 'directed' || props.graph.kind === 'flow'

  return (props.graph.edges || []).map((edge) => {
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) return null

    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy) || 1
    const nx = dx / dist
    const ny = dy / dist
    const shrink = NODE_RADIUS + (showDirected ? 4 : 0)

    return {
      key: `${edge.from}-${edge.to}-${edge.weight ?? ''}`,
      x1: from.x + nx * shrink,
      y1: from.y + ny * shrink + topLabelOffset(edge.from) / 2,
      x2: to.x - nx * shrink,
      y2: to.y - ny * shrink - topLabelOffset(edge.to) / 2,
      directed: showDirected || edge.directed === true,
    }
  }).filter(Boolean)
})

const weightLabels = computed(() => {
  const positions = layout.value.positions
  const flow = isFlowLayout.value
  return (props.graph.edges || []).map((edge) => {
    if (edge.weight === undefined || edge.weight === null) return null
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) return null
    const text = flow ? `e=${edge.flow ?? 0}/${edge.weight}` : String(edge.weight)
    return {
      key: `w-${edge.from}-${edge.to}`,
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 8,
      text,
    }
  }).filter(Boolean)
})

function layoutTriangle(nodes) {
  const cx = PADDING + 120
  const cy = PADDING + 80
  const radius = 70
  const tri = [
    { x: cx, y: cy - radius },
    { x: cx - radius * 0.866, y: cy + radius * 0.5 },
    { x: cx + radius * 0.866, y: cy + radius * 0.5 },
  ]
  const positions = {}
  nodes.forEach((node, i) => {
    positions[node.id] = tri[i] || tri[0]
  })
  return boundsFromPositions(positions)
}

function layoutCircle(nodes) {
  const count = nodes.length
  const cx = PADDING + 120
  const cy = PADDING + 80
  const radius = count === 1 ? 0 : Math.max(60, count * 22)
  const positions = {}

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    positions[node.id] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })

  return boundsFromPositions(positions)
}

function layoutFlowLR(nodes, graph) {
  const source = graph.source || nodes[0]?.id
  const sink = graph.sink || nodes[nodes.length - 1]?.id
  const middle = nodes.filter((n) => n.id !== source && n.id !== sink)
  const positions = {}

  const topOffset = INDEX_LABEL_HEIGHT + FLOW_LABEL_HEIGHT
  const baseY = PADDING + topOffset + NODE_RADIUS

  positions[source] = { x: PADDING + NODE_RADIUS, y: baseY + ROW_GAP / 2 }

  const midColCount = Math.max(1, Math.ceil(middle.length / 2))
  middle.forEach((node, i) => {
    const col = Math.floor(i / 2)
    const row = i % 2
    positions[node.id] = {
      x: PADDING + NODE_RADIUS + COL_GAP * (col + 1),
      y: baseY + row * ROW_GAP,
    }
  })

  const rightX = PADDING + NODE_RADIUS + COL_GAP * (midColCount + 1)
  positions[sink] = { x: rightX, y: baseY + ROW_GAP / 2 }

  return boundsFromPositions(positions)
}

function boundsFromPositions(positions) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pos of Object.values(positions)) {
    minX = Math.min(minX, pos.x - NODE_RADIUS)
    maxX = Math.max(maxX, pos.x + NODE_RADIUS)
    minY = Math.min(minY, pos.y - NODE_RADIUS - INDEX_LABEL_HEIGHT - FLOW_LABEL_HEIGHT)
    maxY = Math.max(maxY, pos.y + NODE_RADIUS)
  }

  return {
    positions,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  }
}
</script>

<style scoped>
.graph-canvas {
  width: 100%;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-height: 140px;
  overflow-x: auto;
  overflow-y: visible;
}

.gc-empty {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

.gc-inner {
  position: relative;
  margin: 0 auto;
}

.gc-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}

.gc-weight {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-h);
  paint-order: stroke;
  stroke: var(--code-bg);
  stroke-width: 3px;
}
</style>
