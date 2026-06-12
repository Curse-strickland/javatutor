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
                  class="edit-btn" 
                  @click="openEditorForExisting(index, $event)"
                  title="编辑此壁纸"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 4 1.5-1.5L18.5 2.5z"/>
                  </svg>
                </button>
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
        <div class="opacity-control">
          <label class="opacity-label">
            <span>卡片透明度</span>
            <span class="opacity-value">{{ Math.round(cardOpacity * 100) }}%</span>
          </label>
          <div class="opacity-slider-wrapper" ref="opacitySliderRef">
            <div class="opacity-track" @click="onOpacityClick">
              <div class="opacity-fill" :style="{ width: ((cardOpacity - 0.3) / 0.7 * 100) + '%' }"/>
              <div
                class="opacity-thumb"
                :style="{ left: ((cardOpacity - 0.3) / 0.7 * 100) + '%' }"
                @pointerdown.stop="startOpacityDrag"
              />
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 壁纸编辑器模态框 -->
    <transition name="editor-modal">
      <div v-if="showEditor" class="editor-overlay" @click.self="closeEditor">
        <div class="editor-modal card">
          <div class="editor-header">
            <span class="editor-title">编辑壁纸</span>
            <button class="close-btn" @click="closeEditor">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="editor-body">
            <!-- 预览区域 -->
            <div class="preview-area">
              <canvas ref="editorCanvas" class="editor-canvas"></canvas>
            </div>

            <!-- 控制面板 -->
            <div class="editor-controls">
              <!-- 缩放比例 -->
              <div class="control-group">
                <label class="control-label">
                  <span>缩放比例</span>
                  <span class="control-value">{{ Math.round(scale * 100) }}%</span>
                </label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="3" 
                  step="0.05" 
                  v-model.number="scale"
                  class="control-slider"
                />
              </div>

              <!-- 旋转角度 -->
              <div class="control-group">
                <label class="control-label">
                  <span>旋转角度</span>
                  <span class="control-value">{{ rotation }}°</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  step="1" 
                  v-model.number="rotation"
                  class="control-slider"
                />
              </div>

              <!-- 裁剪比例 -->
              <div class="control-group">
                <label class="control-label">裁剪比例</label>
                <div class="ratio-buttons">
                  <button 
                    class="ratio-btn" 
                    :class="{ active: cropRatio === 'free' }"
                    @click="cropRatio = 'free'"
                  >
                    自由
                  </button>
                  <button 
                    class="ratio-btn" 
                    :class="{ active: cropRatio === '16:9' }"
                    @click="cropRatio = '16:9'"
                  >
                    16:9
                  </button>
                  <button 
                    class="ratio-btn" 
                    :class="{ active: cropRatio === '4:3' }"
                    @click="cropRatio = '4:3'"
                  >
                    4:3
                  </button>
                  <button 
                    class="ratio-btn" 
                    :class="{ active: cropRatio === '1:1' }"
                    @click="cropRatio = '1:1'"
                  >
                    1:1
                  </button>
                </div>
              </div>

              <!-- 位置调整 -->
              <div class="control-group">
                <label class="control-label">位置调整</label>
                <div class="position-controls">
                  <button class="pos-btn" @click="adjustPosition('up')">↑</button>
                  <div class="pos-row">
                    <button class="pos-btn" @click="adjustPosition('left')">←</button>
                    <button class="pos-btn" @click="adjustPosition('right')">→</button>
                  </div>
                  <button class="pos-btn" @click="adjustPosition('down')">↓</button>
                </div>
              </div>

              <!-- 重置按钮 -->
              <button class="reset-btn" @click="resetEditor">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                重置
              </button>
            </div>
          </div>

          <div class="editor-footer">
            <button class="cancel-btn" @click="closeEditor">取消</button>
            <button class="apply-btn" @click="applyEdit">应用</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'

const panelOpen = ref(false)
const currentWallpaper = ref(0)
const cardOpacity = ref(0.88)  // 默认卡片透明度，对应 rgba(55,55,63,0.88)
const customWallpapers = ref([])  // 支持多个自定义壁纸

// 透明度滑块引用
const opacitySliderRef = ref(null)

// 壁纸编辑器状态
const showEditor = ref(false)
const editorCanvas = ref(null)
const editingWallpaper = ref(null)  // 当前正在编辑的壁纸索引
const scale = ref(1)  // 缩放比例
const rotation = ref(0)  // 旋转角度
const cropRatio = ref('free')  // 裁剪比例: 'free', '16:9', '4:3', '1:1'
const positionX = ref(0)  // X轴偏移
const positionY = ref(0)  // Y轴偏移
const originalImage = ref(null)  // 原始图片对象

// 分页常量与状态
const PRESET_PAGE_SIZE = 4 // 预设壁纸每页显示数量
const PAGE_SIZE = 4        // 自定义壁纸每页显示数量

const presetCurrentPage = ref(0)
const customCurrentPage = ref(0)

// 预设壁纸配置（只保留默认网格）
const presetWallpapers = ref([
  {
    name: '默认网格',
    type: 'gradient',
    value: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)'
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
  
  // 如果选择的是预设壁纸，切换到对应的分页
  if (index < presetWallpapers.value.length) {
    presetCurrentPage.value = Math.floor(index / PRESET_PAGE_SIZE)
  } else {
    // 如果选择的是自定义壁纸，计算其在自定义列表中的索引并切换分页
    const customIndex = index - presetWallpapers.value.length
    if (customIndex >= 0) {
      customCurrentPage.value = Math.floor(customIndex / PAGE_SIZE)
    }
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
      value: e.target.result,
      edited: false  // 标记是否经过编辑
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
    
    // 打开编辑器
    openEditor(customWallpapers.value.length - 1, e.target.result)
    
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

// 打开壁纸编辑器
function openEditor(index, imageDataUrl) {
  editingWallpaper.value = index
  showEditor.value = true
  
  // 重置编辑器状态
  scale.value = 1
  rotation.value = 0
  cropRatio.value = 'free'
  positionX.value = 0
  positionY.value = 0
  
  // 加载图片
  const img = new Image()
  img.onload = () => {
    originalImage.value = img
    nextTick(() => {
      drawEditorCanvas()
    })
  }
  img.src = imageDataUrl
}

// 为已存在的壁纸打开编辑器
function openEditorForExisting(index, event) {
  event.stopPropagation()  // 阻止触发选择事件
  
  const wallpaper = customWallpapers.value[index]
  openEditor(index, wallpaper.value)
}

// 关闭编辑器
function closeEditor() {
  showEditor.value = false
  editingWallpaper.value = null
  originalImage.value = null
}

// 绘制编辑器画布
function drawEditorCanvas() {
  if (!editorCanvas.value || !originalImage.value) return
  
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  
  // 设置画布尺寸（固定为 800x600）
  canvas.width = 800
  canvas.height = 600
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 保存上下文
  ctx.save()
  
  // 移动到画布中心
  ctx.translate(canvas.width / 2 + positionX.value, canvas.height / 2 + positionY.value)
  
  // 旋转
  ctx.rotate(rotation.value * Math.PI / 180)
  
  // 缩放
  ctx.scale(scale.value, scale.value)
  
  // 绘制图片（居中）
  const img = originalImage.value
  const imgWidth = img.width
  const imgHeight = img.height
  
  // 计算裁剪区域
  let cropWidth = imgWidth
  let cropHeight = imgHeight
  
  if (cropRatio.value !== 'free') {
    const [ratioW, ratioH] = cropRatio.value.split(':').map(Number)
    const targetRatio = ratioW / ratioH
    const currentRatio = imgWidth / imgHeight
    
    if (currentRatio > targetRatio) {
      // 图片太宽，按高度裁剪
      cropHeight = imgHeight
      cropWidth = imgHeight * targetRatio
    } else {
      // 图片太高，按宽度裁剪
      cropWidth = imgWidth
      cropHeight = imgWidth / targetRatio
    }
  }
  
  // 绘制裁剪后的图片
  const sx = (imgWidth - cropWidth) / 2
  const sy = (imgHeight - cropHeight) / 2
  
  ctx.drawImage(
    img,
    sx, sy, cropWidth, cropHeight,  // 源矩形
    -cropWidth / 2, -cropHeight / 2, cropWidth, cropHeight  // 目标矩形
  )
  
  // 恢复上下文
  ctx.restore()
  
  // 绘制裁剪框提示（如果是自由模式则不显示）
  if (cropRatio.value !== 'free') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    
    const [ratioW, ratioH] = cropRatio.value.split(':').map(Number)
    const boxWidth = 400
    const boxHeight = boxWidth * (ratioH / ratioW)
    
    ctx.strokeRect(
      (canvas.width - boxWidth) / 2,
      (canvas.height - boxHeight) / 2,
      boxWidth,
      boxHeight
    )
  }
}

// 调整位置
function adjustPosition(direction) {
  const step = 10
  switch (direction) {
    case 'up':
      positionY.value -= step
      break
    case 'down':
      positionY.value += step
      break
    case 'left':
      positionX.value -= step
      break
    case 'right':
      positionX.value += step
      break
  }
  drawEditorCanvas()
}

// 重置编辑器
function resetEditor() {
  scale.value = 1
  rotation.value = 0
  cropRatio.value = 'free'
  positionX.value = 0
  positionY.value = 0
  drawEditorCanvas()
}

// 应用编辑
function applyEdit() {
  if (editingWallpaper.value === null || !originalImage.value) return
  
  // 将画布内容转换为 Data URL
  const editedDataUrl = editorCanvas.value.toDataURL('image/jpeg', 0.9)
  
  // 更新壁纸数据
  const wallpaper = customWallpapers.value[editingWallpaper.value]
  wallpaper.value = editedDataUrl
  wallpaper.edited = true
  wallpaper.name += ' (已编辑)'
  
  // 重新应用壁纸
  applyWallpaper()
  saveSettings()
  
  // 关闭编辑器
  closeEditor()
}

// 监听编辑器状态变化，重绘画布
watch([scale, rotation, cropRatio, positionX, positionY], () => {
  if (showEditor.value) {
    drawEditorCanvas()
  }
})

// 透明度滑块拖动状态
const isDraggingOpacity = ref(false)

// 开始拖动透明度滑块
const startOpacityDrag = (e) => {
  isDraggingOpacity.value = true
  e.target.setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onOpacityMove)
  window.addEventListener('pointerup', onOpacityUp, { once: true })
}

// 拖动过程中更新透明度
const onOpacityMove = (e) => {
  if (!isDraggingOpacity.value || !opacitySliderRef.value) return
  const rect = opacitySliderRef.value.querySelector('.opacity-track').getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  // 映射到 0.3 - 1.0 范围
  cardOpacity.value = 0.3 + ratio * 0.7
  updateCardOpacity()
}

// 结束拖动
const onOpacityUp = () => {
  isDraggingOpacity.value = false
  window.removeEventListener('pointermove', onOpacityMove)
}

// 点击轨道跳转到对应位置
const onOpacityClick = (e) => {
  if (!opacitySliderRef.value) return
  const rect = opacitySliderRef.value.querySelector('.opacity-track').getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  // 映射到 0.3 - 1.0 范围
  cardOpacity.value = 0.3 + ratio * 0.7
  updateCardOpacity()
}

function updateCardOpacity() {
  applyCardOpacity()
  saveSettings()
}

function applyCardOpacity() {
  // 更新CSS变量 --card-bg 的透明度
  const root = document.documentElement
  const baseColor = '55,55,63'  // RGB值
  // 修复透明度反的问题：滑块值越大，卡片越透明
  // 使用反向映射：sliderValue 0.3->1.0 映射到 alpha 1.0->0.3
  const alpha = 1.3 - cardOpacity.value;
  root.style.setProperty('--card-bg', `rgba(${baseColor},${alpha})`)
  
  // 同时更新 --glass 变量

}

function applyWallpaper() {
  const wp = wallpapers.value[currentWallpaper.value]
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
  z-index: 100;
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
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 分页控制 */
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

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
  position: relative;
  width: 100%;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}

.check-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.edit-btn,
.delete-btn {
  position: absolute;
  top: 4px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
}

.edit-btn {
  right: 32px;
}

.delete-btn {
  right: 4px;
}

.wallpaper-item:hover .edit-btn,
.wallpaper-item:hover .delete-btn {
  opacity: 1;
}

.edit-btn:hover,
.delete-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
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
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.opacity-value {
  color: var(--text-h);
  font-weight: 600;
}

/* 自定义透明度滑块 */
.opacity-slider-wrapper {
  width: 100%;
  margin: 10px 0;
}

.opacity-track {
  position: relative;
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.opacity-track:hover {
  background: rgba(255, 255, 255, 0.15);
}

.opacity-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  pointer-events: none;
  transition: width 0.1s ease-out;
}

.opacity-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  background: white;
  border: 2px solid var(--primary);
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: grab;
  pointer-events: auto;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.opacity-thumb:hover {
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
}

.opacity-thumb:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.15);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
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

/* 壁纸编辑器模态框 */
.editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.editor-modal {
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.editor-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-h);
}

.editor-body {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: auto;
}

.preview-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  min-height: 400px;
}

.editor-canvas {
  max-width: 100%;
  max-height: 100%;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.editor-controls {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
}

.control-value {
  color: var(--text-h);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.control-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.control-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.control-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.ratio-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.ratio-btn {
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.ratio-btn:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.ratio-btn.active {
  border-color: var(--primary);
  background: var(--primary-bg);
  color: var(--primary);
}

.position-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.pos-row {
  display: flex;
  gap: 8px;
}

.pos-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-h);
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pos-btn:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  margin-top: auto;
}

.reset-btn:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--text-h);
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.cancel-btn {
  padding: 10px 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.cancel-btn:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--text-h);
}

.apply-btn {
  padding: 10px 24px;
  border: none;
  background: var(--primary);
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.apply-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

/* 编辑器动画 */
.editor-modal-enter-active,
.editor-modal-leave-active {
  transition: all 0.3s ease;
}

.editor-modal-enter-from,
.editor-modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.editor-modal-enter-to,
.editor-modal-leave-from {
  opacity: 1;
  transform: scale(1);
}
</style>