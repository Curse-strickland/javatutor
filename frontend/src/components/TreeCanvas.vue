<template>
  <div class="tree-canvas">
    <div v-if="!tree.nodes.length && !orphans.length" class="tc-empty">树为空</div>
    <div
      v-else
      class="tc-inner"
      :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
    >
      <svg
        class="tc-svg"
        :width="layout.width"
        :height="layout.height"
      >
        <line
          v-for="edge in edgeLines"
          :key="edge.key"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          :stroke="edge.highlighted ? '#eab308' : 'var(--primary)'"
          :stroke-width="edge.highlighted ? 2.5 : 1.5"
          stroke-linecap="round"
          opacity="0.85"
        />
      </svg>
      <TreeNode
        v-for="node in tree.nodes"
        :key="node.id"
        :id="node.id"
        :val="node.val"
        :x="layout.positions[node.id].x - NODE_RADIUS"
        :y="layout.positions[node.id].y - NODE_RADIUS"
        :role="roleFor(node.id)"
        :is-highlighted="highlightedSet.has(node.id) && !roleFor(node.id)"
        :labels="pointerLabelsFor(node.id)"
      />
      <TreeNode
        v-for="orphan in orphanNodes"
        :key="`orphan-${orphan.id}`"
        :id="orphan.id"
        :val="orphan.val"
        :x="orphan.x"
        :y="orphan.y"
        role="insert"
        :labels="orphan.labels"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TreeNode from './TreeNode.vue'
import { primaryRoleFromLabels } from '../utils/pointerRoleColors.js'

const NODE_RADIUS = 22
const LAYER_GAP = 88
const SIBLING_GAP = 56
const PADDING = 32
const LABEL_HEIGHT = 22
const ORPHAN_GAP = 64

const props = defineProps({
  tree: {
    type: Object,
    required: true,
    default: () => ({
      nodes: [],
      edges: [],
      highlightedPath: [],
      pointerLabels: {},
      orphans: [],
      kind: 'tree',
      rootId: null,
    }),
  },
})

const highlightedSet = computed(() => new Set(props.tree.highlightedPath || []))
const orphans = computed(() => props.tree.orphans || [])

function pointerLabelsFor(nodeId) {
  const labels = [...((props.tree.pointerLabels || {})[nodeId] || [])]
  // Structural fallback: live root always shows red `root` chip on top
  if (
    props.tree.rootId === nodeId
    && !labels.some((l) => String(l).toLowerCase() === 'root')
  ) {
    labels.unshift('root')
  }
  return labels
}

function inferRole(labels) {
  const role = primaryRoleFromLabels(labels)
  if (role) return role
  // Fallback for tree-specific insert orphans already labeled
  const lower = (labels || []).map((l) => String(l).toLowerCase())
  if (lower.some((l) => l === 'insert' || l === 'orphan' || l === 'new')) return 'insert'
  return null
}

function roleFor(nodeId) {
  const labels = pointerLabelsFor(nodeId)
  const role = inferRole(labels)
  if (role) return role
  // Structural fallback when extract forgot the root label
  if (props.tree.rootId === nodeId) return 'root'
  return null
}

const layout = computed(() => layoutTree(props.tree.nodes || [], orphans.value.length))

const orphanNodes = computed(() => {
  const positions = layout.value.positions
  const mainMaxX = Math.max(
    ...Object.values(positions).map((p) => p.x),
    PADDING + NODE_RADIUS,
  )
  const baseX = mainMaxX + ORPHAN_GAP
  // 与主树一致：圆心 y = topPad + NODE_RADIUS
  const baseY = PADDING + LABEL_HEIGHT + NODE_RADIUS

  return orphans.value.map((orphan, i) => ({
    ...orphan,
    x: baseX - NODE_RADIUS,
    y: baseY + i * (NODE_RADIUS * 2 + SIBLING_GAP) - NODE_RADIUS,
  }))
})

const edgeLines = computed(() => {
  const positions = layout.value.positions
  const highlighted = highlightedSet.value
  // positions 存的是圆心；连线贴圆上下缘，勿再加减 label 高度（否则会和节点脱节）
  return (props.tree.edges || []).map((edge) => {
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) return null
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy) || 1
    const nx = dx / dist
    const ny = dy / dist
    // 从父圆边缘连到子圆边缘，避免线穿进圆内或悬空
    const x1 = from.x + nx * NODE_RADIUS
    const y1 = from.y + ny * NODE_RADIUS
    const x2 = to.x - nx * NODE_RADIUS
    const y2 = to.y - ny * NODE_RADIUS
    const pathHighlighted = highlighted.has(edge.from) || highlighted.has(edge.to)
    return {
      key: `${edge.from}-${edge.side}-${edge.to}`,
      x1,
      y1,
      x2,
      y2,
      highlighted: pathHighlighted,
    }
  }).filter(Boolean)
})

function layoutTree(nodes, orphanCount) {
  if (!nodes.length) {
    const orphanWidth = orphanCount > 0 ? ORPHAN_GAP + NODE_RADIUS * 2 + PADDING : 0
    return { positions: {}, width: 200 + orphanWidth, height: 120 }
  }

  const byLayer = {}
  for (const n of nodes) {
    const layer = n.layer ?? 0
    if (!byLayer[layer]) byLayer[layer] = []
    byLayer[layer].push(n)
  }

  const layers = Object.keys(byLayer).map(Number).sort((a, b) => a - b)
  const positions = {}
  let maxRowWidth = 0

  for (const layer of layers) {
    const layerNodes = byLayer[layer]
    const count = layerNodes.length
    const rowWidth = count * (NODE_RADIUS * 2 + SIBLING_GAP) - SIBLING_GAP
    maxRowWidth = Math.max(maxRowWidth, rowWidth)
  }

  const orphanExtra = orphanCount > 0 ? ORPHAN_GAP + NODE_RADIUS * 2 : 0
  const canvasWidth = maxRowWidth + PADDING * 2 + orphanExtra
  // 顶部预留指针标签空间（标签绝对定位在圆上方，不占布局盒）
  const topPad = PADDING + LABEL_HEIGHT
  let maxY = topPad

  for (const layer of layers) {
    const layerNodes = byLayer[layer]
    const count = layerNodes.length
    const rowWidth = count * (NODE_RADIUS * 2 + SIBLING_GAP) - SIBLING_GAP
    const startX = PADDING + (maxRowWidth - rowWidth) / 2 + NODE_RADIUS
    const baseY = topPad + layer * LAYER_GAP + NODE_RADIUS

    layerNodes.forEach((node, i) => {
      positions[node.id] = {
        x: startX + i * (NODE_RADIUS * 2 + SIBLING_GAP),
        y: baseY,
      }
    })

    maxY = Math.max(maxY, baseY + NODE_RADIUS)
  }

  return {
    positions,
    width: canvasWidth,
    height: Math.max(
      maxY + PADDING,
      orphanCount > 0
        ? PADDING + LABEL_HEIGHT + orphanCount * (NODE_RADIUS * 2 + SIBLING_GAP)
        : 0,
    ),
  }
}
</script>

<style scoped>
.tree-canvas {
  width: 100%;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-height: 140px;
  overflow-x: auto;
  overflow-y: visible;
}

.tc-empty {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

.tc-inner {
  position: relative;
  margin: 0 auto;
}

.tc-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}
</style>
