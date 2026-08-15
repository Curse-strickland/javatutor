# 堆栈可视化 — VueFlow 画布 → 色彩标签映射 全历程

> 日期：2026-06-11 ~ 2026-06-12
> 分支：`feat/linked-list-visualization`
> 关联文件：`HeapStackPanel.vue` `ListNodeCard.vue` `StackFrameNode.vue` `ArrayNode.vue` `StackGroupNode.vue` `HeapGroupNode.vue`

## 总览

对堆栈变量展示面板进行了五轮迭代，从文本地址 → PythonTutor 式蓝点连线 → VueFlow 画布自动布局 → 对角线瀑布 → 终极色彩标签映射。

## 路线图

```
文本 "0x5DC2" 地址
  → PythonTutor 风格：蓝点 + 贝塞尔曲线连线
  → VueFlow 画布 + ELK 自动布局 (左→右水平)
  → 手动对角瀑布布局 + BFS 动态排序
  → 弃用连线，色彩标签映射 (最终版)
```

## 轮次 1：VueFlow 画布 + ELK 水平布局

**新增文件：**
| 文件 | 职责 |
|------|------|
| `StackFrameNode.vue` | 栈帧卡片：title + 变量行，ref 变量右侧有独立 Handle 锚点 |
| `ListNodeCard.vue` | 链表节点卡片：val + next 字段，左 target Handle + 右 source Handle |
| `ArrayNode.vue` | 数组卡片：slot 横向排列 |
| `StackGroupNode.vue` | 栈区虚线容器，蓝色调 |
| `HeapGroupNode.vue` | 堆区虚线容器，灰色调 |

**改动：**
- `HeapStackPanel.vue` — 接入 `@vue-flow/core` `@vue-flow/background` `@vue-flow/controls` `elkjs`
- `main.js` — 引入 Vue Flow CSS
- `package.json` — +`@vue-flow/core@1.48.2` `@vue-flow/background` `@vue-flow/controls` `elkjs`

**关键实现：**
- ELK `layered` 算法，`direction: RIGHT`，自动布局栈帧 + ListNode
- 每个栈变量拥有独立 Handle（`top: 60 + i*30`），一对一发射
- 边动画状态机：`hs-edge-enter`(绿闪) / `hs-edge-leave`(红闪) / `hs-edge-reconnect`(蓝闪) / 稳定粒子流
- `fitView({ padding: 0.2, duration: 400 })` 每次 buildGraph 后自动居中
- 数组变量检测：`Array.isArray(val) && heap[name]` → 显示蓝点引用

**踩坑：**
- ELK group 结构导致 NaN 坐标：改 flat layout，手动定位 group 容器
- Handle 错位：VueFlow 默认 `translate(50%, -50%)` 偏移 4px，需补偿 top 值
- SmoothStep 直角线与预期不符：切回默认 bezier
- 边被卡片遮挡：所有边加 `zIndex: 1000`

## 轮次 2：手动对角瀑布 + BFS 动态排序

**问题：** ELK 水平布局导致画布横向拉长，List 节点一字排开缺乏视觉层次。

**方案：**
- 移除 ELK，改用手动对角线定位：`ListNode[i] = (STACK_W + 100 + i*130, 8 + i*120)`
- 加入 BFS 距离排序：每步根据栈引用关系对 ListNode 动态排序，最小化边交叉
- `getFrameItems` 数组引用传递 `refLabel: heapEntry.type`（如 `int[3]`）

**ListNodeCard 纵向化：**
- val/next 从横向并排改为纵向堆叠（`flex-direction: column`）
- 卡片宽度 180→130px，更紧凑
- Handle 改用百分比定位（`top: 50%`, `top: calc(50% + 15px)`）

**BFS 排序算法：**
```
1. 扫描栈引用 → 距离 0
2. BFS 沿 next 链扩展 → 距离 N
3. 排序键: (dist, refIdx, val)
```

## 轮次 3：弃用连线，色彩标签映射（最终版）

**核心理念：** 通过颜色一致性实现视觉联动，零连线。用户凭颜色即可瞬间完成逻辑连线。

**实现：**

### 全局色彩矩阵
8 色高饱和调色板，堆对象按 key 排序取 `index % 8`：
```
#4ade80(绿) #60a5fa(蓝) #c084fc(紫) #fbbf24(琥珀)
#fb7185(玫红) #22d3ee(青) #fdba74(橙) #6ee7b7(翡翠)
```

### 中文别名标签
- ListNode → `[节点1]` `[节点2]` `[节点3]`
- 数组 → `[数组 arr]` `[数据 args]`
- 堆卡片顶部彩色加粗标签替代 0x 地址，左边框使用对象专属色

### 栈区显示
- 引用变量 `head = [节点1]`（绿色文字）
- 数组 `arr = [数组 arr]`（专属色标签）
- 无蓝点、无 hex 地址

### 隔空呼吸灯交互
- `hoveredRefId` ref 驱动跨区高亮
- 悬浮栈变量 → 对应堆卡片 `border-color` 变专属色 + `box-shadow` 发光 + `scale(1.02)`
- 悬浮堆字段引用 → 同样触发目标卡片高亮
- `transition: all 0.25s cubic-bezier(.22,.9,.27,1)`

### 规整排版
- 栈区 `flex: 0 0 42%`，堆区 `flex: 1`
- 堆区卡片纵向流式堆叠，无连线无重叠
- 移除 SVG overlay、虚线分隔符、ResizeObserver
- 响应式：移动端纵向排列

### 色彩流转动画
- 引用标签 `transition: color 0.2s ease`
- `curr.next = prev` 执行时，next 字段颜色从旧目标色平滑过渡到新目标色

## 技术要点总结

| 技术点 | 最终方案 |
|--------|---------|
| 布局 | CSS Grid/Flex 纯 DOM 流式布局 |
| 引用标识 | 中文别名标签 + 颜色映射 |
| 交互 | hoveredRefId 跨区联动 |
| 动画 | CSS transition 颜色流转 + hover 高亮 |
| 依赖 | 零新增（elkjs/VueFlow 保留但 HeapStackPanel 不再使用） |

## 验证

```bash
cd frontend && npm run build  # 成功
```

浏览器 `localhost:5173` → ReverseList → 单步执行验证：
1. 堆区显示 `[节点1]` `[节点2]` `[节点3]`，无 0x 地址
2. 栈区 head/curr/prev/next 显示彩色标签，颜色与对应卡片一致
3. 鼠标悬浮 → 目标卡片呼吸灯高亮
4. 颜色一致性 → 无连线也能瞬间识别引用关系
5. 卡片垂直排列不重叠
