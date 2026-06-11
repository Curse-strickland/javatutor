<template>
  <div class="wallpaper-manager">
    <!-- 壁纸选择器按钮 -->
    <button 
      ref="buttonRef"
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
        <div class="section-title">预设壁纸</div>
        <div class="wallpaper-grid">
          <div 
            v-for="(wp, index) in presetWallpapers" 
            :key="`preset-${index}`"
            class="wallpaper-item"
            :class="{ selected: currentWallpaper === index }"
            @click="selectWallpaper(index)"
          >
            <div class="wallpaper-preview" :style="getWallpaperStyle(wp)">
              <div v-if="currentWallpaper === index" class="check-mark">✓</div>
            </div>
            <span class="wallpaper-name">{{ wp.name }}</span>
          </div>
        </div>

        <!-- 卡片透明度调节 -->
        <div class="opacity-control">
          <label class="opacity-label">
            <span>卡片透明度</span>
            <span class="opacity-value">{{ Math.round(cardOpacity * 100) }}%</span>
          </label>
          <input 
            type="range" 
            min="0.3" 
            max="1" 
            step="0.05" 
            v-model.number="cardOpacity"
            @input="updateCardOpacity"
            class="opacity-slider"
          />
        </div>

      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const panelOpen = ref(false)
const currentWallpaper = ref(0)
const cardOpacity = ref(0.88)  // 默认卡片透明度，对应 rgba(55,55,63,0.88)

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
    value: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 70%)'
  },
  {
    name: '极光渐变',
    type: 'linear',
    value: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 50%, rgba(236,72,153,0.1) 100%)'
  },
  {
    name: '科技蓝',
    type: 'gradient',
    value: 'radial-gradient(circle at 20% 80%, rgba(10,132,255,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(10,132,255,0.08) 0%, transparent 50%)'
  },
  {
    name: '暖色光晕',
    type: 'gradient',
    value: 'radial-gradient(circle at 30% 30%, rgba(251,146,60,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(245,158,11,0.08) 0%, transparent 50%)'
  },
  {
    name: '极简纯色',
    type: 'solid',
    value: '#1a1a1f'
  }
])

onMounted(async () => {
  // 从 localStorage 恢复设置
  const saved = localStorage.getItem('wallpaper-settings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      currentWallpaper.value = settings.current ?? 0
      cardOpacity.value = settings.cardOpacity ?? 0.88
      
      applyWallpaper()
      applyCardOpacity()
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
  currentWallpaper.value = index
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
  return {
    background: wp.value
  }
}

function updateCardOpacity() {
  applyCardOpacity()
  saveSettings()
}

function applyCardOpacity() {
  // 更新CSS变量 --card-bg 的透明度
  const root = document.documentElement
  const baseColor = '55,55,63'  // RGB值
  root.style.setProperty('--card-bg', `rgba(${baseColor},${cardOpacity.value})`)
  
  // 同时更新 --glass 变量
  root.style.setProperty('--glass', `rgba(${baseColor},${cardOpacity.value})`)
}

function applyWallpaper() {
  const wp = presetWallpapers.value[currentWallpaper.value]
  const appShell = document.querySelector('.app-shell')
  
  if (!appShell) return

  // ✅ 先清除所有背景设置
  appShell.style.backgroundImage = ''
  appShell.style.backgroundColor = ''
  appShell.style.backgroundSize = ''
  appShell.style.backgroundPosition = ''
  appShell.style.backgroundRepeat = ''

  if (wp.type === 'image') {
    // 图片壁纸 - 直接设置在app-shell上
    appShell.style.backgroundImage = `url(${wp.value})`
    appShell.style.backgroundSize = 'cover'
    appShell.style.backgroundPosition = 'center'
    appShell.style.backgroundRepeat = 'no-repeat'
    appShell.style.backgroundColor = 'transparent'
  } else if (wp.type === 'solid') {
    // 纯色背景
    appShell.style.backgroundImage = 'none'
    appShell.style.backgroundColor = wp.value
  } else {
    // 渐变壁纸 - 直接设置在app-shell上
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
    cardOpacity: cardOpacity.value
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
  position: fixed;
  top: 60px;
  right: 20px;
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
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

/* 透明度控制 */
.opacity-control {
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.opacity-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.opacity-value {
  color: var(--text-h);
  font-weight: 600;
}

.opacity-slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,0.1);
  outline: none;
  -webkit-appearance: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
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
  transform: translateY(-8px);
}

.wallpaper-panel-enter-to,
.wallpaper-panel-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
