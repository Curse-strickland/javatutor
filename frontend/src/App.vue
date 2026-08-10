<template>
  <div class="app-shell">
    <BootIntro v-if="showBootIntro" @done="showBootIntro = false" />
    <ModeBar />
    <VideoBackground />
    <AudioBackground />
    <Live2DWidget />
    <GlobalStatus />

    <div class="runtime-wire" aria-label="运行时数据流">
      <div class="wire-left">
        <span class="wire-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
            <path d="M5 1h18l4 4v18l-4 4H5l-4-4V5l4-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/>
            <circle class="wire-pulse-dot" cx="14" cy="14" r="4.5" fill="currentColor" opacity="1"/>
            <circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 3.5" opacity="0.4"/>
          </svg>
        </span>
        <span class="wire-title">
          <b>RUNTIME WIRE</b>
          <span>教学终端 · HEARTBEAT</span>
        </span>
      </div>
      <div class="wire-row">
        <div class="marquee-track">
          <span v-for="(item, i) in wireItems" :key="'a'+i" class="wire-item">
            <span class="wire-dot">·</span>{{ item.name }}
            <span class="wire-coord">{{ item.coord }}</span>
          </span>
          <span v-for="(item, i) in wireItems" :key="'b'+i" class="wire-item" aria-hidden="true">
            <span class="wire-dot">·</span>{{ item.name }}
            <span class="wire-coord">{{ item.coord }}</span>
          </span>
        </div>
      </div>
    </div>

    <SingleFileShell v-if="store.mode === 'single'" />
    <MultiFileShell v-else-if="store.mode === 'multi'" />

    <footer class="site-disclaimer" role="contentinfo">
      本网站为非官方的个人开源教学项目，与鹰角网络（Hypergryph）无关。 网站内出现的「拉普兰德」角色形象及相关视觉元素版权归鹰角网络所有；Live2D 模型作者为 @人形社畜（原画/UI）、@小布朗尼OwO（建模）。 本站承诺不进行任何商业化盈利。
    </footer>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, provide } from 'vue'
import { usePlayerStore } from './stores/player'
import GlobalStatus from './components/GlobalStatus.vue'
import VideoBackground from './components/VideoBackground.vue'
import AudioBackground from './components/AudioBackground.vue'
import Live2DWidget from './components/Live2DWidget.vue'
import BootIntro from './components/BootIntro.vue'
import ModeBar from './components/ModeBar.vue'
import SingleFileShell from './components/SingleFileShell.vue'
import MultiFileShell from './components/MultiFileShell.vue'

const showBootIntro = ref(true)
/** intro 期间压住看板娘；主界面出来后再升起（不改版面） */
watch(showBootIntro, (active) => {
  document.body.classList.toggle('boot-intro-active', active)
}, { immediate: true })
onBeforeUnmount(() => {
  document.body.classList.remove('boot-intro-active')
})
const store = usePlayerStore()
const wireItems = [
  { name: 'TRACE', coord: 'AST' },
  { name: 'STEP', coord: 'PLAYBACK' },
  { name: 'HEAP', coord: 'VIEW' },
  { name: 'STACK', coord: 'FRAME' },
  { name: 'AI TUTOR', coord: 'COZE' },
  { name: 'SANDBOX', coord: 'JDK17' },
  { name: 'LIVE2D', coord: 'OP' },
]
const videoSrc = ref('')
provide('videoSrc', videoSrc)
const audioSrc = ref('')
provide('audioSrc', audioSrc)
const audioVolume = ref(0.3)
provide('audioVolume', audioVolume)
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: transparent;
  position: relative;
  font-family: var(--sans);
  z-index: 1;
}
.site-disclaimer {
  position: fixed;
  right: 12px;
  left: auto;
  bottom: 8px;
  z-index: 3;
  margin: 0;
  padding: 0;
  pointer-events: none;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  opacity: 0.78;
  text-align: right;
  max-width: min(420px, calc(100vw - 24px));
}
@media (max-width: 720px) {
  .site-disclaimer {
    font-size: 11px;
    opacity: 0.72;
  }
}
/* 蓝图网格铺底（模板装饰，不占布局） */
.app-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(18, 22, 29, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(18, 22, 29, 0.045) 1px, transparent 1px);
  background-size: 56px 56px;
}

/* ---- Runtime wire banner (prototype .wire, compact) ---- */
.runtime-wire {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(170px, 240px) 1fr;
  align-items: stretch;
  min-height: 44px;
  margin: 10px 12px 0;
  background: var(--card-bg);
  border: 1px solid var(--line, var(--border));
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: var(--shadow);
}
.runtime-wire::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 120px;
  height: 2px;
  background: var(--accent);
}
.wire-left {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-right: 1px solid var(--line, var(--border));
}
.wire-mark {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}
.wire-pulse-dot {
  animation: wire-pulse 1.6s steps(2) infinite;
}
@keyframes wire-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.18; }
}
.wire-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}
.wire-title b {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-h);
}
.wire-title span {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.wire-row {
  overflow: hidden;
  display: flex;
  align-items: center;
  white-space: nowrap;
  min-width: 0;
}
.marquee-track {
  display: inline-flex;
  gap: 28px;
  padding-right: 28px;
  animation: wire-marquee 42s linear infinite;
}
.wire-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
}
.wire-dot { color: var(--accent); }
.wire-coord {
  color: var(--text-muted);
  font-size: 9px;
}
@keyframes wire-marquee { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
  .wire-pulse { animation: none; }
}
@media (max-width: 720px) {
  .runtime-wire { grid-template-columns: 1fr; }
  .wire-left { border-right: none; border-bottom: 1px solid var(--border); }
}
</style>