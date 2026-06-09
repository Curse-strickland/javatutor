# 数据结构可视化画布组件

## 概述

本项目实现了两种数据结构可视化画布组件，用于展示链表和递归调用栈的执行过程。

## 组件列表

### 1. LinkedListCanvas.vue - 链表可视化

**功能**：
- 使用SVG绘制链表节点（方框）和指针（箭头）
- 支持高亮当前操作的节点
- 支持标记比较的节点
- 平滑的CSS过渡动画

**Props**：
```javascript
{
  nodes: Array,              // 节点数组 [{ id, val, next }, ...]
  highlightedNodeIds: Array, // 高亮的节点ID集合
  compareNodeIds: Array,     // 比较的节点ID集合
  showLegend: Boolean        // 是否显示图例（默认true）
}
```

**使用示例**：
```vue
<LinkedListCanvas 
  :nodes="linkedListNodes"
  :highlightedNodeIds="['n2', 'n3']"
  :compareNodeIds="['n1']"
/>
```

**数据格式**：
```javascript
const linkedListNodes = [
  { id: 'n1', val: 5, next: 'n2' },
  { id: 'n2', val: 3, next: 'n3' },
  { id: 'n3', val: 8, next: null }
]
```

### 2. RecursionStackCanvas.vue - 递归调用栈可视化

**功能**：
- 竖直堆叠展示调用帧
- 递归展开时方框向下生长（带动画）
- 回溯时逐层消失（带动画）
- 高亮当前执行的帧
- 标记正在返回的帧
- 显示局部变量变化

**Props**：
```javascript
{
  stackFrames: Array,           // 调用帧数组
  activeFrameIndex: Number,     // 当前激活的帧索引
  returningFrameIndices: Array, // 正在返回的帧索引集合
  showLegend: Boolean           // 是否显示图例（默认true）
}
```

**使用示例**：
```vue
<RecursionStackCanvas 
  :stackFrames="frames"
  :activeFrameIndex="0"
  :returningFrameIndices="[1, 2]"
/>
```

**数据格式**：
```javascript
const frames = [
  {
    id: 'f1',
    name: 'fib',
    variables: { n: 5 },
    returnValue: null
  },
  {
    id: 'f2',
    name: 'fib',
    variables: { n: 4 },
    returnValue: 3
  }
]
```

## 集成到 VariablePanel

这两个组件已经集成到 `VariablePanel.vue` 中，会自动检测并渲染：

### 自动检测逻辑

1. **链表检测**：检查变量是否具有 `id`, `val`, `next` 字段
2. **递归栈检测**：查找 `_recursionStack_` 或 `recursionStack` 变量

### 指针变量自动高亮

前端会自动检测以下常见指针变量名并高亮对应的节点：
- `current`, `curr`, `p`
- `prev`, `previous`
- `next`
- `head`, `tail`
- `temp`, `node1`, `node2`

## 后端数据要求

详见 `DATA_FORMAT_SPEC.md` 文档。

关键点：
1. 链表节点必须包含 `id`, `val`, `next` 字段
2. 递归栈应作为 `_recursionStack_` 变量提供
3. 使用唯一ID标识每个节点/帧
4. 保持同一对象在不同步骤中的ID一致性

## 样式定制

所有组件都使用CSS变量，可以通过修改 `style.css` 中的变量来自定义样式：

```css
:root {
  --primary: #007aff;          /* 主色调 */
  --card-bg: rgba(255,255,255,0.65);  /* 卡片背景 */
  --border: rgba(60,60,67,0.12);      /* 边框颜色 */
  --text-h: #000000;           /* 主要文本颜色 */
}
```

## 动画效果

- **链表节点**：0.3s ease 过渡
- **递归帧进入**：从上方滑入 + 淡入
- **递归帧离开**：向下方滑出 + 淡出
- **变量变化**：0.52s 高亮闪烁

## 响应式设计

两个组件都支持移动端：
- 链表画布可横向滚动
- 递归栈限制最大高度并可纵向滚动
- 图例在小屏幕上自动换行

## 性能优化

1. 使用 `computed` 缓存计算结果
2. SVG 比 Canvas 更适合与 Vue 响应式绑定
3. 只更新变化的部分（通过 key 追踪）
4. 使用 CSS transition 而非 JavaScript 动画

## 调试技巧

### 查看渲染的SVG结构

在浏览器开发者工具中 inspect SVG 元素，可以看到：
- `<g class="nodes">` - 节点组
- `<g class="arrows">` - 箭头组
- `<defs>` - 箭头标记定义

### 测试Mock数据

可以在 `VariablePanel.vue` 中添加临时测试数据：

```javascript
// 临时测试链表
const testNodes = [
  { id: 'n1', val: 1, next: 'n2' },
  { id: 'n2', val: 2, next: 'n3' },
  { id: 'n3', val: 3, next: null }
]
```

## 常见问题

**Q: 链表节点不显示箭头？**  
A: 检查 `next` 字段是否正确指向下一个节点的 `id`。

**Q: 递归栈动画不流畅？**  
A: 确保使用了 `transition-group` 并且每个帧都有唯一的 `key`。

**Q: 节点重叠或位置错误？**  
A: 检查节点数组的顺序，应该按照链表顺序排列。

**Q: 如何禁用图例？**  
A: 设置 `:showLegend="false"` prop。

## 未来扩展

可能的改进方向：
1. 支持双向链表（添加 prev 箭头）
2. 支持树形结构可视化
3. 添加节点拖拽交互
4. 支持自定义节点样式
5. 添加缩放和平移功能

## 相关文件

- `LinkedListCanvas.vue` - 链表组件
- `RecursionStackCanvas.vue` - 递归栈组件
- `VariablePanel.vue` - 集成面板
- `DATA_FORMAT_SPEC.md` - 后端数据格式规范
- `ArrayCanvas.vue` - 数组画布（参考实现）

---

更新日期：2026-06-09  
作者：前端F2团队
