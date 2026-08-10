<template>
  <div
    class="array-node"
    :class="{ highlighted: isHighlighted, first: isFirst, last: isLast }"
    :style="highlightStyle"
  >
    <div class="array-node-val">{{ value == null ? '∅' : value }}</div>
    <div class="array-node-idx">{{ index }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { colorForRole, primaryRoleFromLabels } from '../utils/pointerRoleColors.js'

const props = defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isHighlighted: { type: Boolean, default: false },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  pointerLabels: { type: Array, default: () => [] },
  /** Explicit role override: mid | next | prev | insert */
  role: { type: String, default: null },
})

const resolvedRole = computed(() => {
  if (props.role) return props.role
  return primaryRoleFromLabels(props.pointerLabels)
})

const highlightStyle = computed(() => {
  if (!props.isHighlighted) return {}
  const color = colorForRole(resolvedRole.value) || colorForRole('mid')
  return {
    background: `${color}26`,
    borderColor: color,
    zIndex: 1,
    position: 'relative',
  }
})
</script>

<style scoped>
.array-node {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 48px;
  min-width: 48px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  margin-left: -1px;
  background: var(--card-bg);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-h);
  transition: background 0.15s, border-color 0.15s;
}
.array-node.first {
  margin-left: 0;
}
.array-node-val {
  padding: 8px 10px;
  min-width: 44px;
  text-align: center;
  flex: 1;
}
.array-node-idx {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  text-align: center;
}
</style>
