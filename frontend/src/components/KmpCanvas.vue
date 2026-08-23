<template>
  <div class="kmp">
    <div class="kmp-phase">{{ viz.phaseLabel }}</div>

    <div class="kmp-scroll">
      <!-- 匹配阶段：text 行固定，pattern 行随 i-j 平滑位移 -->
      <div v-if="viz.mode === 'matching'" class="kmp-rows">
        <div class="kmp-row">
          <span class="kmp-row-label">text</span>
          <div class="kmp-cells">
            <div
              v-for="(ch, k) in textChars"
              :key="'t' + k"
              class="kmp-cell"
              :style="textCellStyle(k)"
            >
              <span class="kmp-cell-idx">{{ k }}</span>
              <span class="kmp-cell-char">{{ ch }}</span>
              <span v-if="k === iVal" class="kmp-ptr" :style="ptrStyle(I_COLOR)">i</span>
            </div>
          </div>
        </div>

        <div class="kmp-row">
          <span class="kmp-row-label">pattern</span>
          <div class="kmp-cells kmp-cells-slide" :style="patternSlideStyle">
            <div
              v-for="(ch, k) in patternChars"
              :key="'p' + k"
              class="kmp-cell"
              :style="patternCellStyle(k)"
            >
              <span class="kmp-cell-idx">{{ k }}</span>
              <span class="kmp-cell-char">{{ ch }}</span>
              <span v-if="k === jVal" class="kmp-ptr" :style="ptrStyle(J_COLOR)">j</span>
            </div>
          </div>
        </div>

        <!-- 已构建好的 next 数组在匹配阶段持续显示 -->
        <div class="kmp-row">
          <span class="kmp-row-label">next</span>
          <div class="kmp-cells">
            <div
              v-for="(v, k) in viz.next"
              :key="'mn' + k"
              class="kmp-cell kmp-cell-num"
              :style="cellSize"
            >
              <span class="kmp-cell-idx">{{ k }}</span>
              <span class="kmp-cell-char">{{ v }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 构建 next：pattern 前缀/后缀对比 + next 数组逐步填充 -->
      <div v-else-if="viz.mode === 'next-build'" class="kmp-rows">
        <div class="kmp-row">
          <span class="kmp-row-label">pattern</span>
          <div class="kmp-cells">
            <div
              v-for="(ch, k) in patternChars"
              :key="'np' + k"
              class="kmp-cell"
              :style="buildCellStyle(k)"
            >
              <span class="kmp-cell-idx">{{ k }}</span>
              <span class="kmp-cell-char">{{ ch }}</span>
              <span v-if="k === iVal" class="kmp-ptr kmp-ptr-above" :style="ptrStyle(I_COLOR)">i</span>
              <span v-if="k === jVal" class="kmp-ptr kmp-ptr-below" :style="ptrStyle(J_COLOR)">j</span>
            </div>
          </div>
        </div>

        <div class="kmp-row">
          <span class="kmp-row-label">next</span>
          <div class="kmp-cells">
            <div
              v-for="(v, k) in viz.next"
              :key="'n' + k"
              class="kmp-cell kmp-cell-num"
              :style="nextCellStyle(k)"
            >
              <span class="kmp-cell-idx">{{ k }}</span>
              <span class="kmp-cell-char">{{ nextCellFilled(k) ? v : '·' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 失配跳转：已匹配串 → 最长相同前后缀 → j 回退 -->
    <div v-if="viz.jumpInfo" class="kmp-jump">
      <span class="kmp-jump-chip">已匹配 <b>{{ viz.jumpInfo.matched }}</b></span>
      <span class="kmp-jump-arrow">→</span>
      <span class="kmp-jump-chip">最长相同前后缀 <b>{{ viz.jumpInfo.lcp }}</b></span>
      <span class="kmp-jump-arrow">→</span>
      <span class="kmp-jump-chip">j: {{ viz.jumpInfo.from }} → {{ viz.jumpInfo.to }}</span>
    </div>

    <div class="kmp-code">{{ codeLine }}</div>
    <div class="kmp-explanation">{{ viz.explanation }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { colorForPointerName } from '../utils/pointerRoleColors.js'

const props = defineProps({
  viz: { type: Object, required: true },
})

const I_COLOR = colorForPointerName('i') || '#eab308'
const J_COLOR = colorForPointerName('j') || '#3b82f6'
const MATCH_COLOR = '#10b981'
const MISMATCH_COLOR = '#ef4444'
const COMPARE_COLOR = '#8b5cf6' // next 构建时前缀/后缀共用浅色

let _cellW = null
let _gap = null
function cellW() {
  if (_cellW == null) {
    _cellW = 30
    if (typeof document !== 'undefined') {
      const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kmp-cell'))
      if (!Number.isNaN(v)) _cellW = v
    }
  }
  return _cellW
}
function gap() {
  if (_gap == null) {
    _gap = 2
    if (typeof document !== 'undefined') {
      const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-strip-gap'))
      if (!Number.isNaN(v)) _gap = v
    }
  }
  return _gap
}

const viz = computed(() => props.viz)
const iVal = computed(() => viz.value.i)
const jVal = computed(() => viz.value.j)
const textChars = computed(() => Array.from(viz.value.text || ''))
const patternChars = computed(() => Array.from(viz.value.pattern || ''))

const cellSize = computed(() => ({ width: `${cellW()}px`, minWidth: `${cellW()}px`, flexShrink: '0' }))
const stepPx = computed(() => cellW() + gap())

const alignOffset = computed(() => {
  const off = viz.value.alignOffset
  return off == null ? 0 : off
})

const patternSlideStyle = computed(() => ({
  transform: `translateX(${alignOffset.value * stepPx.value}px)`,
}))

const isMismatch = computed(() => {
  if (viz.value.mode !== 'matching') return false
  const i = iVal.value
  const j = jVal.value
  if (i == null || j == null) return false
  if (i < 0 || i >= (viz.value.text || '').length) return false
  if (j < 0 || j >= (viz.value.pattern || '').length) return false
  return viz.value.text[i] !== viz.value.pattern[j]
})

function ptrStyle(color) {
  return { color, borderColor: `${color}66` }
}

function tint(color) {
  return { background: `${color}22`, borderColor: color, boxShadow: 'var(--ds-cell-shadow-active)' }
}

function matched() {
  return { background: `${MATCH_COLOR}1a`, borderColor: MATCH_COLOR, color: MATCH_COLOR }
}

// 匹配阶段：text 行
function textCellStyle(k) {
  const base = { ...cellSize.value }
  const i = iVal.value
  const off = alignOffset.value
  if (isMismatch.value && k === i) return { ...base, ...tint(MISMATCH_COLOR) }
  if (k === i) return { ...base, ...tint(I_COLOR) }
  if (off != null && k >= off && k < i) return { ...base, ...matched() }
  return base
}

// 匹配阶段：pattern 行
function patternCellStyle(k) {
  const base = { ...cellSize.value }
  const j = jVal.value
  if (isMismatch.value && k === j) return { ...base, ...tint(MISMATCH_COLOR) }
  if (k === j) return { ...base, ...tint(J_COLOR) }
  if (j != null && k >= 0 && k < j) return { ...base, ...matched() }
  return base
}

// next 构建：pattern 行（前缀/后缀共用浅色）
function buildCellStyle(k) {
  const base = { ...cellSize.value }
  const i = iVal.value
  const j = jVal.value
  if (k === i) return { ...base, ...tint(I_COLOR) }
  if (k === j) return { ...base, ...tint(J_COLOR) }
  if (j != null && i != null) {
    const prefix = k >= 0 && k < j
    const suffix = k >= i - j && k < i
    if (prefix || suffix) {
      return { ...base, background: `${COMPARE_COLOR}1f`, borderColor: `${COMPARE_COLOR}88` }
    }
  }
  return base
}

// next 构建：next 数组行
function nextCellStyle(k) {
  const base = { ...cellSize.value }
  const i = iVal.value
  if (k === i) return { ...base, ...tint(I_COLOR) }
  if (i != null && k > i) return { ...base, opacity: '0.42' }
  return base
}

// i 不在作用域时（for 循环尚未开始或已结束，如 return 处）显示全部已写值
function nextCellFilled(k) {
  const i = iVal.value
  if (i == null) return true
  return k <= i
}

const codeLine = computed(() =>
  viz.value.mode === 'next-build'
    ? 'while (j>0 && p[i]!=p[j]) j=next[j-1];  if (p[i]==p[j]) j++;  next[i]=j;'
    : 'while (j>0 && text[i]!=pattern[j]) j=next[j-1];  if (text[i]==pattern[j]) { i++; j++; }',
)
</script>

<style scoped>
.kmp { padding: 4px 0; }
.kmp-phase {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-h);
  margin-bottom: 6px;
}
.kmp-scroll {
  overflow-x: auto;
  max-width: 100%;
  padding: 2px 0 6px;
}
.kmp-rows { display: inline-flex; flex-direction: column; }
.kmp-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
}
.kmp-row-label {
  width: 58px;
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  padding-top: 22px;
  letter-spacing: 0.04em;
}
.kmp-cells {
  position: relative;
  display: flex;
  gap: var(--ds-strip-gap, 2px);
  padding-top: 22px;
  padding-bottom: 20px;
}
.kmp-cells-slide {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.kmp-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: var(--ds-cell-radius-sm, 6px);
  border: var(--ds-cell-border);
  background: var(--card-bg);
  box-shadow: var(--ds-cell-shadow);
  font-family: var(--mono);
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}
.kmp-cell-idx {
  padding: 1px 0;
  font-size: 9px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  text-align: center;
}
.kmp-cell-char {
  padding: 6px 0;
  min-width: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}
.kmp-cell-num .kmp-cell-char { font-weight: 500; }
.kmp-ptr {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.25;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid transparent;
  background: var(--card-bg);
  white-space: nowrap;
  z-index: 2;
}
.kmp-ptr-below { top: auto; bottom: -16px; }
.kmp-jump {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 4px 0 8px;
  font-family: var(--mono);
  font-size: 10px;
}
.kmp-jump-chip {
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  border-radius: 4px;
  color: var(--text);
}
.kmp-jump-chip b { color: var(--accent); font-weight: 700; }
.kmp-jump-arrow { color: var(--text-muted); }
.kmp-code {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-muted);
  background: var(--ak-code-bg, rgba(13, 158, 196, 0.06));
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 8px;
  margin-bottom: 6px;
  overflow-x: auto;
  white-space: nowrap;
}
.kmp-explanation {
  font-family: var(--sans);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
  padding: 4px 2px;
}
</style>
