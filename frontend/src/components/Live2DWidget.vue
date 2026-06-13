<template>
  <!--
    看板娘拖拽包装器
    在 autoload.js 创建 #waifu 节点后，为其添加水平拖拽功能
    默认位置：右下角 (bottom: 0, right: 0)
    仅支持水平拖动，垂直位置锁定在底部
  -->
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

const DEFAULT_BOTTOM = 0
const BADGE_OFFSET = 33  // badge right offset relative to waifu right

let waifuEl = null
let isDragging = false
let offsetX = 0
let rafId = null

function onPointerDown(e) {
  waifuEl = document.getElementById('waifu')
  if (!waifuEl) return

  // 只在点击看板娘主体（非工具栏按钮）时启动拖拽
  const target = e.target
  if (target.closest('#waifu-tool') || target.closest('.waifu-tool')) return

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

    // 仅水平方向，限制不超出屏幕边界（至少保留 120px 可见）
    const minVisible = 400
    const maxRight = window.innerWidth - minVisible
    const clampedRight = Math.max(0, Math.min(newRight, maxRight))

    waifuEl.style.right = clampedRight + 'px'
    waifuEl.style.bottom = DEFAULT_BOTTOM + 'px'
    waifuEl.style.left = 'auto'
    waifuEl.style.top = 'auto'

    // 折叠角标跟随水平移动
    const badge = document.getElementById('waifu-badge')
    if (badge && !waifuEl.classList.contains('waifu-folded')) {
      badge.style.right = (clampedRight + BADGE_OFFSET) + 'px'
    }

    // 保存位置到 localStorage
    try {
      localStorage.setItem('waifu-position', JSON.stringify({ right: clampedRight }))
    } catch (e) { /* ignore */ }
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
  // 轮询等待 autoload.js 创建 #waifu 节点
  const maxAttempts = 40
  let attempts = 0
  const check = () => {
    waifuEl = document.getElementById('waifu')
    if (waifuEl) {
      // 恢复上次保存的位置（仅水平），默认右下角
      let savedRight = 0
      try {
        const saved = localStorage.getItem('waifu-position')
        if (saved) {
          const pos = JSON.parse(saved)
          savedRight = typeof pos.right === 'number' ? pos.right : 0
        }
      } catch (e) { /* ignore */ }

      waifuEl.style.right = savedRight + 'px'
      waifuEl.style.bottom = DEFAULT_BOTTOM + 'px'
      waifuEl.style.left = 'auto'
      waifuEl.style.top = 'auto'

      // 初始化角标水平位置
      const badge = document.getElementById('waifu-badge')
      if (badge && !waifuEl.classList.contains('waifu-folded')) {
        badge.style.right = (savedRight + BADGE_OFFSET) + 'px'
      }

      // 修改光标提示可水平拖拽
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
  // 延迟初始化，等 autoload.js 执行完毕
  setTimeout(initDrag, 100)
})

onBeforeUnmount(() => {
  if (waifuEl) {
    waifuEl.removeEventListener('pointerdown', onPointerDown)
  }
  document.removeEventListener('pointermove', onPointerMove)
})
</script>
