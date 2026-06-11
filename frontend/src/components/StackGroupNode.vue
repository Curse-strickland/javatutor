<template>
  <div class="sg-node" :style="{ width: (data.width || 300) + 'px', height: (data.height || 200) + 'px' }">
    <div class="sg-label">栈 STACK</div>
  </div>
</template>
<script setup>
defineProps({ data: { type: Object, required: true } })
</script>
<style scoped>
.sg-node {
  background: rgba(10,132,255,0.04);
  border: 2px dashed rgba(10,132,255,0.25);
  border-radius: 14px;
  position: relative;
  pointer-events: none;
}
.sg-label {
  position: absolute; top: 10px; left: 16px;
  font-size: 12px; font-weight: 700; color: rgba(10,132,255,0.45);
  letter-spacing: 0.08em;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
