<template>
  <div class="matrix-canvas">
    <div class="mx-meta">
      <span>{{ rows }} × {{ cols }}</span>
      <span v-if="focusCell" class="mx-hl-hint">
        cur → [{{ focusCell.r }}, {{ focusCell.c }}]
      </span>
    </div>
    <div class="mx-scroll">
      <table class="mx-table">
        <thead>
          <tr>
            <th class="mx-corner"></th>
            <th v-for="c in cols" :key="'c' + c" class="mx-col-h">{{ c - 1 }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in matrix" :key="'r' + ri">
            <th class="mx-row-h">{{ ri }}</th>
            <td
              v-for="(cell, ci) in padRow(row)"
              :key="'c' + ci"
              class="mx-cell"
              :class="{ active: isFocus(ri, ci) }"
              :style="cellStyle(ri, ci)"
            >
              <!-- Labels outside the cell, like 1D array pointer chips -->
              <div v-if="splitAt(ri, ci).above.length" class="mx-cell-labels mx-labels-above">
                <div
                  v-for="lab in splitAt(ri, ci).above"
                  :key="'a' + lab"
                  class="mx-pointer"
                >
                  <span class="mx-chip" :style="chipStyle(lab)">{{ lab }}</span>
                  <svg class="mx-tri" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
                    <path d="M0 0 L10 0 L5 6 Z" :fill="chipColor(lab)" />
                  </svg>
                </div>
              </div>
              <span class="mx-cell-val">{{ formatCell(cell) }}</span>
              <div v-if="splitAt(ri, ci).below.length" class="mx-cell-labels mx-labels-below">
                <div
                  v-for="lab in splitAt(ri, ci).below"
                  :key="'b' + lab"
                  class="mx-pointer mx-pointer-below"
                >
                  <svg class="mx-tri" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
                    <path d="M5 0 L10 6 L0 6 Z" :fill="chipColor(lab)" />
                  </svg>
                  <span class="mx-chip" :style="chipStyle(lab)">{{ lab }}</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  colorForRole,
  colorForPointerName,
  inferPointerRole,
  primaryRoleFromLabels,
  roleStyle,
} from '../utils/pointerRoleColors.js'
import { splitLabelsAboveBelow } from '../utils/pointerPlacement.js'

const props = defineProps({
  matrix: { type: Array, required: true },
  rows: { type: Number, required: true },
  cols: { type: Number, required: true },
  /** e.g. { i: 1, j: 2 } from stack */
  indexPointers: { type: Object, default: () => ({}) },
  /** cell key "r,c" → label chips, e.g. { "1,2": ["cur","i","j"] } */
  pointerLabels: { type: Object, default: () => ({}) },
})

const focusCell = computed(() => {
  const p = props.indexPointers || {}
  const r = p.i ?? p.row ?? p.r
  const c = p.j ?? p.col ?? p.c
  if (typeof r === 'number' && typeof c === 'number') return { r, c }
  const keys = Object.keys(props.pointerLabels || {})
  if (keys.length === 1) {
    const [rr, cc] = keys[0].split(',').map(Number)
    if (Number.isInteger(rr) && Number.isInteger(cc)) return { r: rr, c: cc }
  }
  return null
})

function padRow(row) {
  const out = Array.isArray(row) ? [...row] : []
  while (out.length < props.cols) out.push(null)
  return out.slice(0, props.cols)
}

function formatCell(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function labelsAt(ri, ci) {
  const key = `${ri},${ci}`
  const fromMap = props.pointerLabels?.[key]
  if (fromMap?.length) return fromMap
  const h = focusCell.value
  if (h && h.r === ri && h.c === ci) return ['cur']
  return []
}

function splitAt(ri, ci) {
  return splitLabelsAboveBelow(labelsAt(ri, ci))
}

function isFocus(ri, ci) {
  return labelsAt(ri, ci).length > 0
}

function cellStyle(ri, ci) {
  const labels = labelsAt(ri, ci)
  if (!labels.length) return {}
  const role = primaryRoleFromLabels(labels) || 'mid'
  const color = colorForRole(role) || colorForRole('mid')
  return {
    background: `${color}26`,
    borderColor: color,
    boxShadow: `inset 0 0 0 1px ${color}`,
  }
}

function chipColor(lab) {
  return colorForPointerName(lab) || colorForRole('mid')
}

function chipStyle(lab) {
  return roleStyle(inferPointerRole(lab) || 'mid')
}
</script>

<style scoped>
.matrix-canvas { padding: 4px 0; }
.mx-meta {
  display: flex;
  gap: 12px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 6px;
  letter-spacing: 0.06em;
}
.mx-hl-hint { color: #eab308; font-weight: 600; }
.mx-scroll {
  overflow-x: auto;
  max-width: 100%;
  /* room for external pointer chips above the first data row */
  padding-top: 28px;
  padding-bottom: 28px;
}
.mx-table {
  border-collapse: separate;
  border-spacing: 0;
  font-family: var(--mono);
  font-size: 13px;
  background: var(--card-bg);
  overflow: visible;
}
.mx-corner {
  width: 28px;
  border: none;
  background: transparent;
}
.mx-col-h,
.mx-row-h {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 4px 6px;
  text-align: center;
  background: color-mix(in srgb, #6b7280 8%, var(--card-bg));
  border: 1px solid var(--border);
}
.mx-cell {
  position: relative;
  min-width: 48px;
  min-height: 40px;
  padding: 8px 10px;
  text-align: center;
  border: 1px solid var(--border);
  color: var(--text-h);
  font-weight: 600;
  transition: background 0.15s, border-color 0.15s;
  vertical-align: middle;
  overflow: visible;
}
.mx-cell-labels {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  width: max-content;
  max-width: 120px;
  z-index: 2;
  pointer-events: none;
}
/* Sit fully above / below the cell — same idea as 1D ArrayCanvas */
.mx-labels-above {
  bottom: calc(100% + 2px);
  top: auto;
}
.mx-labels-below {
  top: calc(100% + 2px);
  bottom: auto;
}
.mx-pointer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.mx-pointer-below {
  flex-direction: column;
}
.mx-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid transparent;
  line-height: 1.3;
  white-space: nowrap;
}
.mx-tri {
  flex-shrink: 0;
  margin-top: -1px;
}
.mx-pointer-below .mx-tri {
  margin-top: 0;
  margin-bottom: -1px;
}
.mx-cell-val {
  display: inline-block;
  color: var(--text-h);
}
.mx-cell.active .mx-cell-val {
  color: inherit;
}
</style>
