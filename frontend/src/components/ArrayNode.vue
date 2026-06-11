<template>
  <div class="an-node" :style="{ minWidth: (data.width || 200) + 'px' }">
    <div class="an-head">
      <span class="an-type">{{ data.objType }}</span>
      <span class="an-name">{{ data.objName }}</span>
    </div>
    <div class="an-cells">
      <div v-for="slot in data.slots" :key="'s'+slot.index" class="an-cell">
        <span class="an-idx">[{{ slot.index }}]</span>
        <span class="an-val">{{ slot.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ data: { type: Object, required: true } })
</script>

<style scoped>
.an-node {
  background: #2a2a32; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 10px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px; color: #c8c8d0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3); box-sizing: border-box;
}
.an-head { margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; gap: 6px; align-items: center; }
.an-type { font-size: 13px; color: #60a5fa; font-weight: 600; }
.an-name { font-size: 12px; color: #787880; }
.an-cells { display: flex; flex-wrap: wrap; gap: 4px; }
.an-cell {
  display: flex; align-items: center; gap: 3px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 5px; padding: 4px 8px;
}
.an-idx { color: #787880; font-size: 11px; }
.an-val { color: #e0e0e8; font-weight: 500; }
</style>
