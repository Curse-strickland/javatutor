<template>
  <div class="array-canvas">
    <div v-if="!arrays.length" class="ac-empty">未识别到数组类结构</div>
    <div v-for="arr in arrays" :key="arr.id" class="ac-group">
      <div class="ac-group-header">
        <span class="ac-var">{{ arr.sourceVar || arr.id || 'array' }}</span>
        <span v-if="arr.label" class="ac-type">{{ arr.label }}</span>
        <span v-if="arr.dims === 2" class="ac-dims">二维表</span>
        <button
          v-if="arr.dims !== 2 && distinctVarsFor(arr).length"
          type="button"
          class="ac-var-toggle"
          @click="openVarSelector(arr.id, $event)"
        >展示的变量</button>
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
            <span class="ac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
            </svg>
          </div>
        </div>
        <div class="ac-strip" :style="{ gridTemplateColumns: layoutFor(arr.id).gridTemplate }">
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
            <span class="ac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <VarVisibilityPopover
      v-if="varSelectorArr"
      :vars="distinctVarsFor(varSelectorArr)"
      :hidden="hiddenFor(varSelectorArr.id)"
      :anchor="varSelectorAnchor"
      :open="true"
      @update:hidden="(s) => onHiddenChange(varSelectorArr.id, s)"
      @close="varSelectorOpenFor = null"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import ArrayCell from './ArrayCell.vue'
import MatrixCanvas from './MatrixCanvas.vue'
import VarVisibilityPopover from './VarVisibilityPopover.vue'
import { computeChipLayout } from '../utils/chipOverlayLayout.js'
import { primaryRoleFromLabels, roleStyle } from '../utils/pointerRoleColors.js'
import { withCellPlacement } from '../utils/pointerPlacement.js'
import { buildArrayChipsByCell } from '../utils/arrayChips.js'
import { columnLefts } from '../utils/rangeRect.js'

const props = defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})

const wrapEls = ref(new Map())
const varSelectorOpenFor = ref(null)
const varSelectorAnchor = ref({ left: 0, top: 0 })
const hiddenVarsByArrId = ref(new Map())

function onScroll() {
  varSelectorOpenFor.value = null
}
onMounted(() => window.addEventListener('scroll', onScroll, true))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll, true))

watch(() => props.arrays, () => {
  varSelectorOpenFor.value = null
  hiddenVarsByArrId.value = new Map()
}, { deep: true })

function bindWrapEl(arrId, el) {
  if (el) wrapEls.value.set(arrId, el)
  else wrapEls.value.delete(arrId)
}

function chipsByCellFor(arr) {
  return buildArrayChipsByCell(arr)
}

function hiddenFor(arrId) {
  return hiddenVarsByArrId.value.get(arrId) || new Set()
}

function visibleChipsByCellFor(arr) {
  const map = chipsByCellFor(arr)
  const hidden = hiddenFor(arr.id)
  if (hidden.size === 0) return map
  const out = new Map()
  for (const [idx, chips] of map.entries()) {
    const kept = chips.filter((c) => !hidden.has(c.name))
    if (kept.length) out.set(idx, kept)
  }
  return out
}

function distinctVarsFor(arr) {
  const seen = new Set()
  const vars = []
  for (const chips of chipsByCellFor(arr).values()) {
    for (const c of chips) {
      if (seen.has(c.name)) continue
      seen.add(c.name)
      vars.push({ name: c.name, color: c.color })
    }
  }
  return vars
}

function openVarSelector(arrId, event) {
  varSelectorOpenFor.value = arrId
  const rect = event?.currentTarget?.getBoundingClientRect()
  varSelectorAnchor.value = rect
    ? { left: rect.left, top: rect.bottom + 4 }
    : { left: 0, top: 0 }
}

function onHiddenChange(arrId, set) {
  const next = new Map(hiddenVarsByArrId.value)
  next.set(arrId, set)
  hiddenVarsByArrId.value = next
}

const varSelectorArr = computed(() => {
  if (!varSelectorOpenFor.value) return null
  return props.arrays.find((a) => a.id === varSelectorOpenFor.value) || null
})

const layoutsByArrId = computed(() => {
  const out = {}
  for (const arr of props.arrays) {
    if (arr.dims === 2) continue
    out[arr.id] = computeChipLayout({
      chipsByCell: visibleChipsByCellFor(arr),
      length: arr.values?.length || 0,
    })
  }
  return out
})

function layoutFor(arrId) {
  return layoutsByArrId.value[arrId] || { chipFontSize: 11, cellWidths: [], gridTemplate: '' }
}

function labelsAt(arr, index) {
  const chips = visibleChipsByCellFor(arr).get(index) || []
  return chips.map((c) => c.name)
}
function roleAt(arr, index) {
  const chips = visibleChipsByCellFor(arr).get(index) || []
  return primaryRoleFromLabels(chips.map((c) => c.name))
}
function isPointerHighlighted(arr, index) {
  return visibleChipsByCellFor(arr).has(index)
}

let _gap = null
function stripGapValue() {
  if (_gap == null) {
    _gap = 2
    if (typeof document !== 'undefined') {
      const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-strip-gap'))
      if (!Number.isNaN(g)) _gap = g
    }
  }
  return _gap
}

function pointerEntriesFor(arr) {
  const layout = layoutFor(arr.id)
  const chipsByCell = visibleChipsByCellFor(arr)
  const lefts = columnLefts(layout.cellWidths, stripGapValue())
  const entries = []

  for (const [index, chips] of chipsByCell.entries()) {
    if (index < 0 || index >= lefts.length) continue
    const left = lefts[index] + layout.cellWidths[index] / 2
    for (const chip of chips) {
      entries.push({
        key: `${index}:${chip.name}`,
        index,
        label: chip.name,
        left,
        color: chip.color,
        chipStyle: roleStyle(chip.role) || {
          color: chip.color,
          borderColor: `${chip.color}66`,
          background: 'var(--card-bg)',
          fill: chip.color,
        },
      })
    }
  }

  return withCellPlacement(entries)
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
</script>

<style scoped>
.array-canvas { padding: 8px; }
.ac-empty { color: var(--text-muted); font-family: var(--mono); font-size: 12px; padding: 12px; }
.ac-group { margin-bottom: 14px; }
.ac-group-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; font-family: var(--mono); font-size: 11px; }
.ac-var { color: var(--text-h); font-weight: 700; letter-spacing: 0.02em; }
.ac-type { color: var(--text-muted); font-weight: 500; letter-spacing: 0.04em; }
.ac-dims { font-size: 10px; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); padding: 1px 6px; letter-spacing: 0.04em; }
.ac-var-toggle {
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
.ac-var-toggle:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.ac-strip-wrap { position: relative; display: inline-block; max-width: 100%; overflow-x: auto; padding-top: 28px; padding-bottom: 28px; }
.ac-pointers { position: absolute; left: 0; right: 0; height: 28px; pointer-events: none; }
.ac-pointers-above { top: 0; }
.ac-pointers-below { bottom: 0; }
.ac-pointer { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.ac-pointer-below { top: auto; bottom: 0; }
.ac-pointer-text { font-family: var(--mono); font-weight: 600; padding: 1px 6px; border-radius: 3px; border: 1px solid transparent; white-space: nowrap; }
.ac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.ac-pointer-below .ac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.ac-strip { position: relative; display: grid; grid-auto-rows: auto; gap: var(--ds-strip-gap, 2px); }
</style>
