<template>
  <div class="recursion-stack-canvas">
    <div v-if="stackFrames.length === 0" class="text-sm text-gray-500">调用栈为空</div>
    
    <div v-else class="stack-container">
      <div
        v-for="(frame, index) in stackFrames"
        :key="frame.id"
        class="stack-frame transition-all duration-500"
        :class="{
          'active-frame': index === activeFrameIndex,
          'returning-frame': returningFrameIndices.includes(index),
        }"
      >
        <div class="frame-header">
          <span class="frame-name">{{ frame.name }}</span>
          <span class="frame-index">#{{ index }}</span>
        </div>
        
        <div v-if="frame.variables && Object.keys(frame.variables).length > 0" class="frame-variables">
          <div v-for="(value, key) in frame.variables" :key="key" class="variable-item">
            <span class="var-key">{{ key }}:</span>
            <span class="var-value">{{ formatValue(value) }}</span>
          </div>
        </div>
        
        <div v-if="frame.returnValue !== undefined && frame.returnValue !== null" class="frame-return">
          <span class="return-label">返回:</span>
          <span class="return-value">{{ formatValue(frame.returnValue) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stackFrames: {
    type: Array,
    required: true,
    // 期望格式: [{ id, name, variables: {}, returnValue }]
  },
  activeFrameIndex: {
    type: Number,
    default: 0,
  },
  returningFrameIndices: {
    type: Array,
    default: () => [],
  },
})

const formatValue = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped>
.recursion-stack-canvas {
  @apply bg-gray-50 dark:bg-gray-900 rounded-lg p-4;
}

.stack-container {
  @apply flex flex-col gap-2;
}

.stack-frame {
  @apply bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-3 transition-all duration-300;
}

.stack-frame.active-frame {
  @apply border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md;
  transform: scale(1.02);
}

.stack-frame.returning-frame {
  @apply border-green-500 bg-green-50 dark:bg-green-900/20 opacity-70;
}

.frame-header {
  @apply flex justify-between items-center mb-2 pb-2 border-b border-gray-200 dark:border-gray-700;
}

.frame-name {
  @apply font-bold text-gray-800 dark:text-gray-100;
}

.frame-index {
  @apply text-xs text-gray-500;
}

.frame-variables {
  @apply space-y-1 mb-2;
}

.variable-item {
  @apply flex text-sm;
}

.var-key {
  @apply text-gray-600 dark:text-gray-400 mr-2 font-medium;
}

.var-value {
  @apply text-gray-800 dark:text-gray-200;
}

.frame-return {
  @apply flex items-center text-sm pt-2 border-t border-gray-200 dark:border-gray-700;
}

.return-label {
  @apply text-gray-600 dark:text-gray-400 mr-2 font-medium;
}

.return-value {
  @apply text-green-600 dark:text-green-400 font-semibold;
}

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.duration-300 {
  transition-duration: 300ms;
}

.duration-500 {
  transition-duration: 500ms;
}
</style>
