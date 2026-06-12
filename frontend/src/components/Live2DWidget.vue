<template>
  <!-- 
    看板娘拖拽包装器
    在 autoload.js 创建 #waifu 节点后，为其添加拖拽功能
  -->
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

let waifuEl = null
let isDragging = false
let offsetX = 0
let offsetY = 0
let rafId = null
let initialRight = null
let initialBottom = null

function onPointerDown(e) {
  waifuEl = document.getElementById('waifu')
  if (!waifuEl) return

  // 只在点击看板娘主体（非工具栏按钮）时启动拖拽
  const target = e.target
  if (target.closest('#waifu-tool') || target.closest('.waifu-tool')) return

  isDragging = true
  waifuEl.style.transition = 'none'

  const rect = waifuEl.getBoundingClientRect()
  offsetX = e.clientX - rect.left
  offsetY = e.clientY - rect.top

  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp, { once: true })
  e.preventDefault()
}

function onPointerMove(e) {
  if (!isDragging || !waifuEl) return

  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    // 计算新位置（left/top 相对于 viewport）
    const newLeft = e.clientX - offsetX
    const newTop = e.clientY - offsetY

    // 转换回 right/bottom（因为原 CSS 用 right/bottom 定位）
    const newRight = window.innerWidth - newLeft - waifuEl.offsetWidth
    const newBottom = window.innerHeight - newTop - waifuEl.offsetHeight

    // 限制不超出屏幕
    const clampedRight = Math.max(0, Math.min(newRight, window.innerWidth - 80))
    const clampedBottom = Math.max(0, Math.min(newBottom, window.innerHeight - 80))

    waifuEl.style.right = clampedRight + 'px'
    waifuEl.style.bottom = clampedBottom + 'px'
    waifuEl.style.left = 'auto'
    waifuEl.style.top = 'auto'

    // 保存位置到 localStorage
    try {
      localStorage.setItem('waifu-position', JSON.stringify({ right: clampedRight, bottom: clampedBottom }))
    } catch (e) { /* ignore */ }
  })
}

function onPointerUp() {
  isDragging = false
  if (waifuEl) waifuEl.style.transition = ''
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
      // 恢复上次保存的位置
      try {
        const saved = localStorage.getItem('waifu-position')
        if (saved) {
          const pos = JSON.parse(saved)
          waifuEl.style.right = pos.right + 'px'
          waifuEl.style.bottom = pos.bottom + 'px'
          waifuEl.style.left = 'auto'
          waifuEl.style.top = 'auto'
        }
      } catch (e) { /* ignore */ }

      // 修改光标提示可拖拽
      waifuEl.style.cursor = 'grab'
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
