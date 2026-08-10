<template>
  <div class="svg-animate-panel">
    <div class="sap-toolbar">
      <span class="sap-hint">
        {{
          store.totalSteps === 0
            ? '先运行代码，再生成基于执行快照的 SVG 动画'
            : '动画动画后，步进播放条会同步 SMIL 时间轴'
        }}
      </span>
      <button
        class="sap-gen-btn"
        :disabled="!store.code || store.totalSteps === 0 || store.isAnimating"
        @click="store.requestAnimation()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ store.isAnimating ? '生成中…' : '生成动画' }}
      </button>
    </div>

    <div class="sap-body">
      <div v-if="store.isAnimating" class="sap-loading">
        <span class="sap-loading-dot" />动画生成中…
      </div>
      <div v-else-if="store.svgError" class="sap-error">{{ store.svgError }}</div>
      <div v-else-if="store.svgText" class="sap-canvas">
        <div ref="animateSvgRef" class="sap-svg" v-html="sanitizeSvg(store.svgText)" />
      </div>
      <div v-else class="sap-empty">
        点击右上角「生成动画」，AI 将基于本次运行数据生成可视化。
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()

// coze 生成的 SMIL 动画每步间隔 0.6s（begin = step_i * 0.6s）
const ANIM_STEP_DURATION = 0.6
const animateSvgRef = ref(null)

function syncSvgTime() {
  const host = animateSvgRef.value
  const svgEl = host?.querySelector?.('svg')
  if (!svgEl || typeof svgEl.setCurrentTime !== 'function') return
  const time = Math.max(0, store.currentStep * ANIM_STEP_DURATION - 0.1)
  svgEl.setCurrentTime(time)
}

function pauseSvg() {
  const host = animateSvgRef.value
  const svgEl = host?.querySelector?.('svg')
  if (svgEl && typeof svgEl.pauseAnimations === 'function') {
    svgEl.pauseAnimations()
  }
}

watch(() => store.svgText, async () => {
  await nextTick()
  pauseSvg()
  syncSvgTime()
})

watch(() => store.currentStep, () => {
  syncSvgTime()
})

const SVG_ALLOWED_TAGS = new Set([
  'svg', 'rect', 'circle', 'line', 'path', 'text', 'animate', 'animateTransform', 'title', 'g', 'polygon'
])
const SVG_ALLOWED_ATTRS = new Set([
  'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity',
  'd', 'points', 'transform', 'font-size', 'font-weight', 'text-anchor',
  'dominant-baseline', 'id', 'begin', 'dur', 'values', 'repeatcount', 'from', 'to',
  'attributename', 'fill-mode', 'calcmode', 'keytimes', 'additive', 'accumulate', 'max',
  'min', 'restart', 'fill-freeze', 'xmlns'
])

function sanitizeSvg(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const wrap = document.createElement('div')
  wrap.innerHTML = raw
  walk(wrap)
  return wrap.innerHTML
}

function walk(node) {
  const children = Array.from(node.children || [])
  for (const el of children) {
    if (!SVG_ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove()
      continue
    }
    const attrs = Array.from(el.attributes || [])
    for (const attr of attrs) {
      const name = attr.name.toLowerCase().replace(/^:|\s+/g, '')
      if (!SVG_ALLOWED_ATTRS.has(name) || /^on/i.test(name)) {
        el.removeAttribute(attr.name)
      }
    }
    walk(el)
  }
}
</script>

<style scoped>
.svg-animate-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 10px;
}
.sap-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}
.sap-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  min-width: 0;
}
.sap-gen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms cubic-bezier(.22,.9,.27,1), box-shadow 160ms, opacity 160ms;
}
.sap-gen-btn:hover:not(:disabled) { box-shadow: 0 4px 12px var(--accent-bg); }
.sap-gen-btn:active:not(:disabled) { transform: translateY(1px) scale(0.997); }
.sap-gen-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.sap-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border);
  background: var(--code-bg);
  padding: 10px;
}
.sap-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 14px;
  padding: 24px 0;
}
.sap-loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  animation: sap-blink 1.2s ease-in-out infinite;
}
@keyframes sap-blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
.sap-error {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--danger);
  background: var(--accent-bg);
  border-left: 2px solid var(--danger);
  word-break: break-all;
}
.sap-empty {
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  padding: 28px 12px;
}
.sap-canvas {
  display: flex;
  justify-content: center;
}
.sap-svg {
  width: 100%;
  max-width: 600px;
}
.sap-svg :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

@media (prefers-reduced-motion: reduce) {
  .sap-loading-dot { animation: none; }
}
</style>
