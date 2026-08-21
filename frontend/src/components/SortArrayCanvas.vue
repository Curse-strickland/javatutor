<template>
  <div class="sort-array-canvas">
    <div class="sac-header">
      <span class="sac-label">{{ label }}</span>
    </div>
    <div class="sac-strip-wrap">
      <div class="sac-pointers sac-pointers-above">
        <div
          v-for="entry in aboveEntries"
          :key="entry.key"
          class="sac-pointer"
          :style="{ left: entry.left + 'px' }"
        >
          <span class="sac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
          <svg class="sac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
            <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
          </svg>
        </div>
      </div>
      <div class="sac-strip">
        <div
          v-if="sortedHighlight"
          class="sac-sorted"
          :style="sortedHighlight"
        />
        <div
          v-if="rangeHighlight"
          class="sac-range"
          :style="rangeHighlight"
        />
        <ArrayNode
          v-for="(v, i) in values"
          :key="i"
          :value="v"
          :index="i"
          :is-first="i === 0"
          :is-last="i === values.length - 1"
          :is-highlighted="i === activeIndex || isPointerIndex(i)"
          :is-pivot="pivotIndex !== null && i === pivotIndex"
          :pointer-labels="labelsAt(i)"
          :role="roleAt(i)"
        />
      </div>
      <div class="sac-pointers sac-pointers-below">
        <div
          v-for="entry in belowEntries"
          :key="entry.key"
          class="sac-pointer sac-pointer-below"
          :style="{ left: entry.left + 'px' }"
        >
          <svg class="sac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
            <path d="M5 0 L10 6 L0 6 Z" :fill="entry.color" />
          </svg>
          <span class="sac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ArrayNode from './ArrayNode.vue'
import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
} from '../utils/pointerRoleColors.js'
import { withVerticalPlacement } from '../utils/pointerPlacement.js'

const props = defineProps({
  values: { type: Array, required: true },
  pointers: { type: Object, default: () => ({}) },
  range: { type: Object, default: null },
  activeIndex: { type: Number, default: null },
  pivot: { type: Object, default: null },
  sortedRange: { type: Object, default: null },
  label: { type: String, default: '' },
})

const CELL_WIDTH = 48
const FALLBACK_COLOR = colorForRole('mid')
const PIVOT_COLOR = '#f97316'
const SORTED_COLOR = '#10b981'

const pointerEntries = computed(() => {
  const entries = []
  const seen = new Set()
  const len = props.values?.length || 0

  for (const [name, idx] of Object.entries(props.pointers || {})) {
    if (idx == null || idx < 0 || idx >= len) continue
    const key = `${idx}:${name}`
    if (seen.has(key)) continue
    seen.add(key)
    const role = inferPointerRole(name)
    const color = colorForPointerName(name) || FALLBACK_COLOR
    entries.push({
      key,
      index: idx,
      label: name,
      left: idx * CELL_WIDTH + CELL_WIDTH / 2,
      color,
      chipStyle: roleStyle(role),
    })
  }

  // Quicksort pivot chip: render alongside pointer chips so the user sees the
  // pivot value above its current cell, even if no i/j pointer points there.
  const pv = props.pivot
  if (pv && typeof pv.index === 'number' && pv.index >= 0 && pv.index < len) {
    const labelText = `pivot=${pv.value != null ? pv.value : props.values[pv.index]}`
    entries.push({
      key: `pivot:${pv.index}`,
      index: pv.index,
      label: labelText,
      left: pv.index * CELL_WIDTH + CELL_WIDTH / 2,
      color: PIVOT_COLOR,
      chipStyle: {
        color: PIVOT_COLOR,
        borderColor: `${PIVOT_COLOR}66`,
        background: `${PIVOT_COLOR}22`,
        fill: PIVOT_COLOR,
      },
    })
  }

  return withVerticalPlacement(entries)
})

const aboveEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'above'))
const belowEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'below'))

const pivotIndex = computed(() => (props.pivot && typeof props.pivot.index === 'number' ? props.pivot.index : null))

const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return {
    left: `${lo * CELL_WIDTH}px`,
    width: `${(hi - lo + 1) * CELL_WIDTH}px`,
  }
})

const sortedHighlight = computed(() => {
  const r = props.sortedRange
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return {
    left: `${lo * CELL_WIDTH}px`,
    width: `${(hi - lo + 1) * CELL_WIDTH}px`,
  }
})

function labelsAt(i) {
  const labels = []
  for (const [name, idx] of Object.entries(props.pointers || {})) {
    if (idx === i) labels.push(name)
  }
  return labels
}

function roleAt(i) {
  const labels = labelsAt(i)
  if (labels.length) return primaryRoleFromLabels(labels)
  if (i === props.activeIndex) return 'mid'
  return null
}

function isPointerIndex(i) {
  return Object.values(props.pointers || {}).includes(i)
}
</script>

<style scoped>
.sort-array-canvas { padding: 4px 0; }
.sac-header { margin-bottom: 6px; }
.sac-label {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.sac-strip-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  padding-top: 28px;
  padding-bottom: 28px;
}
.sac-pointers {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  pointer-events: none;
}
.sac-pointers-above { top: 0; }
.sac-pointers-below { bottom: 0; }
.sac-pointer {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sac-pointer-below {
  top: auto;
  bottom: 0;
}
.sac-pointer-text {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.sac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.sac-pointer-below .sac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.sac-strip {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  border: 1px solid var(--border);
  background: var(--card-bg);
}
.sac-range {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, #3b82f6 10%, transparent);
  border-left: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  border-right: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  pointer-events: none;
  z-index: 0;
}
.sac-sorted {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, #10b981 12%, transparent);
  border-left: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  border-right: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  pointer-events: none;
  z-index: 0;
}
.sac-strip :deep(.array-node) {
  position: relative;
  z-index: 1;
}
</style>
