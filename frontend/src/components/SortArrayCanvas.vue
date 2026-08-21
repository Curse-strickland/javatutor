<template>
  <div class="sort-array-canvas">
    <div class="sac-header">
      <span class="sac-label">{{ label }}</span>
    </div>
    <div class="sac-strip-wrap" ref="wrapEl">
      <div class="sac-pointers sac-pointers-above">
        <div
          v-for="entry in aboveEntries"
          :key="entry.key"
          class="sac-pointer"
          :style="{ left: entry.left + 'px' }"
        >
          <span
            class="sac-pointer-text"
            :class="{ 'sac-pointer-summary': entry.isSummary }"
            :style="entry.chipStyle"
            @click="onChipClick(entry)"
          >{{ entry.label }}</span>
          <svg class="sac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
            <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
          </svg>
        </div>
      </div>
      <div
        class="sac-strip"
        :style="{ gridTemplateColumns: `repeat(${values.length}, ${layout.cellWidth}px)` }"
      >
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
          <span
            class="sac-pointer-text"
            :class="{ 'sac-pointer-summary': entry.isSummary }"
            :style="entry.chipStyle"
            @click="onChipClick(entry)"
          >{{ entry.label }}</span>
        </div>
      </div>
    </div>

    <ChipOverflowPopover
      v-if="popoverOpenCell !== null"
      :chips="overflowChipsForCell(popoverOpenCell)"
      :selection="overflowSelections.get(popoverOpenCell) || new Set()"
      :anchor="popoverAnchor"
      :open="true"
      :viewport-width="viewportW"
      :viewport-height="viewportH"
      @update:selection="(s) => onSelectionChange(popoverOpenCell, s)"
      @close="popoverOpenCell = null"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import ArrayCell from './ArrayCell.vue'
import ChipOverflowPopover from './ChipOverflowPopover.vue'
import { computeChipLayout } from '../utils/chipOverlayLayout.js'
import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
  POINTER_ROLE_COLORS,
} from '../utils/pointerRoleColors.js'
import { withVerticalPlacement } from '../utils/pointerPlacement.js'

const PIVOT_COLOR = '#f97316'
const ELSE_COLOR = POINTER_ROLE_COLORS.neutral
const FALLBACK_COLOR = colorForRole('mid')

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
const popoverOpenCell = ref(null)
const overflowSelections = ref(new Map())
const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

function onResize() {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// step 变更 / props 变更 → 重置 popover + selections
watch(() => [props.pointers, props.values, props.pivot, props.range, props.sortedRange], () => {
  popoverOpenCell.value = null
  overflowSelections.value = new Map()
}, { deep: true })

const pivotIndex = computed(() => (props.pivot && typeof props.pivot.index === 'number' ? props.pivot.index : null))

function pivotChipName(idx) {
  return `pivot=${props.pivot?.value != null ? props.pivot.value : props.values[idx]}`
}

const chipsByCell = computed(() => {
  const map = new Map()
  const len = props.values?.length || 0
  for (const [name, idx] of Object.entries(props.pointers || {})) {
    if (idx == null || idx < 0 || idx >= len) continue
    const color = colorForPointerName(name) || FALLBACK_COLOR
    const role = inferPointerRole(name)
    if (!map.has(idx)) map.set(idx, [])
    map.get(idx).push({ name, color, role })
  }
  const pi = pivotIndex.value
  if (pi !== null && pi >= 0 && pi < len) {
    const name = pivotChipName(pi)
    if (!map.has(pi)) {
      map.set(pi, [{ name, color: PIVOT_COLOR, role: null }])
    } else {
      const chips = map.get(pi)
      const exists = chips.some((c) => c.name.startsWith('pivot='))
      // pivot 永远排在最前，保证它落在 visibleChips 里、不会被 +N 吞掉
      if (!exists) chips.unshift({ name, color: PIVOT_COLOR, role: null })
    }
  }
  return map
})

const layout = computed(() => computeChipLayout({ chipsByCell: chipsByCell.value }))

// pointer chip 列表（含 +N / else）
const pointerEntries = computed(() => {
  const entries = []
  const seen = new Set()
  const len = props.values?.length || 0

  for (const [index, chips] of chipsByCell.value.entries()) {
    if (index < 0 || index >= len) continue
    const overflow = layout.value.overflowByCell.get(index)
    const visible = overflow ? overflow.visibleChips : chips
    const leftBase = index * layout.value.cellWidth + layout.value.cellWidth / 2

    for (const chip of visible) {
      const key = `${index}:${chip.name}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({
        key,
        index,
        label: chip.name,
        left: leftBase,
        color: chip.color,
        chipStyle: chipStyleFor(chip.role, chip.color),
        isSummary: false,
      })
    }

    if (overflow) {
      const selectionSet = overflowSelections.value.get(index)
      const summary = selectionSet && selectionSet.size > 0
        ? { label: 'else', key: `${index}:else` }
        : { label: `+${overflow.hiddenCount}`, key: `${index}:+${overflow.hiddenCount}` }
      entries.push({
        key: summary.key,
        index,
        label: summary.label,
        left: leftBase,
        color: ELSE_COLOR,
        chipStyle: chipStyleFor(null, ELSE_COLOR),
        isSummary: true,
      })
    }
  }

  return withVerticalPlacement(entries)
})

function chipStyleFor(role, color) {
  const styled = roleStyle(role)
  if (styled && styled.color) return styled
  return {
    color,
    borderColor: `${color}66`,
    background: `${color}22`,
    fill: color,
  }
}

const aboveEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'above'))
const belowEntries = computed(() => pointerEntries.value.filter((e) => e.placement === 'below'))

const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return { left: `${lo * layout.value.cellWidth}px`, width: `${(hi - lo + 1) * layout.value.cellWidth}px` }
})

const sortedHighlight = computed(() => {
  const r = props.sortedRange
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return { left: `${lo * layout.value.cellWidth}px`, width: `${(hi - lo + 1) * layout.value.cellWidth}px` }
})

// pointer chip 已在外层（strip 上/下方）渲染，cell 内不重复画 label
function labelsAt() { return [] }

function roleAt(i) {
  const role = primaryRoleFromLabels((chipsByCell.value.get(i) || []).map((c) => c.name))
  if (role) return role
  if (i === props.activeIndex) return 'mid'
  return null
}

function isPointerIndex(i) {
  return chipsByCell.value.has(i)
}

// popover helpers
function overflowChipsForCell(index) {
  return chipsByCell.value.get(index) || []
}

function onChipClick(entry) {
  if (!entry.isSummary) return
  popoverOpenCell.value = popoverOpenCell.value === entry.index ? null : entry.index
}

function onSelectionChange(index, newSet) {
  const next = new Map(overflowSelections.value)
  next.set(index, newSet)
  overflowSelections.value = next
}

const popoverAnchor = computed(() => {
  if (popoverOpenCell.value === null || !wrapEl.value) {
    return { cellLeft: 0, cellWidth: 0, containerTop: 0 }
  }
  const rect = wrapEl.value.getBoundingClientRect()
  const idx = popoverOpenCell.value
  return {
    cellLeft: rect.left + idx * layout.value.cellWidth,
    cellWidth: layout.value.cellWidth,
    containerTop: rect.top,
  }
})
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
.sac-pointer-summary {
  pointer-events: auto;
  cursor: pointer;
}
.sac-pointer-summary:hover { filter: brightness(0.92); }
.sac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.sac-pointer-below .sac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.sac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: 2px;
}
.sac-strip :deep(.ds-array-cell) {
  position: relative;
  z-index: 1;
}
.sac-range {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, #3b82f6 10%, transparent);
  border-left: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  border-right: 1px solid color-mix(in srgb, #3b82f6 25%, transparent);
  border-radius: var(--ds-cell-radius);
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
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
</style>
