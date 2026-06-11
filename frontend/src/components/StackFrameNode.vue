<template>
  <div class="sf-node" :style="{ minWidth: (data.width || 220) + 'px' }">
    <div class="sf-title">{{ data.method }}(..)</div>
    <div class="sf-vars">
      <div v-for="(item, i) in data.items" :key="item.name"
        class="sf-item" :class="{ 'sf-ref': item.isRef }">
        <span class="sf-name">{{ item.name }}</span>
        <span class="sf-eq">=</span>
        <template v-if="item.isRef">
          <span class="sf-dot" />
          <Handle
            :id="item.name"
            type="source"
            :position="Position.Right"
            :style="{ top: (60 + i * 30) + 'px', transform: 'translate(50%, -50%)' }"
            class="sf-handle"
          />
        </template>
        <span v-else class="sf-val">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'
defineProps({ data: { type: Object, required: true } })
</script>

<style scoped>
.sf-node {
  background: #2a2a32; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 12px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px; color: #c8c8d0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3); box-sizing: border-box;
  position: relative;
}
.sf-title {
  font-weight: 600; font-size: 14px; color: #60a5fa;
  margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.sf-vars { display: flex; flex-direction: column; gap: 2px; }
.sf-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: 6px;
  position: relative; height: 28px; box-sizing: border-box;
}
.sf-ref { background: rgba(10,132,255,0.08); }
.sf-name { color: #e0e0e8; font-weight: 500; min-width: 32px; }
.sf-eq { color: #787880; font-size: 12px; }
.sf-val { color: #b0b0b8; }
.sf-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #0a84ff;
  opacity: 0.85; margin-left: auto; flex-shrink: 0;
  box-shadow: 0 0 6px rgba(10,132,255,0.35);
}
.sf-handle {
  width: 8px !important; height: 8px !important;
  background: #0a84ff !important; border: 2px solid #2a2a32 !important;
  border-radius: 50% !important; right: -4px !important; z-index: 5;
}
</style>
