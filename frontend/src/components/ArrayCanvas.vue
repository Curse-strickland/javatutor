<template>
  <div class="array-canvas">
    <div v-if="!arrays.length" class="ac-empty">未识别到数组类结构</div>
    <div v-for="arr in arrays" :key="arr.id" class="ac-group">
      <div class="ac-group-header">
        <span class="ac-label">{{ arr.label }}</span>
        <span v-if="arr.sourceVar" class="ac-var">{{ arr.sourceVar }}</span>
      </div>
      <div class="ac-row">
        <ArrayNode
          v-for="(v, i) in arr.values"
          :key="i"
          :value="v"
          :index="i"
          :is-head="i === arr.headIndex"
          :is-tail="i === arr.tailIndex"
          :is-highlighted="i === highlightedIndex"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import ArrayNode from './ArrayNode.vue'
defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})
</script>

<style scoped>
.array-canvas { padding: 8px; }
.ac-empty { color: var(--text-muted); font-family: var(--mono); font-size: 12px; padding: 12px; }
.ac-group { margin-bottom: 14px; }
.ac-group-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; font-family: var(--mono); font-size: 11px; }
.ac-label { color: var(--text-h); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.ac-var { color: var(--accent); }
.ac-row { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
