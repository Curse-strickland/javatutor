<template>
  <div class="ho-node" :style="{ width: data.width + 'px' }">
    <Handle :id="'in-' + data.heapKey" type="target" :position="Position.Left" class="ho-handle ho-handle-in" />
    <div class="ho-head">
      <span class="ho-type">{{ data.objType }}</span>
      <span class="ho-name">{{ data.objName }}</span>
    </div>
    <div class="ho-cells">
      <template v-if="data.slots && data.slots.length">
        <div v-for="slot in data.slots" :key="'s'+slot.index" class="ho-cell">
          <span class="ho-idx">[{{ slot.index }}]</span>
          <span class="ho-val">{{ slot.value }}</span>
        </div>
      </template>
      <template v-else-if="data.fields && Object.keys(data.fields).length">
        <div v-for="(fv, fk) in data.fields" :key="'f'+fk" class="ho-cell"
          :class="{ 'ho-cell-ref': fv && fv.ref && data.fieldTargets && data.fieldTargets[fk] }">
          <span class="ho-idx">{{ fk }}</span>
          <template v-if="fv && fv.ref && data.fieldTargets && data.fieldTargets[fk]">
            <span class="ho-dot" />
            <Handle :id="'f-' + data.heapKey + '-' + fk" type="source" :position="Position.Right" class="ho-handle ho-handle-out" />
          </template>
          <span v-else class="ho-val">{{ formatVal(fv) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'
defineProps({ data: { type: Object, required: true } })
function formatVal(v) {
  if (v === undefined || v === null) return String(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.ho-node {
  background: #2a2a32;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  color: #c8c8d0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  box-sizing: border-box;
}
.ho-head {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 7px; padding-bottom: 5px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ho-type { font-size: 12px; color: #60a5fa; font-weight: 600; }
.ho-name { font-size: 12px; color: #787880; }
.ho-cells { display: flex; flex-wrap: wrap; gap: 4px; }
.ho-cell {
  display: flex; align-items: center; gap: 3px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 5px; padding: 4px 8px; position: relative;
}
.ho-cell-ref { padding-right: 16px; }
.ho-idx { color: #787880; font-size: 12px; font-weight: 500; }
.ho-val { color: #e0e0e8; }
.ho-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #0a84ff; opacity: 0.85;
  box-shadow: 0 0 6px rgba(10,132,255,0.35);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.ho-cell-ref:hover .ho-dot { box-shadow: 0 0 10px rgba(10,132,255,0.6); transform: scale(1.15); }
.ho-handle {
  width: 8px !important; height: 8px !important;
  background: #0a84ff !important; border: 2px solid #2a2a32 !important;
  border-radius: 50% !important; z-index: 5;
}
.ho-handle-in { left: -4px !important; }
.ho-handle-out { right: -4px !important; }
</style>
