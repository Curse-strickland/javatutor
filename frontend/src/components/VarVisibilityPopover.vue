<template>
  <Teleport to="body">
    <div
      v-if="open && mounted"
      ref="popoverRef"
      class="var-vis-popover"
      role="dialog"
      aria-label="选择展示的变量"
      :style="popoverStyle"
      @click.stop
    >
      <div class="vvp-header">
        展示的变量
        <span class="vvp-count">{{ shownCount }} / {{ vars.length }}</span>
      </div>
      <div class="vvp-body">
        <button
          v-for="v in vars"
          :key="v.name"
          type="button"
          class="vvp-row"
          :class="{ selected: !hidden.has(v.name) }"
          @click="toggle(v.name)"
        >
          <span class="vvp-dot" :style="{ background: v.color }" />
          <span class="vvp-label">{{ v.name }}</span>
          <span class="vvp-check" :class="{ checked: !hidden.has(v.name) }">
            {{ hidden.has(v.name) ? '' : '✓' }}
          </span>
        </button>
        <div v-if="!vars.length" class="vvp-empty">无变量</div>
      </div>
      <div class="vvp-footer">
        <button type="button" class="vvp-all" @click="showAll">全选</button>
        <button type="button" class="vvp-save" @click="onSave">保存</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  vars: { type: Array, required: true },
  hidden: { type: Set, required: true },
  anchor: { type: Object, required: true },
  open: { type: Boolean, default: false },
  viewportWidth: { type: Number, default: window.innerWidth },
  viewportHeight: { type: Number, default: window.innerHeight },
})

const emit = defineEmits(['update:hidden', 'close'])
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
  const next = new Set(props.hidden)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  emit('update:hidden', next)
}

function showAll() {
  emit('update:hidden', new Set())
}

function onSave() {
  emit('close')
}

const shownCount = computed(() => props.vars.length - props.hidden.size)

const POPOVER_W = 240
const POPOVER_H_EST = 260

const popoverStyle = computed(() => {
  let left = props.anchor.left
  let top = props.anchor.top
  if (left < 8) left = 8
  if (left + POPOVER_W > props.viewportWidth - 8) left = props.viewportWidth - 8 - POPOVER_W
  if (top + POPOVER_H_EST > props.viewportHeight - 8) {
    top = Math.max(8, props.viewportHeight - POPOVER_H_EST - 8)
  }
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
.var-vis-popover {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--ds-cell-radius);
  box-shadow: var(--ds-popover-shadow);
  font-family: var(--mono);
  color: var(--text-h);
  user-select: none;
}
.vvp-header {
  padding: 10px 12px;
  font-size: 11px;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.vvp-count { color: var(--text-muted); font-size: 10px; }
.vvp-body { display: flex; flex-direction: column; padding: 6px 0; max-height: 280px; overflow-y: auto; }
.vvp-row {
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
.vvp-row:hover { background: rgba(0, 0, 0, 0.04); }
.vvp-row.selected { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.vvp-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.vvp-label { flex: 1; font-size: 12px; font-weight: 600; }
.vvp-check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: white;
}
.vvp-check.checked { background: var(--accent); border-color: var(--accent); }
.vvp-empty { color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center; }
.vvp-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}
.vvp-all {
  background: transparent;
  color: var(--text-h);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 14px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.vvp-all:hover { background: rgba(0, 0, 0, 0.04); }
.vvp-save {
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
.vvp-save:hover { filter: brightness(1.1); }
</style>
