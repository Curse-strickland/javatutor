<template>
  <div class="dst">
    <div class="dst-header">
      <span class="dst-h">数据结构</span>
      <div class="dst-badges">
        <span v-for="b in badges" :key="b.key" class="dst-badge" :class="{ active: b.count > 0 }">
          {{ b.label }} × {{ b.count }}
        </span>
        <span v-if="!anyDetected" class="dst-empty">未识别</span>
      </div>
    </div>

    <section v-if="result.linkedLists.length" class="dst-section">
      <h4 class="dst-section-h">链表</h4>
      <LinkedListCanvas
        :nodes="result.linkedLists[0].nodes"
        :pointer-labels="result.linkedLists[0].pointerLabels"
        :highlighted-node-ids="result.linkedLists[0].highlightedNodeIds"
      />
    </section>

    <section v-if="result.arrays.length" class="dst-section">
      <h4 class="dst-section-h">数组 / 栈 / 队列</h4>
      <ArrayCanvas :arrays="result.arrays" :highlighted-index="-1" />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/player'
import { extractDataStructures } from '../../utils/dataStructureExtract.js'
import LinkedListCanvas from '../LinkedListCanvas.vue'
import ArrayCanvas from '../ArrayCanvas.vue'

const store = usePlayerStore()

const result = computed(() => {
  const step = store.steps[store.currentStep]
  if (!step) return { linkedLists: [], arrays: [], trees: [], graphs: [] }
  const prev = store.steps[store.currentStep - 1] || null
  return extractDataStructures(
    step.heap || {},
    step.stackFrames || [],
    prev?.heap || null,
    prev?.stackFrames || null,
  )
})

const anyDetected = computed(() =>
  result.value.linkedLists.length > 0 || result.value.arrays.length > 0
)

const badges = computed(() => [
  { key: 'll', label: '链表', count: result.value.linkedLists.length },
  { key: 'arr', label: '数组', count: result.value.arrays.length },
  { key: 'tree', label: '树', count: result.value.trees.length },
  { key: 'graph', label: '图', count: result.value.graphs.length },
])
</script>

<style scoped>
.dst { padding: 8px; }
.dst-header { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
.dst-h { font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--text-h); }
.dst-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.dst-badge { font-family: var(--mono); font-size: 10px; padding: 3px 8px; border: 1px solid var(--border); color: var(--text-muted); clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px); }
.dst-badge.active { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.dst-empty { font-family: var(--mono); font-size: 10px; color: var(--text-muted); }
.dst-section { margin-bottom: 14px; }
.dst-section-h { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; color: var(--text-h); margin: 8px 0; }
</style>
