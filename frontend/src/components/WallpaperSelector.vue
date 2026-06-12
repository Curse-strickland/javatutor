<template>
  <div class="wallpaper-manager">
    <!-- 壁纸选择器按钮 -->
    <button 
      class="wallpaper-btn" 
      @click="togglePanel"
      :class="{ active: panelOpen }"
      title="更换壁纸"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </button>

    <!-- 壁纸选择面板 -->
    <transition name="wallpaper-panel">
      <div v-if="panelOpen" class="wallpaper-panel card">
        <div class="panel-header">
          <span class="panel-title">选择壁纸</span>
          <button class="close-btn" @click="togglePanel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- 预设壁纸网格 -->
        <div class="section-header">
          <span class="section-title">预设壁纸</span>
          <div v-if="presetTotalPages > 1" class="pagination-controls">
            <button 
              class="page-btn" 
              @click="prevPresetPage"
              :disabled="presetCurrentPage === 0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span class="page-indicator">{{ presetCurrentPage + 1 }}/{{ presetTotalPages }}</span>
            <button 
              class="page-btn" 
              @click="nextPresetPage"
              :disabled="presetCurrentPage >= presetTotalPages - 1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="wallpaper-grid">
          <div 
            v-for="(wp, index) in currentPresetWallpapers" 
            :key="`preset-${index}`"
            class="wallpaper-item"
            :class="{ selected: currentWallpaper === (presetCurrentPage * PRESET_PAGE_SIZE + index) }"
            @click="selectWallpaper(presetCurrentPage * PRESET_PAGE_SIZE + index)"
          >
            <div class="wallpaper-preview" :style="getWallpaperStyle(wp)">
              <div v-if="currentWallpaper === (presetCurrentPage * PRESET_PAGE_SIZE + index)" class="check-mark">✓</div>
            </div>
            <span class="wallpaper-name">{{ wp.name }}</span>
          </div>
        </div>

        <!-- 自定义上传 -->
        <div class="custom-upload">
          <label class="upload-label">
            <input 
              type="file" 
              accept="image/*" 
              @change="handleCustomUpload"
              class="file-input"
            />
            <span class="upload-text">+ 上传自定义壁纸</span>
          </label>
        </div>

        <!-- 自定义壁纸列表 -->
        <div v-if="customWallpapers.length > 0" class="custom-section">
          <div class="section-header">
            <span class="section-title">我的壁纸</span>
            <div v-if="customWallpapers.length > 4" class="pagination-controls">
              <button 
                class="page-btn" 
                @click="prevCustomPage"
                :disabled="customCurrentPage === 0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span class="page-indicator">{{ customCurrentPage + 1 }}/{{ customTotalPages }}</span>
              <button 
                class="page-btn" 
                @click="nextCustomPage"
                :disabled="customCurrentPage >= customTotalPages - 1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="wallpaper-grid">
            <div 
              v-for="(wp, index) in currentCustomWallpapers" 
              :key="wp.id"
              class="wallpaper-item custom-item"
              :class="{ selected: currentWallpaper === (presetWallpapers.length + customCurrentPage * PAGE_SIZE + index) }"
              @click="selectWallpaper(presetWallpapers.length + customCurrentPage * PAGE_SIZE + index)"
            >
              <div class="wallpaper-preview" :style="getWallpaperStyle(wp)">
                <div v-if="currentWallpaper === (presetWallpapers.length + customCurrentPage * PAGE_SIZE + index)" class="check-mark">✓</div>
                <button 
                  class="delete-btn" 
                  @click="deleteCustomWallpaper(index, $event)"
                  title="删除此壁纸"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
              <span class="wallpaper-name">{{ wp.name }}</span>
            </div>
          </div>
        </div>

        <!-- 卡片透明度调节 -->
        <div class="opacity-control" :class="{ locked: isOpacityLocked }">
          <label class="opacity-label">
            <span>卡片透明度</span>
            <span class="opacity-value">{{ Math.round(cardOpacity * 100) }}%</span>
          </label>
          <div
            class="opacity-track"
            :class="{ disabled: isOpacityLocked }"
            ref="opacityTrackRef"
            @click="!isOpacityLocked && onOpacityTrackClick($event)"
          >
            <div class="opacity-fill" :style="{ width: ((cardOpacity - 0.3) / 0.7 * 100) + '%' }" />
            <div
              v-if="!isOpacityLocked"
              class="opacity-thumb"
              :style="{ left: ((cardOpacity - 0.3) / 0.7 * 100) + '%' }"
              @pointerdown.stop="startOpacityDrag"
            />
          </div>
        </div>

      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, inject } from 'vue'

const panelOpen = ref(false)
const currentWallpaper = ref(0)
const opacityTrackRef = ref(null)
const savedOpacity = ref(0.88) // restore when leaving 默认网格

const videoSrc = inject('videoSrc', ref(''))
const isOpacityLocked = computed(() => currentWallpaper.value === 0)
const cardOpacity = ref(0.88)  // 默认卡片透明度，对应 rgba(55,55,63,0.88)
const customWallpapers = ref([])  // 支持多个自定义壁纸

// 分页常量与状态
const PRESET_PAGE_SIZE = 2 // 预设壁纸每页显示数量
const PAGE_SIZE = 4        // 自定义壁纸每页显示数量

const presetCurrentPage = ref(0)
const customCurrentPage = ref(0)

// 预设壁纸配置
const presetWallpapers = ref([
  {
    name: '默认网格',
    type: 'gradient',
    value: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)'
  },
  {
    name: '深邃星空',
    type: 'gradient',
    value: 'radial-gradient(ellipse at 50% 0%, rgba(120,60,200,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(40,30,120,0.12) 0%, transparent 50%), radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)'
  },
  {
    name: 'Train Girl',
    type: 'video',
    value: '/wallpapers/train-girl.mp4'
  }
])

// 合并预设和自定义壁纸
const wallpapers = computed(() => {
  return [...presetWallpapers.value, ...customWallpapers.value]
})

// 预设壁纸分页计算
const presetTotalPages = computed(() => {
  return Math.ceil(presetWallpapers.value.length / PRESET_PAGE_SIZE)
})

const currentPresetWallpapers = computed(() => {
  const start = presetCurrentPage.value * PRESET_PAGE_SIZE
  const end = start + PRESET_PAGE_SIZE
  return presetWallpapers.value.slice(start, end)
})

// 预设壁纸翻页
function nextPresetPage() {
  if (presetCurrentPage.value < presetTotalPages.value - 1) {
    presetCurrentPage.value++
  }
}

function prevPresetPage() {
  if (presetCurrentPage.value > 0) {
    presetCurrentPage.value--
  }
}

// 自定义壁纸分页计算
const customTotalPages = computed(() => {
  return Math.ceil(customWallpapers.value.length / PAGE_SIZE)
})

const currentCustomWallpapers = computed(() => {
  const start = customCurrentPage.value * PAGE_SIZE
  const end = start + PAGE_SIZE
  return customWallpapers.value.slice(start, end)
})

// 自定义壁纸翻页
function nextCustomPage() {
  if (customCurrentPage.value < customTotalPages.value - 1) {
    customCurrentPage.value++
  }
}

function prevCustomPage() {
  if (customCurrentPage.value > 0) {
    customCurrentPage.value--
  }
}

onMounted(async () => {
  // 从 localStorage 恢复设置
  const saved = localStorage.getItem('wallpaper-settings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      currentWallpaper.value = settings.current ?? 0
      cardOpacity.value = settings.cardOpacity ?? 0.88
      
      // 恢复自定义壁纸列表
      if (settings.customWallpapers && Array.isArray(settings.customWallpapers)) {
        customWallpapers.value = settings.customWallpapers.map((wp, idx) => ({
          id: `custom-${idx}`,
          name: wp.name || `自定义 ${idx + 1}`,
          type: 'image',
          value: wp.value
        }))
      }

      // 根据当前选中的壁纸调整分页，确保选中的壁纸可见
      if (currentWallpaper.value < presetWallpapers.value.length) {
        presetCurrentPage.value = Math.floor(currentWallpaper.value / PRESET_PAGE_SIZE)
      } else {
        const customIndex = currentWallpaper.value - presetWallpapers.value.length
        if (customIndex >= 0) {
          customCurrentPage.value = Math.floor(customIndex / PAGE_SIZE)
        }
      }

      // 默认网格强制 100% 不透明
      if (currentWallpaper.value === 0) {
        savedOpacity.value = settings.cardOpacity ?? 0.88
        cardOpacity.value = 1.0
      }

      applyWallpaper()
      applyCardOpacity()
      // Restore video state for video-type wallpapers
      const wp = wallpapers.value[currentWallpaper.value]
      if (wp && wp.type === 'video') videoSrc.value = wp.value
    } catch (e) {
      console.error('Failed to load wallpaper settings:', e)
      applyDefaultSettings()
    }
  } else {
    // 应用默认设置
    applyDefaultSettings()
  }
})

function applyDefaultSettings() {
  applyWallpaper()
  applyCardOpacity()
}

function togglePanel() {
  panelOpen.value = !panelOpen.value
}

function selectWallpaper(index) {
  const wasLocked = isOpacityLocked.value
  currentWallpaper.value = index

  // 如果选择的是预设壁纸，切换到对应的分页
  if (index < presetWallpapers.value.length) {
    presetCurrentPage.value = Math.floor(index / PRESET_PAGE_SIZE)
  } else {
    const customIndex = index - presetWallpapers.value.length
    if (customIndex >= 0) {
      customCurrentPage.value = Math.floor(customIndex / PAGE_SIZE)
    }
  }

  // 默认网格：锁定 100% 不透明，VSCode 风格
  if (index === 0) {
    if (!wasLocked) savedOpacity.value = cardOpacity.value
    cardOpacity.value = 1.0
    applyCardOpacity()
  } else if (wasLocked) {
    // 从默认网格切换到其他壁纸：恢复之前的透明度
    cardOpacity.value = savedOpacity.value
    applyCardOpacity()
  }

  applyWallpaper()
  saveSettings()
}

function getWallpaperStyle(wp) {
  if (wp.type === 'image') {
    return {
      backgroundImage: `url(${wp.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  if (wp.type === 'video') {
    return {
      backgroundImage: 'url(/wallpapers/train-girl-preview.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {
    background: wp.value
  }
}

function handleCustomUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  // 验证文件大小（限制为 5MB）
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    // 生成唯一ID和名称
    const timestamp = Date.now()
    const customWallpaper = {
      id: `custom-${timestamp}`,
      name: file.name.replace(/\.[^/.]+$/, ''),  // 移除文件扩展名
      type: 'image',
      value: e.target.result
    }
    
    // 添加到自定义壁纸列表
    customWallpapers.value.push(customWallpaper)
    
    // 计算新壁纸的索引
    const newIndex = presetWallpapers.value.length + customWallpapers.value.length - 1
    
    // 自动选中新上传的壁纸
    currentWallpaper.value = newIndex
    
    // 自动切换到对应的页面
    const customIndex = customWallpapers.value.length - 1
    customCurrentPage.value = Math.floor(customIndex / PAGE_SIZE)
    
    applyWallpaper()
    saveSettings()
    
    // 清空input，允许重复上传同一文件
    event.target.value = ''
  }
  reader.onerror = () => {
    alert('读取文件失败，请重试')
    event.target.value = ''
  }
  reader.readAsDataURL(file)
}

// 删除自定义壁纸
function deleteCustomWallpaper(index, event) {
  event.stopPropagation()  // 阻止触发选择事件
  
  // 如果删除的是当前选中的壁纸，切换到第一个预设壁纸
  const globalIndex = presetWallpapers.value.length + index
  if (currentWallpaper.value === globalIndex) {
    currentWallpaper.value = 0
    customCurrentPage.value = 0  // 重置到第一页
  } else if (currentWallpaper.value > globalIndex) {
    // 如果当前选中的在删除项之后，需要调整索引
    currentWallpaper.value--
  }
  
  // 从数组中移除
  customWallpapers.value.splice(index, 1)
  
  // 调整当前页面，确保不超出范围
  const totalPages = Math.ceil(customWallpapers.value.length / PAGE_SIZE)
  if (customCurrentPage.value >= totalPages && totalPages > 0) {
    customCurrentPage.value = totalPages - 1
  } else if (totalPages === 0) {
    customCurrentPage.value = 0
  }
  
  applyWallpaper()
  saveSettings()
}

let saveOpacityTimer = null
function applyCardOpacity() {
  const root = document.documentElement
  const baseColor = '55,55,63'
  root.style.setProperty('--card-bg', `rgba(${baseColor},${cardOpacity.value})`)
  root.style.setProperty('--glass', `rgba(${baseColor},${cardOpacity.value})`)
  document.body.classList.toggle('wallpaper-mesh', isOpacityLocked.value)
}

// --- Custom opacity slider with pointer capture (same pattern as progress bar) ---
function updateOpacityFromEvent(e) {
  if (!opacityTrackRef.value) return
  const rect = opacityTrackRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  // Map ratio [0,1] → opacity [0.3, 1.0], snap to 0.01 steps
  const raw = 0.3 + ratio * 0.7
  cardOpacity.value = Math.round(raw / 0.01) * 0.01
}

function onOpacityTrackClick(e) {
  updateOpacityFromEvent(e)
  applyCardOpacity()
  clearTimeout(saveOpacityTimer)
  saveOpacityTimer = setTimeout(() => saveSettings(), 300)
}

function startOpacityDrag(e) {
  e.target.setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onOpacityMove)
  window.addEventListener('pointerup', onOpacityUp, { once: true })
}

function onOpacityMove(e) {
  updateOpacityFromEvent(e)
  applyCardOpacity()
}

function onOpacityUp() {
  window.removeEventListener('pointermove', onOpacityMove)
  clearTimeout(saveOpacityTimer)
  saveOpacityTimer = setTimeout(() => saveSettings(), 300)
}

function applyWallpaper() {
  const wp = wallpapers.value[currentWallpaper.value]
  const appShell = document.querySelector('.app-shell')

  // Disable video by default, re-enable below if video type
  videoSrc.value = ''

  if (!appShell) return

  // ✅ 先清除所有背景设置
  appShell.style.backgroundImage = ''
  appShell.style.backgroundColor = ''
  appShell.style.backgroundSize = ''
  appShell.style.backgroundPosition = ''
  appShell.style.backgroundRepeat = ''

  if (wp.type === 'image') {
    appShell.style.backgroundImage = `url(${wp.value})`
    appShell.style.backgroundSize = 'cover'
    appShell.style.backgroundPosition = 'center'
    appShell.style.backgroundRepeat = 'no-repeat'
    appShell.style.backgroundColor = 'transparent'
  } else if (wp.type === 'video') {
    appShell.style.backgroundColor = 'transparent'
    videoSrc.value = wp.value
  } else if (wp.type === 'solid') {
    appShell.style.backgroundImage = 'none'
    appShell.style.backgroundColor = wp.value
  } else {
    appShell.style.backgroundImage = wp.value
    appShell.style.backgroundColor = 'transparent'
  }

  // 保存当前壁纸索引
  appShell.dataset.wallpaper = currentWallpaper.value

  // 应用卡片透明度
  applyCardOpacity()
}

function saveSettings() {
  const settings = {
    current: currentWallpaper.value,
    cardOpacity: cardOpacity.value,
    customWallpapers: customWallpapers.value.map(wp => ({
      name: wp.name,
      value: wp.value
    }))
  }
  localStorage.setItem('wallpaper-settings', JSON.stringify(settings))
}
</script>

<style scoped>
.wallpaper-manager {
  position: relative;
}

.wallpaper-btn {
  background: transparent;
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  position: relative;
  z-index: 100;
}

.wallpaper-btn:hover {
  color: var(--text-h);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.wallpaper-btn.active {
  color: var(--primary);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

/* 壁纸选择面板 */
.wallpaper-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 320px;
  padding: 16px;
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  z-index: 1000;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
}

.close-btn {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.close-btn:hover {
  color: var(--text-h);
  background: rgba(255,255,255,0.08);
}

/* 分组标题 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 分页控制 */
.page-btn {
  background: transparent;
  border: 1px solid var(--border);
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  color: var(--text-h);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  min-width: 40px;
  text-align: center;
}

/* 壁纸网格 */
.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.wallpaper-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.wallpaper-item:hover {
  border-color: var(--accent-border);
  transform: translateY(-2px);
}

.wallpaper-item.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

.wallpaper-preview {
  width: 100%;
  height: 80px;
  position: relative;
  background: var(--bg);
}

.check-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  background: var(--primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 16px;
}

.wallpaper-name {
  display: block;
  padding: 8px;
  font-size: 12px;
  text-align: center;
  color: var(--text-muted);
  background: rgba(0,0,0,0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wallpaper-item.selected .wallpaper-name {
  color: var(--primary);
  font-weight: 600;
}

/* 自定义壁纸项 */
.custom-item {
  position: relative;
}

.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background: rgba(239, 68, 68, 0.9);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease;
  z-index: 10;
}

.custom-item:hover .delete-btn {
  opacity: 1;
  transform: scale(1);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 1);
  transform: scale(1.1);
}

/* 自定义上传 */
.custom-upload {
  margin: 16px 0;
}

.upload-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-label:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.file-input {
  display: none;
}

.upload-text {
  font-size: 13px;
  color: var(--text-muted);
}

/* 自定义壁纸分组 */
.custom-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* 透明度控制 */
.opacity-control {
	padding-top: 12px;
	border-top: 1px solid var(--border);
}

.opacity-label {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 10px;
	font-size: 13px;
	color: var(--text-muted);
}

.opacity-value {
	color: var(--text-h);
	font-weight: 600;
	font-size: 13px;
	background: rgba(255,255,255,0.05);
	padding: 2px 10px;
	border-radius: 12px;
	min-width: 44px;
	text-align: center;
}

/* Custom opacity track (same pattern as progress bar) */
.opacity-track {
	width: 100%;
	height: 6px;
	background: rgba(255,255,255,0.08);
	border-radius: 3px;
	position: relative;
	cursor: pointer;
	transition: height 0.15s;
}
.opacity-track:hover { height: 8px; }
.opacity-track.disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.opacity-track.disabled:hover { height: 6px; }

.opacity-control.locked .opacity-value {
  background: var(--accent-bg);
  color: var(--primary);
}

.opacity-fill {
	position: absolute;
	top: 0; left: 0;
	height: 100%;
	background: linear-gradient(90deg, var(--primary), var(--primary-600));
	border-radius: 3px;
	pointer-events: none;
}

.opacity-thumb {
	position: absolute;
	top: 50%;
	width: 16px;
	height: 16px;
	background: #fff;
	border: 2px solid var(--primary);
	border-radius: 50%;
	transform: translate(-50%, -50%);
	cursor: grab;
	box-shadow: 0 2px 6px rgba(0,0,0,0.3);
	transition: transform 0.1s, box-shadow 0.15s;
	z-index: 2;
}
.opacity-thumb:hover {
	transform: translate(-50%, -50%) scale(1.2);
	box-shadow: 0 2px 10px rgba(99,102,241,0.5);
}
.opacity-thumb:active {
	cursor: grabbing;
	transform: translate(-50%, -50%) scale(1.15);
}

/* 面板动画 */
.wallpaper-panel-enter-active {
  transition: all 0.25s cubic-bezier(.22,.9,.27,1);
}

.wallpaper-panel-leave-active {
  transition: all 0.2s cubic-bezier(.22,.9,.27,1);
}

.wallpaper-panel-enter-from,
.wallpaper-panel-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.wallpaper-panel-enter-to,
.wallpaper-panel-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
