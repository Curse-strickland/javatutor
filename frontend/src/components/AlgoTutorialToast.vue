<template>
  <transition name="tutorial-toast">
    <div
      v-if="store.tutorialToast.visible && store.tutorialToast.categoryId"
      class="tutorial-toast"
      role="status"
    >
      <button type="button" class="tt-body" @click="onOpen">
        <span v-if="store.tutorialToast.title" class="tt-title">已识别：{{ store.tutorialToast.title }}</span>
        <span class="tt-text">点击此处查看该算法教程</span>
      </button>
      <button type="button" class="tt-close" @click="onClose" title="关闭" aria-label="关闭">×</button>
    </div>
  </transition>
</template>

<script setup>
import { usePlayerStore } from '../stores/player'

const store = usePlayerStore()

function onOpen() {
  store.openTutorial(store.tutorialToast.categoryId, store.tutorialToast.anchorId)
}

function onClose() {
  store.dismissTutorialToast()
}
</script>

<style scoped>
.tutorial-toast {
  position: fixed;
  right: 26px;
  bottom: 46px;
  z-index: 6000;
  display: flex;
  align-items: stretch;
  background: var(--card-bg);
  border: 1px solid var(--accent-border, var(--border));
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.tutorial-toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent);
}
.tt-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: var(--mono);
}
.tt-body:hover .tt-text {
  color: var(--accent);
}
.tt-title {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.tt-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-h);
  transition: color 0.15s;
}
.tt-close {
  align-self: center;
  margin: 0 8px 0 2px;
  padding: 2px 8px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  font-family: var(--mono);
  transition: color 0.15s;
}
.tt-close:hover {
  color: var(--text-h);
}

.tutorial-toast-enter-active,
.tutorial-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.22, 0.9, 0.27, 1);
}
.tutorial-toast-enter-from,
.tutorial-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
