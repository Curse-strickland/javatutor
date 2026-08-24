<template>
  <div class="sort-array-canvas">
    <div class="sac-header">
      <span class="sac-label">{{ label }}</span>
      <button
        v-if="distinctVars.length"
        type="button"
        class="sac-var-toggle"
        @click="openVarSelector($event)"
      >展示的变量</button>
    </div>
    <div class="sac-strip-wrap" ref="wrapEl">
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
      <div class="sac-strip" :style="{ gridTemplateColumns: layout.gridTemplate }">
        <div v-if="sortedHighlight" class="sac-sorted" :style="sortedHighlight" />
        <div v-if="rangeHighlight" class="sac-range" :style="rangeHighlight" />
        <ArrayCell
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

    <VarVisibilityPopover
      v-if="varSelectorOpen"
      :vars="distinctVars"
      :hidden="hiddenVars"
      :anchor="varSelectorAnchor"
      :open="true"
      @update:hidden="onHiddenChange"
      @close="varSelectorOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import ArrayCell from './ArrayCell.vue'
import VarVisibilityPopover from './VarVisibilityPopover.vue'
import { computeChipLayout } from '../utils/chipOverlayLayout.js'
import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
} from '../utils/pointerRoleColors.js'
import { withCellPlacement } from '../utils/pointerPlacement.js'
import { rangeRect, columnLefts } from '../utils/rangeRect.js'

const PIVOT_COLOR = '#f97316'

const props = defineProps({
  values: { type: Array, required: true },
  pointers: { type: Object, default: () => ({}) },
  range: { type: Object, default: null },
  activeIndex: { type: Number, default: null },
  pivot: { type: Object, default: null },
  sortedRange: { type: Object, default: null },
  label: { type: String, default: '' },
})

const wrapEl = ref(null)
const varSelectorOpen = ref(false)
const varSelectorAnchor = ref({ left: 0, top: 0 })
const hiddenVars = ref(new Set())

function onScroll() {
  varSelectorOpen.value = false
}
onMounted(() => window.addEventListener('scroll', onScroll, true))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll, true))

// step 变更 / props 变更 → 重置 popover + 变量选择
watch(() => [props.pointers, props.values, props.pivot, props.range, props.sortedRange], () => {
  varSelectorOpen.value = false
  hiddenVars.value = new Set()
}, { deep: true })

function openVarSelector(event) {
  varSelectorOpen.value = true
  const rect = event?.currentTarget?.getBoundingClientRect()
  varSelectorAnchor.value = rect
    ? { left: rect.left, top: rect.bottom + 4 }
    : { left: 0, top: 0 }
}

function onHiddenChange(set) {
  hiddenVars.value = set
}

const pivotIndex = computed(() => (props.pivot && typeof props.pivot.index === 'number' ? props.pivot.index : null))

const chipsByCell = computed(() => {
  const map = new Map()
  const len = props.values?.length || 0
  for (const [name, idx] of Object.entries(props.pointers || {})) {
    if (idx == null || idx < 0 || idx >= len) continue
    const color = colorForPointerName(name) || colorForRole('mid')
    const role = inferPointerRole(name)
    if (!map.has(idx)) map.set(idx, [])
    map.get(idx).push({ name, color, role })
  }
  if (pivotIndex.value !== null && !map.has(pivotIndex.value)) {
    const idx = pivotIndex.value
    map.set(idx, [{ name: `pivot=${props.pivot?.value ?? props.values[idx]}`, color: PIVOT_COLOR, role: null }])
  } else if (pivotIndex.value !== null) {
    // 已有指针，把 pivot chip 也加上（如果还没）
    const exists = map.get(pivotIndex.value).some((c) => c.name.startsWith('pivot='))
    if (!exists) {
      map.get(pivotIndex.value).push({
        name: `pivot=${props.pivot?.value ?? props.values[pivotIndex.value]}`,
        color: PIVOT_COLOR,
        role: null,
      })
    }
  }
  return map
})

const distinctVars = computed(() => {
  const seen = new Set()
  const vars = []
  for (const chips of chipsByCell.value.values()) {
    for (const c of chips) {
      if (seen.has(c.name)) continue
      seen.add(c.name)
      vars.push({ name: c.name, color: c.color })
    }
  }
  return vars
})

const visibleChipsByCell = computed(() => {
  if (hiddenVars.value.size === 0) return chipsByCell.value
  const out = new Map()
  for (const [idx, chips] of chipsByCell.value.entries()) {
    const kept = chips.filter((c) => !hiddenVars.value.has(c.name))
    if (kept.length) out.set(idx, kept)
  }
  return out
})

const layout = computed(() => computeChipLayout({
  chipsByCell: visibleChipsByCell.value,
  length: props.values?.length || 0,
}))

let _gap = null
function stripGap() {
  if (_gap == null) {
    _gap = 2
    if (typeof document !== 'undefined') {
      const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-strip-gap'))
      if (!Number.isNaN(g)) _gap = g
    }
  }
  return _gap
}

function chipStyleFor(role, color) {
  return roleStyle(role) || {
    color,
    borderColor: `${color}66`,
    background: 'var(--card-bg)',
    fill: color,
  }
}

// pointer chip 列表（无折叠；每格一个在上、两个在下、多个重叠且上下随机）
const pointerEntries = computed(() => {
  const lefts = columnLefts(layout.value.cellWidths, stripGap())
  const entries = []

  for (const [index, chips] of visibleChipsByCell.value.entries()) {
    if (index < 0 || index >= lefts.length) continue
    const left = lefts[index] + layout.value.cellWidths[index] / 2
    for (const chip of chips) {
      entries.push({
        key: `${index}:${chip.name}`,
        index,
        label: chip.name,
        left,
        color: chip.color,
        chipStyle: chipStyleFor(chip.role, chip.color),
      })
    }
  }

  return withCellPlacement(entries)
})

const aboveEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'above'))
const belowEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'below'))

const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  const rect = rangeRect(lo, hi, layout.value.cellWidths, stripGap())
  return { left: `${rect.left}px`, width: `${rect.width}px` }
})

const sortedHighlight = computed(() => {
  const r = props.sortedRange
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  const rect = rangeRect(lo, hi, layout.value.cellWidths, stripGap())
  // sorted 用 green 注入到 --range-color
  return {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    '--range-color': '#10b981',
  }
})

function labelsAt(i) { return [] }  // pointer chip 已在外层渲染，cell 不重复
function roleAt(i) {
  return primaryRoleFromLabels(visibleChipsByCell.value.get(i)?.map((c) => c.name) || [])
}
function isPointerIndex(i) {
  return visibleChipsByCell.value.has(i)
}
</script>

<style scoped>
.sort-array-canvas { padding: 4px 0; }
.sac-header { margin-bottom: 6px; display: flex; align-items: baseline; gap: 10px; }
.sac-label {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.sac-var-toggle {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--accent);
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  border-radius: 3px;
  padding: 1px 6px;
  cursor: pointer;
  letter-spacing: 0.03em;
}
.sac-var-toggle:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
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
  font-size: v-bind('layout.chipFontSize + "px"');
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
  display: grid;
  grid-auto-rows: auto;
  gap: var(--ds-strip-gap, 2px);
}
.sac-range {
  position: absolute;
  top: 0;
  bottom: 0;
  border: 1px solid color-mix(in srgb, var(--range-color, #3b82f6) 45%, transparent);
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
.sac-sorted {
  position: absolute;
  top: 0;
  bottom: 0;
  border: 1px solid color-mix(in srgb, var(--range-color, #10b981) 45%, transparent);
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
</style>
