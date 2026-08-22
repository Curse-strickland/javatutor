<template>
  <div class="app-shell">
    <BootIntro v-if="showBootIntro" @done="showBootIntro = false" />
    <ModeBar />
    <VideoBackground />
    <AudioBackground />
    <Live2DWidget />
    <GlobalStatus />

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

</style>