<template>
  <audio
    v-show="false"
    ref="audioRef"
    :src="src"
    autoplay
    loop
    :volume="volume"
  />
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const src = inject('audioSrc', ref(''))
const volume = inject('audioVolume', ref(0.3))
const audioRef = ref(null)

watch(src, (val) => {
  if (!audioRef.value) return
  if (val) {
    audioRef.value.load()
    audioRef.value.play().catch(() => {})
  } else {
    audioRef.value.pause()
    audioRef.value.removeAttribute('src')
  }
})

watch(volume, (val) => {
  if (audioRef.value) audioRef.value.volume = val
})
</script>
