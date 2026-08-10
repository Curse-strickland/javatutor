<template>
  <!--
    看板娘拖拽包装器
    在 autoload.js 创建 #waifu 节点后，为其添加水平拖拽功能
    默认位置：右下角 (bottom: 0, right: 0)
    仅支持水平拖动，垂直位置锁定在底部
    折叠按钮由 autoload.js 注入（#waifu-badge）
  -->
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

const DEFAULT_BOTTOM = 0
const BADGE_OFFSET = 33

let waifuEl = null
let isDragging = false
let offsetX = 0
let rafId = null

function syncBadge(rightPx) {
  const badge = document.getElementById('waifu-badge')
  if (!badge || !waifuEl) return
  if (waifuEl.classList.contains('waifu-folded') || badge.classList.contains('waifu-badge-folded')) {
    return
  }
  badge.style.right = (rightPx + BADGE_OFFSET) + 'px'
  badge.style.bottom = ''
}

function onPointerDown(e) {
  waifuEl = document.getElementById('waifu')
  if (!waifuEl) return
  if (waifuEl.classList.contains('waifu-folded')) return

  const target = e.target
  if (target.closest('#waifu-tool') || target.closest('.waifu-tool') || target.closest('#waifu-badge')) return

  isDragging = true
  waifuEl.style.transition = 'none'

  const badge = document.getElementById('waifu-badge')
  if (badge) badge.style.transition = 'none'

  offsetX = e.clientX - waifuEl.getBoundingClientRect().left

  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp, { once: true })
  e.preventDefault()
}

function onPointerMove(e) {
  if (!isDragging || !waifuEl) return

  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const newLeft = e.clientX - offsetX
    const newRight = window.innerWidth - newLeft - waifuEl.offsetWidth

    const minVisible = 400
    const maxRight = window.innerWidth - minVisible
    const clampedRight = Math.max(0, Math.min(newRight, maxRight))

    waifuEl.style.right = clampedRight + 'px'
    waifuEl.style.bottom = DEFAULT_BOTTOM + 'px'
    waifuEl.style.left = 'auto'
    waifuEl.style.top = 'auto'

    syncBadge(clampedRight)

    try {
      localStorage.setItem('waifu-position', JSON.stringify({ right: clampedRight }))
    } catch (err) { /* ignore */ }
  })
}

function onPointerUp() {
  isDragging = false
  if (waifuEl) waifuEl.style.transition = ''
  const badge = document.getElementById('waifu-badge')
  if (badge) badge.style.transition = ''
  document.body.style.userSelect = ''
  document.removeEventListener('pointermove', onPointerMove)
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

function initDrag() {
  const maxAttempts = 40
  let attempts = 0
  const check = () => {
    waifuEl = document.getElementById('waifu')
    if (waifuEl) {
      let savedRight = 0
      try {
        const saved = localStorage.getItem('waifu-position')
        if (saved) {
          const pos = JSON.parse(saved)
          savedRight = typeof pos.right === 'number' ? pos.right : 0
        }
      } catch (err) { /* ignore */ }

      waifuEl.style.right = savedRight + 'px'
      waifuEl.style.bottom = DEFAULT_BOTTOM + 'px'
      waifuEl.style.left = 'auto'
      waifuEl.style.top = 'auto'

      syncBadge(savedRight)
      if (typeof window.__waifuSyncBadge === 'function') {
        window.__waifuSyncBadge()
      }

      waifuEl.style.cursor = 'ew-resize'
      waifuEl.style.userSelect = 'none'
      waifuEl.addEventListener('pointerdown', onPointerDown)
      return
    }
    attempts++
    if (attempts < maxAttempts) setTimeout(check, 250)
  }
  check()
}

onMounted(() => {
  setTimeout(initDrag, 100)
})

onBeforeUnmount(() => {
  if (waifuEl) {
    waifuEl.removeEventListener('pointerdown', onPointerDown)
  }
  document.removeEventListener('pointermove', onPointerMove)
})
</script>
