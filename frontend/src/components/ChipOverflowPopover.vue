<template>
  <Teleport to="body">
    <div
      v-if="open && mounted"
      ref="popoverRef"
      class="chip-overflow-popover"
      :style="popoverStyle"
      @click.stop
    >
      <div class="cop-header">
        选择保留的 chip（最多 {{ max }} 个）
        <span class="cop-count">{{ selection.size }} / {{ max }}</span>
      </div>
      <div class="cop-body">
        <button
          v-for="chip in chips"
          :key="chip.name"
          type="button"
          class="cop-row"
          :class="{ selected: selection.has(chip.name), disabled: !selection.has(chip.name) && selection.size >= max }"
          :disabled="!selection.has(chip.name) && selection.size >= max"
          @click="toggle(chip.name)"
        >
          <span class="cop-dot" :style="{ background: chip.color }" />
          <span class="cop-label">{{ chip.name }}</span>
          <span class="cop-check" :class="{ checked: selection.has(chip.name) }">
            {{ selection.has(chip.name) ? '✓' : '' }}
          </span>
        </button>
      </div>
      <div class="cop-footer">
        <button type="button" class="cop-save" @click="onSave">保存</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  chips: { type: Array, required: true },
  selection: { type: Set, required: true },
  max: { type: Number, default: 2 },
  open: { type: Boolean, default: false },
  anchor: { type: Object, required: true },
  viewportWidth: { type: Number, default: window.innerWidth },
  viewportHeight: { type: Number, default: window.innerHeight },
})

const emit = defineEmits(['update:selection', 'close'])
const mounted = ref(false)
const popoverRef = ref(null)

onMounted(() => {
  mounted.value = true
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mousedown', onClickOutside, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mousedown', onClickOutside, true)
})

watch(() => props.open, (v) => {
  if (v) mounted.value = true
})

function onKeydown(e) {
  if (!props.open) return
  if (e.key === 'Escape') emit('close')
}

function onClickOutside(e) {
  if (!props.open) return
  if (popoverRef.value && popoverRef.value.contains(e.target)) return
  emit('close')
}

function toggle(name) {
  const next = new Set(props.selection)
  if (next.has(name)) {
    next.delete(name)
  } else if (next.size < props.max) {
    next.add(name)
  }
  emit('update:selection', next)
}

function onSave() {
  emit('update:selection', new Set(props.selection))
  emit('close')
}

const POPOVER_W = 280
const POPOVER_H_EST = 220

const popoverStyle = computed(() => {
  const cellCenter = props.anchor.cellLeft + props.anchor.cellWidth / 2
  let left = cellCenter - POPOVER_W / 2
  let top = props.anchor.containerTop - POPOVER_H_EST - 12
  // 水平贴边
  if (left < 8) left = 8
  if (left + POPOVER_W > props.viewportWidth - 8) left = props.viewportWidth - 8 - POPOVER_W
  // 垂直：优先上方；上方贴顶就落到下方，并避免下方也溢出
  const belowTop = props.anchor.containerTop + 12
  if (top < 8) {
    // 上方贴顶 → 落下方，但仍要兜住视口底部
    top = Math.min(belowTop, props.viewportHeight - POPOVER_H_EST - 8)
  } else if (top + POPOVER_H_EST > props.viewportHeight - 8) {
    // 上方放置会被视口底截断 → 切到下方
    top = Math.min(belowTop, props.viewportHeight - POPOVER_H_EST - 8)
  }
  if (top < 8) top = 8
  return {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${POPOVER_W}px`,
    zIndex: 9999,
  }
})
</script>

<style scoped>
.chip-overflow-popover {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--ds-cell-radius);
  box-shadow: var(--ds-popover-shadow);
  font-family: var(--mono);
  color: var(--text-h);
  user-select: none;
}
.cop-header {
  padding: 10px 12px;
  font-size: 11px;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cop-count { color: var(--text-muted); font-size: 10px; }
.cop-body { display: flex; flex-direction: column; padding: 6px 0; max-height: 280px; overflow-y: auto; }
.cop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: inherit;
}
.cop-row:hover:not(.disabled) { background: rgba(0, 0, 0, 0.04); }
.cop-row.selected { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.cop-row.disabled { opacity: 0.4; cursor: not-allowed; }
.cop-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cop-label { flex: 1; font-size: 12px; font-weight: 600; }
.cop-check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: white;
}
.cop-check.checked { background: var(--accent); border-color: var(--accent); }
.cop-footer {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}
.cop-save {
  background: var(--accent);
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 6px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.cop-save:hover { filter: brightness(1.1); }
</style>
