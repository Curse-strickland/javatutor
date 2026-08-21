<template>
  <div
    class="ds-array-cell"
    :class="{ highlighted: isHighlighted, first: isFirst, last: isLast, pivot: isPivot }"
    :style="cellStyle"
  >
    <div class="ds-array-cell-val">{{ value == null ? '∅' : value }}</div>
    <div class="ds-array-cell-idx">{{ index }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { colorForRole, primaryRoleFromLabels, POINTER_ROLE_COLORS } from '../utils/pointerRoleColors.js'

const props = defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
  pointerLabels: { type: Array, default: () => [] },
  role: { type: String, default: null },
  isPivot: { type: Boolean, default: false },
})

const resolvedRole = computed(() => {
  if (props.role) return props.role
  return primaryRoleFromLabels(props.pointerLabels)
})

const cellStyle = computed(() => {
  if (props.isPivot) {
    return {
      background: 'transparent',
      borderColor: '#f97316',
      boxShadow: `inset 0 0 0 1px #f97316, var(--ds-cell-shadow-active)`,
      zIndex: 2,
      position: 'relative',
    }
  }
  if (!props.isHighlighted) return {}
  const color = colorForRole(resolvedRole.value) || colorForRole('mid')
  return {
    background: `${color}26`,
    borderColor: color,
    boxShadow: `var(--ds-cell-shadow-active)`,
    zIndex: 1,
    position: 'relative',
  }
})
</script>

<style scoped>
.ds-array-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-width: 48px;
  flex-shrink: 0;
  border-radius: var(--ds-cell-radius);
  border: var(--ds-cell-border);
  background: var(--card-bg);
  box-shadow: var(--ds-cell-shadow);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-h);
  transition: background 0.15s, border-color 0.15s;
}
.ds-array-cell.first { /* 容器层负责外圈圆角对齐，cell 自身不特殊处理 */ }
.ds-array-cell.last  { /* 同上 */ }
.ds-array-cell-val {
  padding: 8px 10px;
  min-width: 44px;
  text-align: center;
  flex: 1;
}
.ds-array-cell-idx {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  text-align: center;
}
.ds-array-cell.pivot {
  border-color: #f97316;
}
</style>
