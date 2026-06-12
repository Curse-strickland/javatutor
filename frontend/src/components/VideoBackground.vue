<template>
  <video
    v-show="src"
    ref="videoRef"
    class="video-bg"
    :src="src"
    autoplay
    loop
    muted
    playsinline
  />
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const src = inject('videoSrc', ref(''))
const videoRef = ref(null)

watch(src, (val) => {
  if (!videoRef.value) return
  if (val) {
    videoRef.value.load()
    videoRef.value.play().catch(() => {})
  } else {
    videoRef.value.pause()
    videoRef.value.removeAttribute('src')
  }
})
</script>

<style scoped>
.video-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
}
</style>
