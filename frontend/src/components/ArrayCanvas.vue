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

      <div v-else class="ac-strip-wrap">
        <div class="ac-pointers ac-pointers-above">
          <div
            v-for="entry in aboveEntries(arr)"
            :key="entry.key"
            class="ac-pointer"
            :style="{ left: entry.left + 'px' }"
          >
            <span class="ac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M0 0 L10 0 L5 6 Z" :fill="entry.color" />
            </svg>
          </div>
        </div>
        <div class="ac-strip">
          <ArrayNode
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
            v-for="entry in belowEntries(arr)"
            :key="entry.key"
            class="ac-pointer ac-pointer-below"
            :style="{ left: entry.left + 'px' }"
          >
            <svg class="ac-pointer-triangle" width="10" height="6" viewBox="0 0 10 6">
              <path d="M5 0 L10 6 L0 6 Z" :fill="entry.color" />
            </svg>
            <span class="ac-pointer-text" :style="entry.chipStyle">{{ entry.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import ArrayNode from './ArrayNode.vue'
import MatrixCanvas from './MatrixCanvas.vue'
import {
  colorForPointerName,
  colorForRole,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
} from '../utils/pointerRoleColors.js'
import { withVerticalPlacement } from '../utils/pointerPlacement.js'

defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})

const CELL_MIN_WIDTH = 48
const FALLBACK_COLOR = colorForRole('mid')

function labelsAt(arr, index) {
  const fromRecord = arr.pointerLabels?.[index]
  if (fromRecord?.length) return fromRecord
  const fromPointers = []
  const pointers = arr.indexPointers || {}
  for (const [name, idx] of Object.entries(pointers)) {
    if (idx === index) fromPointers.push(name)
  }
  return fromPointers
}

function roleAt(arr, index) {
  return primaryRoleFromLabels(labelsAt(arr, index))
}

function isPointerHighlighted(arr, index) {
  const pointers = arr.indexPointers || {}
  return Object.values(pointers).includes(index)
}

function pointerEntriesFor(arr) {
  const entries = []
  const seen = new Set()
  const valuesLen = arr.values?.length || 0

  const addEntry = (index, label) => {
    if (index == null || index < 0 || index >= valuesLen) return
    const key = `${index}:${label}`
    if (seen.has(key)) return
    seen.add(key)
    const role = inferPointerRole(label)
    const color = colorForPointerName(label) || FALLBACK_COLOR
    entries.push({
      key,
      index,
      label,
      left: index * CELL_MIN_WIDTH + CELL_MIN_WIDTH / 2,
      color,
      chipStyle: roleStyle(role),
    })
  }

  const pointers = arr.indexPointers || {}
  for (const [name, idx] of Object.entries(pointers)) {
    addEntry(idx, name)
  }

  const record = arr.pointerLabels || {}
  for (const [idxStr, labels] of Object.entries(record)) {
    const index = Number(idxStr)
    for (const label of labels || []) {
      addEntry(index, label)
    }
  }

  return withVerticalPlacement(entries)
}

function aboveEntries(arr) {
  return pointerEntriesFor(arr).filter((e) => e.placement === 'above')
}

function belowEntries(arr) {
  return pointerEntriesFor(arr).filter((e) => e.placement === 'below')
}
</script>

<style scoped>
.array-canvas { padding: 8px; }
.ac-empty { color: var(--text-muted); font-family: var(--mono); font-size: 12px; padding: 12px; }
.ac-group { margin-bottom: 14px; }
.ac-group-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; font-family: var(--mono); font-size: 11px; }
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
  flex-direction: column;
}
.ac-pointer-text {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.ac-pointer-triangle { flex-shrink: 0; margin-top: -1px; }
.ac-pointer-below .ac-pointer-triangle { margin-top: 0; margin-bottom: -1px; }
.ac-strip {
  display: flex;
  flex-wrap: nowrap;
  border: 1px solid var(--border);
  background: var(--card-bg);
}
</style>
