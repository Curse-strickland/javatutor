<template>
  <div class="merge-tree-canvas">
    <div class="mtc-header">
      <span class="mtc-label">{{ label }}</span>
      <span class="mtc-phase" :class="'phase-' + phase">{{ phaseLabel }}</span>
      <span v-if="current" class="mtc-range">
        [{{ current.left }}, {{ current.right }}]
        <template v-if="current.mid != null"> · mid={{ current.mid }}</template>
      </span>
    </div>

    <div v-if="!levels.length" class="mtc-empty">
      等待进入 mergeSort（将按 PDF：向下分解 → 再向下合并）
    </div>

    <div v-else class="mtc-pdf">
      <template v-for="(level, li) in levels" :key="li">
        <div class="mtc-level" :class="'kind-' + level.kind">
          <div class="mtc-level-tag">{{ level.kind === 'merge' ? '合并' : '分解' }} · L{{ level.depth }}</div>
          <div class="mtc-row">
            <div
              v-for="(seg, si) in level.segments"
              :key="si"
              class="mtc-box"
              :class="{
                active: seg.active,
                'on-path': seg.onPath,
                dim: !seg.onPath,
                merging: seg.merging,
              }"
            >
              <div class="mtc-cells">
                <div
                  v-for="(v, ci) in seg.values"
                  :key="ci"
                  class="mtc-cell"
                  :class="{
                    ...cellPtrClass(seg, seg.indices[ci]),
                    empty: v == null || seg.filled?.[ci] === false,
                    consumed: seg.consumed?.[ci],
                  }"
                >
                  {{ v == null ? '·' : v }}
                </div>
              </div>
              <div class="mtc-indices">
                <span v-for="idx in seg.indices" :key="idx" class="mtc-idx">{{ idx }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="li < levels.length - 1"
          class="mtc-arrows"
          :class="{ 'arrows-merge': levels[li + 1].kind === 'merge' }"
          aria-hidden="true"
        >
          <svg class="mtc-arrow-svg" viewBox="0 0 100 24" preserveAspectRatio="none">
            <path
              v-if="levels[li + 1].kind === 'merge'"
              d="M25 2 L50 20 L75 2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <g v-else>
              <path d="M35 2 L25 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M65 2 L75 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M50 2 L50 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5" />
            </g>
          </svg>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  mergeDynamic: { type: Object, default: null },
  mergeLevels: { type: Array, default: null },
  label: { type: String, default: '归并排序' },
  values: { type: Array, default: () => [] },
})

const dyn = computed(() => props.mergeDynamic || null)
const levels = computed(() => dyn.value?.levels || [])
const current = computed(() => dyn.value?.current || null)
const phase = computed(() => dyn.value?.phase || 'enter')
const phaseLabel = computed(() => dyn.value?.phaseLabel || '归并')

function cellPtrClass(seg, absIndex) {
  if (!current.value) return {}
  // Merge result: highlight write cursor k
  if (seg.merging) {
    return { 'ptr-k': current.value.k === absIndex }
  }
  // Source halves during merge: i on left, j on right
  if (phase.value === 'merge') {
    return {
      'ptr-i': current.value.i === absIndex,
      'ptr-j': current.value.j === absIndex,
    }
  }
  return {}
}
</script>

<style scoped>
.merge-tree-canvas { padding: 4px 0; }
.mtc-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  font-family: var(--mono);
  font-size: 10px;
}
.mtc-label { color: var(--text-muted); letter-spacing: 0.06em; }
.mtc-phase {
  font-weight: 700;
  padding: 1px 6px;
  border: 1px solid var(--border);
}
.mtc-phase.phase-divide { color: #3b82f6; border-color: #3b82f680; background: #3b82f618; }
.mtc-phase.phase-merge { color: #eab308; border-color: #eab30880; background: #eab30818; }
.mtc-phase.phase-base,
.mtc-phase.phase-enter { color: #6b7280; border-color: #6b728080; }
.mtc-range { color: var(--text-muted); }

.mtc-pdf {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding: 10px 8px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  overflow-x: auto;
}
.mtc-level { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mtc-level-tag {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.mtc-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  width: 100%;
}
.mtc-box {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  padding: 3px;
  border: 1.5px dashed color-mix(in srgb, var(--border) 80%, #6b7280);
  background: color-mix(in srgb, var(--card-bg) 92%, #6b7280);
  transition: opacity 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.mtc-box.on-path {
  border-style: solid;
  border-color: #3b82f6;
  background: color-mix(in srgb, #3b82f6 6%, var(--card-bg));
}
.mtc-box.active {
  border-color: #eab308;
  box-shadow: 0 0 0 1px #eab30855;
  background: color-mix(in srgb, #eab308 10%, var(--card-bg));
}
.mtc-box.merging {
  border-color: #eab308;
  border-style: solid;
  background: color-mix(in srgb, #eab308 14%, var(--card-bg));
}
.mtc-box.dim { opacity: 0.38; }
.mtc-box.active.dim,
.mtc-box.on-path.dim { opacity: 1; }

.mtc-cells { display: flex; flex-wrap: nowrap; }
.mtc-cell {
  min-width: 28px;
  padding: 5px 7px;
  text-align: center;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-h);
  border: 1px solid var(--border);
  margin-left: -1px;
  background: var(--card-bg);
}
.mtc-cells .mtc-cell:first-child { margin-left: 0; }
.mtc-cell.empty {
  color: var(--text-muted);
  font-weight: 500;
  background: color-mix(in srgb, var(--card-bg) 85%, #6b7280);
}
.mtc-cell.consumed {
  opacity: 0.35;
  text-decoration: line-through;
  text-decoration-color: #6b728088;
}
.mtc-cell.ptr-i { box-shadow: inset 0 -3px 0 #6b7280; }
.mtc-cell.ptr-j { box-shadow: inset 0 -3px 0 #3b82f6; }
.mtc-cell.ptr-k {
  background: #eab30833;
  border-color: #eab308;
  box-shadow: inset 0 -3px 0 #eab308;
}

.mtc-indices {
  display: flex;
  flex-wrap: nowrap;
  margin-top: 2px;
}
.mtc-idx {
  min-width: 28px;
  text-align: center;
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-muted);
}

.mtc-arrows {
  display: flex;
  justify-content: center;
  height: 24px;
  color: #3b82f6;
  opacity: 0.75;
}
.mtc-arrows.arrows-merge { color: #eab308; }
.mtc-arrow-svg {
  width: min(220px, 60%);
  height: 24px;
}

.mtc-empty {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-muted);
  padding: 12px;
  border: 1px dashed var(--border);
}
</style>
