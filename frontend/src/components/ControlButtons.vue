<template>
  <div class="control-dock fixed z-50" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @pointerdown.stop>
    <div class="flex items-center space-x-2 bg-white/90 dark:bg-gray-800/90 rounded-lg p-2 shadow-md">
      <button class="icon-btn" @click.stop="$emit('first')" title="跳到第一步">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6v12l-8.5-6L18 6zM8 6v12H6V6h2z"/></svg>
      </button>
      <button class="icon-btn" @click.stop="$emit('prev')" title="上一步">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6L11 18zM13 6v12h2V6h-2z"/></svg>
      </button>

      <button class="icon-btn run" @click.stop="$emit('run')" :disabled="isLoading" title="运行">
        <svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>

      <button class="icon-btn" @click.stop="$emit('next')" title="下一步">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v12l8.5-6L13 6zM11 6v12H9V6h2z"/></svg>
      </button>
      <button class="icon-btn" @click.stop="$emit('last')" title="跳到最后">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6v12l8.5-6L6 6zM14 6v12h2V6h-2z"/></svg>
      </button>

      <button class="icon-btn" @click.stop="$emit('toggle-auto')" :title="isAutoPlaying ? '暂停自动播放' : '开始自动播放'">
        <svg v-if="!isAutoPlaying" class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        <svg v-else class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      </button>

      <select v-model.number="localSpeed" @change="onSpeedChange" class="bg-transparent text-sm border rounded px-1 py-0.5">
        <option :value="500">0.5x</option>
        <option :value="1000">1x</option>
        <option :value="2000">2x</option>
      </select>

      <div class="text-xs text-gray-700 dark:text-gray-300 pl-2">
        {{ displayStep }}
      </div>

      <div class="drag-handle ml-2 cursor-move" @pointerdown.prevent="startDrag" title="拖拽移动">
        <svg class="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h2v2H3V6zm4 0h2v2H7V6zm4 0h2v2h-2V6zm4 0h2v2h-2V6zM3 10h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM3 14h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/></svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
const props = defineProps({
  isAutoPlaying: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  speed: { type: Number, default: 1000 },
  currentStep: { type: Number, default: 0 },
  totalSteps: { type: Number, default: 0 }
})
const emit = defineEmits(['run','prev','next','first','last','toggle-auto','change-speed'])

const pos = ref({ x: 20, y: window.innerHeight - 120 })
const dragging = ref(false)
let offset = { x: 0, y: 0 }

const startDrag = (e) => {
  dragging.value = true
  offset.x = e.clientX - pos.value.x
  offset.y = e.clientY - pos.value.y
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}
const onMove = (e) => {
  if (!dragging.value) return
  pos.value.x = e.clientX - offset.x
  pos.value.y = e.clientY - offset.y
  const w = window.innerWidth
  const h = window.innerHeight
  pos.value.x = Math.max(0, Math.min(pos.value.x, w - 120))
  pos.value.y = Math.max(0, Math.min(pos.value.y, h - 40))
}
const onUp = () => {
  dragging.value = false
  window.removeEventListener('pointermove', onMove)
}

const localSpeed = ref(props.speed)
watch(() => props.speed, v => localSpeed.value = v)
const onSpeedChange = () => emit('change-speed', localSpeed.value)

const displayStep = computed(() => {
  return props.totalSteps ? `${props.currentStep + 1} / ${props.totalSteps}` : '0 / 0'
})
</script>

<style scoped>
.icon-btn {
  background: transparent;
  border: none;
  padding: 6px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #374151;
}
.icon-btn:hover { background: rgba(0,0,0,0.06); }
.icon-btn:disabled { opacity: 0.5; cursor: not-allowed }
.run svg { color: #10b981; }
.control-dock { transition: transform 0.12s; }
</style>
