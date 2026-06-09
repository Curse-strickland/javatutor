<template>
  <div class="array-canvas" v-if="arr && arr.length !== undefined" v-show="!collapsed">
    <div class="cells" :style="{ '--count': arr.length }">
      <div
        v-for="(v, i) in arr"
        :key="i"
        class="cell"
        :class="{ changed: changedIndicesSet.has(i), compare: compareIndicesSet.has(i) }"
      >
        <div class="cell-value">{{ formatValue(v) }}</div>
        <div class="cell-index">{{ i }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  arr: { type: Array, required: true },
  changedIndices: { type: Array, default: () => [] },
  compareIndices: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false }
})

const changedIndicesSet = computed(() => new Set(props.changedIndices || []))
const compareIndicesSet = computed(() => new Set(props.compareIndices || []))

function formatValue(v) {
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.array-canvas { width: 100%; padding-top: 6px }
.cells { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 6px }
.cell {
  min-width: 56px;
  max-width: 120px;
  flex: 0 0 auto;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 8px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: background 520ms cubic-bezier(.22,.9,.27,1), transform 320ms cubic-bezier(.22,.9,.27,1), box-shadow 320ms ease, border-color 320ms ease;
}
.cell.changed {
  background: var(--card-bg);
  border-color: var(--accent-border);
  box-shadow: 0 6px 14px rgba(37,99,235,0.08);
}
.cell.compare {
  background: var(--card-bg);
  border-color: rgba(255,199,44,0.20);
  box-shadow: 0 4px 10px rgba(255,199,44,0.06);
}
.cell-value { font-weight: 600; color: var(--text-h); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.cell-index { font-size: 11px; color: var(--text-muted); margin-top: 4px }

@media (max-width: 640px) {
  .cell { min-width: 48px; padding: 4px 6px }
  .cell-value { font-size: 12px }
}
</style>
