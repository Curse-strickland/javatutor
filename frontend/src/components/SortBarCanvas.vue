<template>
  <div class="sort-bar-canvas">
    <div class="sbc-header">
      <span class="sbc-label">{{ label }}</span>
    </div>
    <div class="sbc-chart">
      <div
        v-for="(v, i) in values"
        :key="i"
        class="sbc-col"
        :class="colClass(i)"
      >
        <div class="sbc-bar-wrap">
          <div
            class="sbc-bar"
            :style="barStyle(i, v)"
          />
        </div>
        <div class="sbc-idx" :style="idxStyle(i)">{{ i }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  colorForRole,
  primaryRoleFromLabels,
} from '../utils/pointerRoleColors.js'

const props = defineProps({
  values: { type: Array, required: true },
  activeIndex: { type: Number, default: null },
  pointers: { type: Object, default: () => ({}) },
  label: { type: String, default: '插入排序' },
})

const maxVal = computed(() => {
  const nums = props.values.filter((v) => typeof v === 'number')
  return nums.length ? Math.max(...nums, 1) : 1
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

function colClass(i) {
  const role = roleAt(i)
  return {
    active: i === props.activeIndex || !!role,
    [`role-${role}`]: !!role,
  }
}

function barHeight(v) {
  if (typeof v !== 'number') return 8
  return Math.max(8, (v / maxVal.value) * 100)
}

function barStyle(i, v) {
  const role = roleAt(i)
  const color = colorForRole(role)
  const base = { height: `${barHeight(v)}%` }
  if (!color) return base
  return {
    ...base,
    background: color,
    borderColor: color,
  }
}

function idxStyle(i) {
  const role = roleAt(i)
  const color = colorForRole(role)
  if (!color) return {}
  return { color, fontWeight: 700 }
}
</script>

<style scoped>
.sort-bar-canvas { padding: 4px 0; }
.sbc-header { margin-bottom: 8px; }
.sbc-label {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.sbc-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  min-height: 120px;
  padding: 8px 4px 0;
  border: 1px solid var(--border);
  background: var(--card-bg);
  overflow-x: auto;
}
.sbc-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 28px;
  flex: 1;
  max-width: 48px;
}
.sbc-bar-wrap {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100px;
}
.sbc-bar {
  width: 70%;
  min-height: 4px;
  background: color-mix(in srgb, var(--accent) 55%, var(--card-bg));
  border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  transition: height 0.15s, background 0.15s, border-color 0.15s;
}
.sbc-idx {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  padding: 4px 0 2px;
  text-align: center;
}
</style>
