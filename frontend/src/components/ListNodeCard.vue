<template>
  <div class="ln-node">
    <Handle :id="'in-' + data.heapKey" type="target" :position="Position.Left" :style="{ top: '50%' }" class="ln-handle ln-h-in" />
    <div class="ln-head"><span class="ln-type">{{ data.objType }}</span></div>
    <div class="ln-cells">
      <div class="ln-cell"><span class="ln-idx">val</span><span class="ln-val">{{ data.val }}</span></div>
      <div class="ln-cell" :class="{ 'ln-ref': data.hasRef }">
        <span class="ln-idx">next</span>
        <template v-if="data.hasRef">
          <span class="ln-dot" />
          <Handle :id="'f-' + data.heapKey + '-next'" type="source" :position="Position.Right" :style="{ top: 'calc(50% + 15px)' }" class="ln-handle ln-h-out" />
        </template>
        <span v-else class="ln-null">null</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'
defineProps({ data: { type: Object, required: true } })
</script>

<style scoped>
.ln-node {
  background: #2a2a32; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 10px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px; color: #c8c8d0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3); box-sizing: border-box;
  position: relative; width: 130px;
}
.ln-head { margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.ln-type { font-size: 13px; color: #60a5fa; font-weight: 600; }
.ln-cells { display: flex; flex-direction: column; gap: 4px; }
.ln-cell {
  display: flex; align-items: center; gap: 4px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 5px; padding: 4px 8px; position: relative; height: 28px; box-sizing: border-box;
}
.ln-ref { padding-right: 16px; }
.ln-idx { color: #787880; font-size: 12px; font-weight: 500; }
.ln-val { color: #e0e0e8; }
.ln-null { color: #666; font-style: italic; }
.ln-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #0a84ff;
  opacity: 0.85; box-shadow: 0 0 6px rgba(10,132,255,0.35); margin-left: auto; flex-shrink: 0;
}
.ln-handle {
  width: 8px !important; height: 8px !important;
  background: #0a84ff !important; border: 2px solid #2a2a32 !important;
  border-radius: 50% !important; z-index: 5;
}
.ln-h-in { left: -4px !important; }
.ln-h-out { right: -4px !important; }
</style>
