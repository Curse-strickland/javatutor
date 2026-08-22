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
              @click="onChipClick(entry, arr.id)"
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
              @click="onChipClick(entry, arr.id)"
            >{{ entry.label }}</span>
          </div>
        </div>

        <ChipOverflowPopover
          v-if="popoverOpenFor === popoverKey(arr.id, popoverCellIndex)"
          :chips="sortChipsForPopover(overflowChipsForCell(arr.id, popoverCellIndex))"
          :selection="overflowSelections.get(popoverKey(arr.id, popoverCellIndex)) || new Set()"
          :anchor="popoverAnchorFor(arr.id)"
          :open="true"
          @update:selection="(s) => onSelectionChange(popoverKey(arr.id, popoverCellIndex), s)"
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
import { buildArrayChipsByCell, sortChipsForPopover } from '../utils/arrayChips.js'

const ELSE_COLOR = POINTER_ROLE_COLORS.neutral

const props = defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})

const wrapEls = ref(new Map())
const popoverOpenFor = ref(null)
const overflowSelections = ref(new Map())

function onScroll() {
  popoverOpenFor.value = null
}
onMounted(() => window.addEventListener('scroll', onScroll, true))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll, true))

watch(() => props.arrays, () => {
  popoverOpenFor.value = null
  overflowSelections.value = new Map()
}, { deep: true })

function bindWrapEl(arrId, el) {
  if (el) wrapEls.value.set(arrId, el)
  else wrapEls.value.delete(arrId)
}

function chipsByCellFor(arr) {
  return buildArrayChipsByCell(arr)
}

const layoutsByArrId = computed(() => {
  const out = {}
  for (const arr of props.arrays) {
    if (arr.dims === 2) continue
    out[arr.id] = computeChipLayout({ chipsByCell: chipsByCellFor(arr) })
  }
  return out
})

function layoutFor(arrId) {
  return layoutsByArrId.value[arrId] || { cellWidth: 48, chipFontSize: 11, overflowByCell: new Map() }
}

function labelsAt(arr, index) {
  const chips = chipsByCellFor(arr).get(index) || []
  return chips.map((c) => c.name)
}
function roleAt(arr, index) {
  const chips = chipsByCellFor(arr).get(index) || []
  return primaryRoleFromLabels(chips.map((c) => c.name))
}
function isPointerHighlighted(arr, index) {
  return chipsByCellFor(arr).has(index)
}

function pointerEntriesFor(arr) {
  const arrId = arr.id
  const layout = layoutFor(arrId)
  const chipsByCell = chipsByCellFor(arr)
  const entries = []
  const seen = new Set()
  const len = arr.values?.length || 0

  for (const [index, chips] of chipsByCell.entries()) {
    if (index < 0 || index >= len) continue
    const overflow = layout.overflowByCell.get(index)
    const leftBase = index * layout.cellWidth + layout.cellWidth / 2
    const cellKey = popoverKey(arrId, index)
    const sel = overflowSelections.value.get(cellKey) || new Set()

    let visible
    let summaryLabel
    if (overflow && sel.size > 0) {
      visible = chips.filter((c) => sel.has(c.name)).slice(0, 2)
      summaryLabel = 'else'
    } else if (overflow) {
      visible = overflow.visibleChips
      summaryLabel = `+${overflow.hiddenCount}`
    } else {
      visible = chips
      summaryLabel = null
    }

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
        chipStyle: roleStyle(chip.role) || {
          color: chip.color,
          borderColor: `${chip.color}66`,
          background: `${chip.color}22`,
          fill: chip.color,
        },
        isSummary: false,
      })
    }

    if (summaryLabel !== null) {
      const summaryKey = summaryLabel === 'else'
        ? `${index}:else`
        : `${index}:+${overflow.hiddenCount}`
      entries.push({
        key: summaryKey,
        index,
        label: summaryLabel,
        left: leftBase,
        color: ELSE_COLOR,
        chipStyle: {
          color: ELSE_COLOR,
          borderColor: `${ELSE_COLOR}66`,
          background: `${ELSE_COLOR}22`,
          fill: ELSE_COLOR,
        },
        isSummary: true,
      })
    }
  }

  return withVerticalPlacement(entries)
}

function aboveEntriesFor(arrId) {
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!arr) return []
  return pointerEntriesFor(arr).filter((e) => e.placement === 'above')
}
function belowEntriesFor(arrId) {
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!arr) return []
  return pointerEntriesFor(arr).filter((e) => e.placement === 'below')
}

const popoverCellIndex = computed(() => {
  if (!popoverOpenFor.value) return null
  const idx = popoverOpenFor.value.lastIndexOf(':')
  if (idx === -1) return null
  return Number(popoverOpenFor.value.slice(idx + 1))
})

function popoverKey(arrId, cellIndex) {
  return `${arrId}:${cellIndex}`
}

function overflowChipsForCell(arrId, cellIndex) {
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!arr || cellIndex == null) return []
  return chipsByCellFor(arr).get(cellIndex) || []
}

function onChipClick(entry, arrId) {
  if (!entry.isSummary) return
  popoverOpenFor.value = popoverKey(arrId, entry.index)
}

function onSelectionChange(key, newSet) {
  const next = new Map(overflowSelections.value)
  next.set(key, newSet)
  overflowSelections.value = next
}

function popoverAnchorFor(arrId) {
  const el = wrapEls.value.get(arrId)
  const arr = props.arrays.find((a) => a.id === arrId)
  if (!el || !arr) return { cellLeft: 0, cellWidth: 0, containerTop: 0 }
  // 简单起见：用 wrap 中点作为 popover anchor；后续可细化到具体 cell
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
.ac-group-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; font-family: var(--mono); font-size: 11px; }
.ac-var { color: var(--text-h); font-weight: 700; letter-spacing: 0.02em; }
.ac-type { color: var(--text-muted); font-weight: 500; letter-spacing: 0.04em; }
.ac-dims { font-size: 10px; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); padding: 1px 6px; letter-spacing: 0.04em; }
.ac-strip-wrap { position: relative; display: inline-block; max-width: 100%; overflow-x: auto; padding-top: 28px; padding-bottom: 28px; }
.ac-pointers { position: absolute; left: 0; right: 0; height: 28px; pointer-events: none; }
.ac-pointers-above { top: 0; }
.ac-pointers-below { bottom: 0; }
.ac-pointer { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.ac-pointer-below { top: auto; bottom: 0; }
.ac-pointer-text { font-family: var(--mono); font-weight: 600; padding: 1px 6px; border-radius: 3px; border: 1px solid transparent; white-space: nowrap; }
.ac-pointer-summary { pointer-events: auto; cursor: pointer; }
.ac-pointer-summary:hover { filter: brightness(0.92); }
.ac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.ac-pointer-below .ac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.ac-strip { position: relative; display: grid; grid-auto-rows: auto; gap: 2px; }
</style>
