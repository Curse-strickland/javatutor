<template>
  <ArrayCell
    class="array-node"
    :value="value"
    :index="index"
    :is-first="isFirst"
    :is-last="isLast"
    :is-highlighted="isHighlighted"
    :pointer-labels="pointerLabels"
    :role="role"
    :is-pivot="isPivot"
  />
</template>

<script setup>
import ArrayCell from './ArrayCell.vue'

defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
  pointerLabels: { type: Array, default: () => [] },
  role: { type: String, default: null },
  isPivot: { type: Boolean, default: false },
})
</script>

<style scoped>
.array-node {
  width: 48px;
  min-width: 48px;
  flex-shrink: 0;
}
</style>
