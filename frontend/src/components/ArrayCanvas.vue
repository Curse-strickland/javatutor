<template>
  <div class="array-canvas">
    <div v-if="!arrays.length" class="ac-empty">未识别到数组类结构</div>
    <div v-for="arr in arrays" :key="arr.id" class="ac-group">
      <div class="ac-group-header">
        <span class="ac-var">{{ arr.sourceVar || arr.id || 'array' }}</span>
        <span v-if="arr.label" class="ac-type">{{ arr.label }}</span>
        <span v-if="arr.dims === 2" class="ac-dims">二维表</span>
      </div>

      <MatrixCanvas
        v-if="arr.dims === 2 && arr.matrix"
        :matrix="arr.matrix"
        :rows="arr.rows"
        :cols="arr.cols"
        :index-pointers="arr.indexPointers"
        :pointer-labels="arr.pointerLabels"
      />

      <div v-else class="ac-strip-wrap" :ref="(el) => bindWrapEl(arr.id, el)">
        <div class="ac-pointers ac-pointers-above">
          <div
            v-for="entry in aboveEntriesFor(arr.id)"
            :key="entry.key"
            class="ac-pointer"
            :style="{ left: entry.left + 'px', fontSize: layoutFor(arr.id).chipFontSize + 'px' }"
          >
            <span
              class="ac-pointer-text"
              :class="{ 'ac-pointer-summary': entry.isSummary }"
              :style="entry.chipStyle"
              @click="onChipClick(arr.id, entry)"
            >{{ entry.label }}</span>
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
            </svg>
          </div>
        </div>
        <div
          class="ac-strip"
          :style="{ gridTemplateColumns: `repeat(${arr.values.length}, ${layoutFor(arr.id).cellWidth}px)` }"
        >
          <ArrayCell
            v-for="(v, i) in arr.values"
            :key="i"
            :value="v"
            :index="i"
            :is-first="i === 0"
            :is-last="i === arr.values.length - 1"
            :is-highlighted="i === highlightedIndex || isPointerHighlighted(arr, i)"
            :pointer-labels="labelsAt(arr, i)"
            :role="roleAt(arr, i)"
          />
        </div>
        <div class="ac-pointers ac-pointers-below">
          <div
            v-for="entry in belowEntriesFor(arr.id)"
            :key="entry.key"
            class="ac-pointer ac-pointer-below"
            :style="{ left: entry.left + 'px', fontSize: layoutFor(arr.id).chipFontSize + 'px' }"
          >
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M5 0 L10 6 L0 6 Z" :fill="entry.color" />
            </svg>
            <span
              class="ac-pointer-text"
              :class="{ 'ac-pointer-summary': entry.isSummary }"
              :style="entry.chipStyle"
              @click="onChipClick(arr.id, entry)"
            >{{ entry.label }}</span>
          </div>
        </div>

        <ChipOverflowPopover
          v-if="popoverOpenFor === arr.id"
          :chips="overflowChipsForArr(arr.id)"
          :selection="overflowSelections.get(arr.id) || EMPTY_SELECTION"
          :anchor="popoverAnchorFor(arr.id)"
          :open="true"
          :viewport-width="viewportW"
          :viewport-height="viewportH"
          @update:selection="(s) => onSelectionChange(arr.id, s)"
          @close="popoverOpenFor = null"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import ArrayCell from './ArrayCell.vue'
import ChipOverflowPopover from './ChipOverflowPopover.vue'
import MatrixCanvas from './MatrixCanvas.vue'
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

const ELSE_COLOR = POINTER_ROLE_COLORS.neutral
const FALLBACK_COLOR = colorForRole('mid')
const SHOW_LIMIT = 2
const EMPTY_SELECTION = new Set()
const FALLBACK_LAYOUT = { cellWidth: 48, chipFontSize: 11, overflowByCell: new Map(), fits: true }

const props = defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})

// 非响应式：仅用于 popover 定位，避免绑定 ref 时触发额外渲染
const wrapEls = new Map()
const popoverOpenFor = ref(null)
const overflowSelections = ref(new Map())
const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 768)

function onResize() {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// step / props 变更 → 重置 popover + selections
watch(() => props.arrays, () => {
  popoverOpenFor.value = null
  overflowSelections.value = new Map()
}, { deep: true })

function bindWrapEl(arrId, el) {
  if (el) wrapEls.set(arrId, el)
  else wrapEls.delete(arrId)
}

/** @returns {Map<number, Array<{name, color, role}>>} */
function buildChipsByCell(arr) {
  const map = new Map()
  const len = arr.values?.length || 0
  const push = (idx, name) => {
    if (idx == null || !Number.isFinite(idx) || idx < 0 || idx >= len) return
    if (name == null || name === '') return
    if (!map.has(idx)) map.set(idx, [])
    const chips = map.get(idx)
    if (chips.some((c) => c.name === name)) return
    chips.push({
      name,
      color: colorForPointerName(name) || FALLBACK_COLOR,
      role: inferPointerRole(name),
    })
  }

  for (const [name, idx] of Object.entries(arr.indexPointers || {})) push(idx, name)
  for (const [idxStr, labels] of Object.entries(arr.pointerLabels || {})) {
    const idx = Number(idxStr)
    for (const label of labels || []) push(idx, label)
  }
  return map
}

const chipsByArrId = computed(() => {
  const out = new Map()
  for (const arr of props.arrays || []) {
    if (arr.dims === 2) continue
    out.set(arr.id, buildChipsByCell(arr))
  }
  return out
})

const layoutsByArrId = computed(() => {
  const out = new Map()
  for (const [arrId, chipsByCell] of chipsByArrId.value.entries()) {
    out.set(arrId, computeChipLayout({ chipsByCell, showLimit: SHOW_LIMIT }))
  }
  return out
})

function layoutFor(arrId) {
  return layoutsByArrId.value.get(arrId) || FALLBACK_LAYOUT
}

function chipsFor(arrId) {
  return chipsByArrId.value.get(arrId) || new Map()
}

function labelsAt(arr, index) {
  return (chipsFor(arr.id).get(index) || []).map((c) => c.name)
}

function roleAt(arr, index) {
  return primaryRoleFromLabels(labelsAt(arr, index))
}

function isPointerHighlighted(arr, index) {
  return chipsFor(arr.id).has(index)
}

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

/**
 * chip 条目（含 +N / else 汇总 chip）。
 * selection 是「整个数组级」的：popover 一次覆盖该数组的全部 chip；
 * 有选择时，每个溢出格只显示落在该格上的被选中 chip（截到 SHOW_LIMIT）+ else。
 */
function buildEntries(arrId) {
  const layout = layoutFor(arrId)
  const chipsByCell = chipsFor(arrId)
  const sel = overflowSelections.value.get(arrId)
  const entries = []
  const seen = new Set()

  for (const [index, chips] of chipsByCell.entries()) {
    const overflow = layout.overflowByCell.get(index)

    let visible
    let summaryLabel
    if (overflow && sel && sel.size > 0) {
      visible = chips.filter((c) => sel.has(c.name)).slice(0, SHOW_LIMIT)
      summaryLabel = 'else'
    } else if (overflow) {
      visible = overflow.visibleChips
      summaryLabel = `+${overflow.hiddenCount}`
    } else {
      visible = chips
      summaryLabel = null
    }

    const leftBase = index * layout.cellWidth + layout.cellWidth / 2

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

    if (summaryLabel !== null) {
      entries.push({
        key: `${index}:${summaryLabel}`,
        index,
        label: summaryLabel,
        left: leftBase,
        color: ELSE_COLOR,
        chipStyle: chipStyleFor(null, ELSE_COLOR),
        isSummary: true,
      })
    }
  }

  return withVerticalPlacement(entries)
}

const entriesByArrId = computed(() => {
  const out = new Map()
  for (const arrId of chipsByArrId.value.keys()) out.set(arrId, buildEntries(arrId))
  return out
})

function aboveEntriesFor(arrId) {
  return (entriesByArrId.value.get(arrId) || []).filter((e) => e.placement === 'above')
}

function belowEntriesFor(arrId) {
  return (entriesByArrId.value.get(arrId) || []).filter((e) => e.placement === 'below')
}

// popover helpers —— v1 以「数组」为单位：列出该数组所有格子的 chip（按名字去重）
function overflowChipsForArr(arrId) {
  const out = []
  const seen = new Set()
  for (const chips of chipsFor(arrId).values()) {
    for (const chip of chips) {
      if (seen.has(chip.name)) continue
      seen.add(chip.name)
      out.push(chip)
    }
  }
  return out
}

function onChipClick(arrId, entry) {
  if (!entry.isSummary) return
  popoverOpenFor.value = popoverOpenFor.value === arrId ? null : arrId
}

function onSelectionChange(arrId, newSet) {
  const next = new Map(overflowSelections.value)
  next.set(arrId, newSet)
  overflowSelections.value = next
}

function popoverAnchorFor(arrId) {
  const el = wrapEls.get(arrId)
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return { cellLeft: 0, cellWidth: 0, containerTop: 0 }
  }
  // 简单起见：用 wrap 整宽作为 anchor；后续可细化到具体 cell
  const rect = el.getBoundingClientRect()
  return {
    cellLeft: rect.left,
    cellWidth: rect.width,
    containerTop: rect.top,
  }
}
</script>

<style scoped>
.array-canvas { padding: 8px; }
.ac-empty { color: var(--text-muted); font-family: var(--mono); font-size: 12px; padding: 12px; }
.ac-group { margin-bottom: 14px; }
.ac-group-header {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 6px;
  font-family: var(--mono);
  font-size: 11px;
}
.ac-var {
  color: var(--text-h);
  font-weight: 700;
  letter-spacing: 0.02em;
}
.ac-type {
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0.04em;
}
.ac-dims {
  font-size: 10px;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  padding: 1px 6px;
  letter-spacing: 0.04em;
}
.ac-strip-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  padding-top: 28px;
  padding-bottom: 28px;
}
.ac-pointers {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  pointer-events: none;
}
.ac-pointers-above { top: 0; }
.ac-pointers-below { bottom: 0; }
.ac-pointer {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ac-pointer-below {
  top: auto;
  bottom: 0;
}
.ac-pointer-text {
  font-family: var(--mono);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.ac-pointer-summary {
  pointer-events: auto;
  cursor: pointer;
}
.ac-pointer-summary:hover { filter: brightness(0.92); }
.ac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.ac-pointer-below .ac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.ac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: 2px;
}
.ac-strip :deep(.ds-array-cell) {
  position: relative;
  z-index: 1;
}
</style>
