<template>
  <div
    class="tree-node"
    :class="nodeClass"
    :style="{ transform: `translate(${x}px, ${y}px)` }"
  >
    <div v-if="aboveLabels.length" class="tree-node-labels tree-node-labels-above">
      <span
        v-for="label in aboveLabels"
        :key="'a' + label"
        class="tree-node-label"
        :style="labelChipStyle(label)"
      >{{ label }}</span>
    </div>
    <div class="tree-node-circle" :style="circleStyle">
      <span class="tree-node-val">{{ formatVal(val) }}</span>
    </div>
    <div v-if="belowLabels.length" class="tree-node-labels tree-node-labels-below">
      <span
        v-for="label in belowLabels"
        :key="'b' + label"
        class="tree-node-label"
        :style="labelChipStyle(label)"
      >{{ label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { colorForRole, colorForPointerName, POINTER_ROLE_COLORS } from '../utils/pointerRoleColors.js'
import { splitTreeLabelsAboveBelow } from '../utils/pointerPlacement.js'

const props = defineProps({
  id: { type: String, required: true },
  val: { type: [Number, String, Object, Boolean], default: null },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  role: { type: String, default: null },
  isHighlighted: { type: Boolean, default: false },
  labels: { type: Array, default: () => [] },
})

const nodeClass = computed(() => ({
  highlighted: props.isHighlighted && !props.role,
  [`role-${props.role}`]: !!props.role,
}))

const accentColor = computed(() => {
  if (props.role && POINTER_ROLE_COLORS[props.role]) return colorForRole(props.role)
  if (props.isHighlighted) return POINTER_ROLE_COLORS.insert
  return null
})

const circleStyle = computed(() => {
  const color = accentColor.value
  if (!color) return {}
  return {
    borderColor: color,
    boxShadow: `0 0 0 2px ${color}40`,
  }
})

const labelStyle = computed(() => {
  const color = accentColor.value
  if (!color) return {}
  return {
    color: '#ffffff',
    borderColor: color,
    background: color,
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
  }
})

function labelChipStyle(label) {
  const color = colorForPointerName(label) || accentColor.value
  if (!color) return labelStyle.value
  return {
    color: '#ffffff',
    borderColor: color,
    background: color,
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
  }
}

const displayLabels = computed(() => props.labels || [])
const splitLabels = computed(() => splitTreeLabelsAboveBelow(displayLabels.value))
const aboveLabels = computed(() => splitLabels.value.above)
const belowLabels = computed(() => splitLabels.value.below)

function formatVal(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.tree-node {
  position: absolute;
  left: 0;
  top: 0;
  width: 44px;
  height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 360ms cubic-bezier(.22, .9, .27, 1);
  z-index: 3;
  pointer-events: none;
}

.tree-node-labels {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  width: max-content;
  max-width: 120px;
}
.tree-node-labels-above {
  bottom: calc(100% + 4px);
}
.tree-node-labels-below {
  top: calc(100% + 4px);
}

.tree-node-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-bg);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  white-space: nowrap;
}

.tree-node-circle {
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: border-color 320ms ease, box-shadow 320ms ease;
  flex-shrink: 0;
}

.tree-node-val {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-h);
}

.tree-node.highlighted .tree-node-circle {
  /* Focus fallback — yellow like cur (root red is role-root, not highlight) */
  border-color: #eab308;
  box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.28);
}
</style>
