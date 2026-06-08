<template>
  <div class="array-canvas" v-if="arr && arr.length !== undefined">
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
  compareIndices: { type: Array, default: () => [] }
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
.array-canvas { width: 100%; overflow-x: auto; padding-top: 6px }
.cells { display: flex; gap: 8px; padding-bottom: 6px }
.cell {
  min-width: 68px;
  max-width: 140px;
  flex: 0 0 auto;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  text-align: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  transition: background 520ms cubic-bezier(.22,.9,.27,1), transform 320ms cubic-bezier(.22,.9,.27,1), box-shadow 320ms ease, border-color 320ms ease;
}
.cell.changed {
  transform: none;
  background: var(--card-bg);
  border-color: var(--accent-border);
  box-shadow: 0 8px 18px rgba(37,99,235,0.03);
}
.cell.compare {
  transform: none;
  background: var(--card-bg);
  border-color: rgba(255,199,44,0.12);
  box-shadow: 0 6px 14px rgba(255,199,44,0.025);
}
.cell-value { font-weight: 600; color: var(--text-h); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.cell-index { font-size: 12px; color: var(--text-muted); margin-top: 6px }

@media (max-width: 640px) {
  .cell { min-width: 56px }
  .cell-value { font-size: 13px }
}

.cell { transition: background 520ms cubic-bezier(.22,.9,.27,1), transform 320ms cubic-bezier(.22,.9,.27,1), box-shadow 320ms ease, border-color 320ms ease }
</style>
