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

    <section v-if="resultRaw.linkedLists.length" class="dst-section">
      <h4 class="dst-section-h">链表</h4>
      <LinkedListCanvas
        :nodes="resultRaw.linkedLists[0].nodes"
        :pointer-labels="resultRaw.linkedLists[0].pointerLabels"
        :highlighted-node-ids="resultRaw.linkedLists[0].highlightedNodeIds"
      />
    </section>

    <section v-if="kmpViz" class="dst-section">
      <h4 class="dst-section-h">字符串匹配</h4>
      <KmpCanvas :viz="kmpViz" />
    </section>

    <section v-if="showSortViz" class="dst-section">
      <h4 class="dst-section-h">排序</h4>
      <MergeSortTreeCanvas
        v-if="sortViz.mode === 'merge-tree'"
        :merge-dynamic="sortViz.mergeDynamic"
        :values="sortViz.values"
        :label="sortViz.label"
      />
      <SortBarCanvas
        v-else-if="sortViz.mode === 'bars'"
        :values="sortViz.values"
        :active-index="sortViz.activeIndex"
        :pointers="sortViz.pointers"
        :label="sortViz.label"
      />
      <template v-else-if="sortViz.mode === 'heap'">
        <p class="dst-sort-note">堆树视图（绿色 = 已排序尾段）：</p>
        <TreeCanvas v-if="heapTree" :tree="heapTree" class="dst-heap-tree" />
        <SortArrayCanvas
          :values="sortViz.values"
          :pointers="sortViz.pointers"
          :range="sortViz.range"
          :active-index="sortViz.activeIndex"
          :pivot="sortViz.pivot"
          :sorted-range="sortViz.sortedRange"
          :label="sortViz.label"
        />
      </template>
      <SortArrayCanvas
        v-else-if="sortViz.mode === 'array-pointers' || sortViz.mode === 'array'"
        :values="sortViz.values"
        :pointers="sortViz.pointers"
        :range="sortViz.range"
        :active-index="sortViz.activeIndex"
        :pivot="sortViz.pivot"
        :label="sortViz.label"
      />
    </section>

    <section v-if="visibleResult.arrays.length" class="dst-section">
      <h4 class="dst-section-h">数组 / 栈 / 队列</h4>
      <ArrayCanvas :arrays="visibleResult.arrays" :highlighted-index="-1" />
    </section>

    <section v-if="resultRaw.trees.length" class="dst-section">
      <h4 class="dst-section-h">树 / 堆</h4>
      <TreeCanvas
        v-for="(tree, i) in resultRaw.trees"
        :key="i"
        :tree="tree"
        class="dst-tree-canvas"
      />
    </section>

    <section v-if="resultRaw.graphs.length" class="dst-section">
      <h4 class="dst-section-h">图</h4>
      <GraphCanvas
        v-for="graph in resultRaw.graphs"
        :key="graph.id"
        :graph="graph"
        class="dst-graph-canvas"
      />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/player'
import { extractDataStructures } from '../../utils/dataStructureExtract.js'
import { extractSortViz } from '../../utils/sortVizExtract.js'
import { extractKmpViz } from '../../utils/kmpVizExtract.js'
import { buildHeapTreeFromArray } from '../../utils/heapTreeExtract.js'
import { matchesPrimaryArray } from '../../utils/arrayChips.js'
import LinkedListCanvas from '../LinkedListCanvas.vue'
import ArrayCanvas from '../ArrayCanvas.vue'
import TreeCanvas from '../TreeCanvas.vue'
import GraphCanvas from '../GraphCanvas.vue'
import MergeSortTreeCanvas from '../MergeSortTreeCanvas.vue'
import SortBarCanvas from '../SortBarCanvas.vue'
import SortArrayCanvas from '../SortArrayCanvas.vue'
import KmpCanvas from '../KmpCanvas.vue'

const store = usePlayerStore()

const stepContext = computed(() => {
  const step = store.steps[store.currentStep]
  if (!step) return null
  const prev = store.steps[store.currentStep - 1] || null
  return { step, prev }
})

const resultRaw = computed(() => {
  if (!stepContext.value) return { linkedLists: [], arrays: [], trees: [], graphs: [] }
  const { step, prev } = stepContext.value
  return extractDataStructures(
    step.heap || {},
    step.stackFrames || [],
    prev?.heap || null,
    prev?.stackFrames || null,
  )
})

// 数组形式模式（快排/插入/希尔等）隐藏下方重复数组；堆排/归并等非数组形式保留
const ARRAY_FORM_MODES = new Set(['array-pointers', 'bars', 'array'])

const visibleArrays = computed(() => {
  let arrays = resultRaw.value.arrays
  // KMP 激活时隐藏 next[]，避免与 KMP 画布重复显示
  if (kmpViz.value && kmpViz.value.primaryArrayId) {
    arrays = arrays.filter((a) => !matchesPrimaryArray(a, kmpViz.value.primaryArrayId))
  }
  const viz = showSortViz.value
  if (viz && ARRAY_FORM_MODES.has(viz.mode) && viz.primaryArrayId) {
    arrays = arrays.filter((a) => !matchesPrimaryArray(a, viz.primaryArrayId))
  }
  return arrays
})

const visibleResult = computed(() => ({ ...resultRaw.value, arrays: visibleArrays.value }))

const sortViz = computed(() => {
  if (!stepContext.value) return null
  const { step } = stepContext.value
  return extractSortViz(step.heap || {}, step.stackFrames || [], store.code || '')
})

const kmpViz = computed(() => {
  if (!stepContext.value) return null
  const { step, prev } = stepContext.value
  return extractKmpViz(
    step.heap || {},
    step.stackFrames || [],
    store.code || '',
    prev?.stackFrames || null,
  )
})

// KMP 的 next[] 会被误判为排序（i/j + 整数数组），激活 KMP 时抑制排序视图
const showSortViz = computed(() => (kmpViz.value ? null : sortViz.value))

const heapTree = computed(() => {
  if (!showSortViz.value || showSortViz.value.mode !== 'heap') return null
  return buildHeapTreeFromArray(
    showSortViz.value.values,
    showSortViz.value.heapSize,
    showSortViz.value.pointers,
  )
})

const anyDetected = computed(() =>
  resultRaw.value.linkedLists.length > 0
  || resultRaw.value.arrays.length > 0
  || resultRaw.value.trees.length > 0
  || resultRaw.value.graphs.length > 0
  || sortViz.value != null
  || kmpViz.value != null
)

const badges = computed(() => [
  { key: 'll', label: '链表', count: resultRaw.value.linkedLists.length },
  { key: 'sort', label: '排序', count: showSortViz.value ? 1 : 0 },
  { key: 'kmp', label: '字符串匹配', count: kmpViz.value ? 1 : 0 },
  { key: 'arr', label: '数组', count: resultRaw.value.arrays.length },
  { key: 'tree', label: '树', count: resultRaw.value.trees.length },
  { key: 'graph', label: '图', count: resultRaw.value.graphs.length },
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
.dst-tree-canvas { margin-bottom: 10px; }
.dst-graph-canvas { margin-bottom: 10px; }
.dst-heap-tree { margin-bottom: 10px; }
.dst-sort-note {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  margin: 0 0 6px;
}
</style>
