<template>
  <div class="hg-node" :style="{ width: (data.width || 400) + 'px', height: (data.height || 200) + 'px' }">
    <div class="hg-label">堆 HEAP</div>
  </div>
</template>
<script setup>
defineProps({ data: { type: Object, required: true } })
</script>
<style scoped>
.hg-node {
  background: rgba(255,255,255,0.025);
  border: 2px dashed rgba(255,255,255,0.13);
  border-radius: 14px;
  position: relative;
  pointer-events: none;
}
.hg-label {
  position: absolute; top: 10px; left: 16px;
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.22);
  letter-spacing: 0.08em;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
