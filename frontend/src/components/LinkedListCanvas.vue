<template>
  <div class="linked-list-canvas">
    <svg ref="svgRef" :width="canvasWidth" :height="canvasHeight" class="w-full h-auto">
      <g class="arrows">
        <path
          v-for="(arrow, index) in arrows"
          :key="'arrow-' + index"
          :d="arrow.path"
          stroke="#3b82f6"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
          class="transition-all duration-500"
        />
      </g>
      <g class="nodes">
        <g
          v-for="node in nodes"
          :key="node.id"
          :transform="`translate(${node.x}, ${node.y})`"
          class="transition-all duration-500"
        >
          <rect
            x="0"
            y="0"
            :width="NODE_WIDTH"
            :height="NODE_HEIGHT"
            rx="4"
            ry="4"
            :fill="getNodeFill(node.id)"
            :stroke="getNodeStroke(node.id)"
            stroke-width="3"
            class="transition-all duration-300"
          />
          <text
            x="15"
            y="20"
            font-size="14"
            font-weight="bold"
            fill="#1f2937"
            class="dark:fill-gray-100"
          >
            {{ node.val }}
          </text>
          <text
            x="5"
            y="-5"
            font-size="10"
            fill="#6b7280"
          >
            {{ node.id }}
          </text>
        </g>
      </g>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
        </marker>
      </defs>
    </svg>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
  highlightedNodeIds: { type: Array, default: () => [] },
  compareNodeIds: { type: Array, default: () => [] },
})

const svgRef = ref(null)
const NODE_WIDTH = 80
const NODE_HEIGHT = 40
const NODE_SPACING = 120
const MARGIN = 40

const canvasWidth = computed(() => {
  if (props.nodes.length === 0) return 200
  return props.nodes.length * NODE_SPACING + MARGIN * 2
})

const canvasHeight = computed(() => NODE_HEIGHT + MARGIN * 2)

const positionedNodes = computed(() => {
  return props.nodes.map((node, index) => ({
    ...node,
    x: MARGIN + index * NODE_SPACING,
    y: MARGIN,
  }))
})

const arrows = computed(() => {
  const result = []
  positionedNodes.value.forEach((node) => {
    if (node.next) {
      const targetNode = positionedNodes.value.find((n) => n.id === node.next)
      if (targetNode) {
        const startX = node.x + NODE_WIDTH
        const startY = node.y + NODE_HEIGHT / 2
        const endX = targetNode.x
        const endY = targetNode.y + NODE_HEIGHT / 2
        let path
        if (Math.abs(targetNode.x - node.x) <= NODE_SPACING + 10) {
          path = `M ${startX} ${startY} L ${endX} ${endY}`
        } else {
          const midX = (startX + endX) / 2
          const controlY = startY - 30
          path = `M ${startX} ${startY} Q ${midX} ${controlY} ${endX} ${endY}`
        }
        result.push({ from: node.id, to: node.next, path })
      }
    }
  })
  return result
})

const getNodeFill = (nodeId) => {
  if (props.highlightedNodeIds.includes(nodeId)) return '#fef3c7'
  if (props.compareNodeIds.includes(nodeId)) return '#dbeafe'
  return '#ffffff'
}

const getNodeStroke = (nodeId) => {
  if (props.highlightedNodeIds.includes(nodeId)) return '#f59e0b'
  if (props.compareNodeIds.includes(nodeId)) return '#3b82f6'
  return '#d1d5db'
}
</script>

<style scoped>
.linked-list-canvas {
  @apply bg-gray-50 dark:bg-gray-900 rounded-lg p-4;
}
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
.duration-300 { transition-duration: 300ms; }
.duration-500 { transition-duration: 500ms; }
</style>
