<template>
  <div
    ref="rootEl"
    class="boot-intro"
    :class="{
      'is-done': phase === 'steady' || phase === 'op-start' || phase === 'curtain-open',
      'is-op-start': phase === 'op-start' || phase === 'curtain-open',
      'is-curtain-open': phase === 'curtain-open',
    }"
    role="dialog"
    aria-label="JavaTutor 启动序列"
  >
    <div class="stage">
      <div class="crt" aria-hidden="true"></div>

      <div class="boot-log" aria-hidden="true">
        <div class="row"><span>&gt; JVM RUNTIME · HotSpot 64-Bit</span><span class="ok">OK</span></div>
        <div class="row"><span>&gt; TRACE ENGINE · AST 插桩</span><span class="ok">OK</span></div>
        <div class="row"><span>&gt; AI TUTOR LINK · COZE</span><span class="ok">OK</span></div>
        <div class="row"><span>&gt; OPERATOR · LAPPLAND 执勤</span><span class="ok">OK</span></div>
        <div class="row"><span>&gt; 载入教学终端 JAVATUTOR</span><span class="ok">READY</span></div>
      </div>

      <div class="slice s1" aria-hidden="true"></div>
      <div class="slice s2" aria-hidden="true"></div>
      <div class="slice s3" aria-hidden="true"></div>
      <div class="charge" aria-hidden="true">
        <div class="charge-frame"></div>
        <div class="charge-head"><span><b>SYSTEM CHARGE</b> · 系统充能</span><span>JT / 2026</span></div>
        <div class="charge-pct"><span ref="pctEl">0</span><span class="sym">%</span></div>
        <div class="charge-bar"><div class="fill" ref="fillEl"></div></div>
        <div class="charge-meta"><span>SANDBOX · TRACE · AGENT</span><span class="on" ref="chargeStateEl">CHARGING</span></div>
      </div>

      <div class="flash" aria-hidden="true"></div>

      <span class="rail rail-tl">JAVATUTOR / 2026 · 教学终端 <b>V2.4</b></span>
      <span class="rail rail-tr">AST 插桩 × 沙箱执行 × AI 导师</span>
      <span class="rail rail-bl">JDK 17 · TRACE ENGINE · STEP PLAYBACK</span>
      <span class="rail rail-br"><b>BOOT COMPLETE</b> · 启动完成 · 5.6S</span>
      <span class="rail rail-side-l">JAVA VISUALIZATION PLATFORM</span>
      <span class="rail rail-side-r">SEE THE RUNTIME · 看得见的 Java</span>

      <span class="tick tl" aria-hidden="true"></span>
      <span class="tick tr" aria-hidden="true"></span>
      <span class="tick bl" aria-hidden="true"></span>
      <span class="tick br" aria-hidden="true"></span>

      <div class="scanline" aria-hidden="true"></div>
      <div class="blips" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span>
      </div>

      <div class="lockup">
        <div class="logo-kicker">TERMINAL ONLINE · 终端已上线</div>
        <h1 class="logo"><span class="word" data-text="JavaTutor">JavaTutor</span><span class="dot">.</span></h1>
        <div class="logo-sub"><b>JAVA 可视化教学平台</b><span class="slash">//</span><span>看得见的 Java · 问得到的老师</span></div>
        <div class="logo-rule" aria-hidden="true"></div>
      </div>

      <div class="cta-row">
        <span class="btn-ripple">
          <span class="halo" aria-hidden="true"></span>
          <span class="halo h2" aria-hidden="true"></span>
          <button type="button" class="btn-enter" @click="onEnter">
            进入学习终端
            <svg viewBox="0 0 24 24"><path d="M5 19L19 5M19 5H8M19 5v11" /></svg>
          </button>
        </span>
        <span class="cta-hint"><span class="blip"></span>RUNTIME MONITOR · 运行监控中 // SCAN CYCLE 6.5S</span>
      </div>

      <span class="skip-hint" aria-hidden="true">CLICK / ANY KEY — SKIP 跳过</span>
    </div>

    <div class="veil" aria-hidden="true">
      <div class="veil-panel l">
        <span class="veil-rail">JAVATUTOR · <b>OP-START</b></span>
      </div>
      <div class="veil-panel r">
        <span class="veil-rail">MISSION · <b>RUNTIME</b></span>
      </div>
      <div class="op-title">
        <div class="op-kicker">OPERATION START · 行动开始</div>
        <div class="op-word">看得见的<span class="thin">运行时</span></div>
        <div class="op-sub">MISSION · <b>JAVA VISUALIZATION</b> · 拉普兰德 已就位</div>
        <div class="op-rule" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['done'])

const DONE_AT = 5600
const NAV_DELAY = 1900
const CURTAIN_OPEN_MS = 1300
const SKIP_ARM_MS = 900

const rootEl = ref(null)
const pctEl = ref(null)
const fillEl = ref(null)
const chargeStateEl = ref(null)

/** @type {import('vue').Ref<'booting' | 'steady' | 'op-start' | 'curtain-open'>} */
const phase = ref('booting')

let bootTimer = 0
let skipArmTimer = 0
let navTimer = 0
let openTimer = 0
let rafId = 0
let navArmed = false

function lockChargeComplete() {
  if (pctEl.value) pctEl.value.textContent = '100'
  if (fillEl.value) fillEl.value.style.width = '100%'
  if (chargeStateEl.value) chargeStateEl.value.textContent = 'READY'
}

function detachSkipListeners() {
  window.removeEventListener('pointerdown', onSkip)
  window.removeEventListener('keydown', onSkip)
}

function finishToSteady() {
  if (phase.value !== 'booting') return
  phase.value = 'steady'
  lockChargeComplete()
  const root = rootEl.value
  const anims = root && root.getAnimations ? root.getAnimations({ subtree: true }) : []
  for (const a of anims) {
    try { a.finish() } catch (_) { /* ignore */ }
  }
  detachSkipListeners()
  if (bootTimer) clearTimeout(bootTimer)
}

function onSkip() {
  if (phase.value !== 'booting') return
  finishToSteady()
}

function onEnter() {
  if (phase.value !== 'steady' || navArmed) return
  navArmed = true
  phase.value = 'op-start'
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    emit('done')
    return
  }
  navTimer = window.setTimeout(() => {
    phase.value = 'curtain-open'
    openTimer = window.setTimeout(() => emit('done'), CURTAIN_OPEN_MS)
  }, NAV_DELAY)
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    phase.value = 'steady'
    lockChargeComplete()
    return
  }

  let t0 = null
  const START = 2100
  const DUR = 1560
  function tick(now) {
    if (phase.value !== 'booting') return
    if (t0 === null) t0 = now
    const elapsed = now - t0
    const p = Math.min(1, Math.max(0, (elapsed - START) / DUR))
    const v = Math.round(p * 100)
    if (pctEl.value) pctEl.value.textContent = String(v)
    if (fillEl.value) fillEl.value.style.width = v + '%'
    if (v >= 100 && chargeStateEl.value) chargeStateEl.value.textContent = 'READY'
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  bootTimer = window.setTimeout(finishToSteady, DONE_AT)
  skipArmTimer = window.setTimeout(() => {
    window.addEventListener('pointerdown', onSkip)
    window.addEventListener('keydown', onSkip)
  }, SKIP_ARM_MS)
})

onBeforeUnmount(() => {
  clearTimeout(bootTimer)
  clearTimeout(skipArmTimer)
  clearTimeout(navTimer)
  clearTimeout(openTimer)
  cancelAnimationFrame(rafId)
  detachSkipListeners()
})
</script>

<style scoped src="../assets/boot-intro.css"></style>
