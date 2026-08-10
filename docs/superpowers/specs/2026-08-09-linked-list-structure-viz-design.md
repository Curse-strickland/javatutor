# 链表结构可视化（变量页内嵌）Design Spec

**日期：** 2026-08-09  
**状态：** Approved · Implemented — 实现计划见 `docs/superpowers/plans/2026-08-09-linked-list-structure-viz.md`  
**范围：** 确定性链表画布接入主播放器；不恢复通用栈→堆箭头图  


## 1. 背景与动机

[Staying 链表可视化](https://staying.fun/zh/docs/linked-list) 用「方块节点 + next 箭头 + 当前指针高亮」让步进可读。JavaTutor 已有步进堆栈快照与颜色联动，但缺少专用结构图。

历史结论（必须遵守）：

- Mermaid / AntV X6 / VueFlow+ELK 做**通用引用箭头**均失败（重建闪烁、坐标冲突、箭头过密）。
- 通用引用继续用**颜色一致性 + 悬浮跨区高亮**（MemoryPanel 现状）。
- 本规格只做**链表专用、一维布局**的画布，复用已有 `LinkedListCanvas.vue`。

## 2. 目标 / 非目标

### 目标（v1）

1. 运行后若当前步能识别链表，在**变量页顶部**自动显示链表结构图。
2. 与底部播放条同步：`currentStep` 变化时更新节点、`next`、指针标签与高亮。
3. 零新增图库依赖；不改 Coze；不改 TraceEngine 契约（前端从现有 heap/stack 抽取）。

### 非目标（v1）

- PythonTutor 式「所有变量→堆对象」全量箭头。
- 重新引入 X6 / VueFlow / ELK。
- 依赖 `/api/ai/animate` 生成链表图。
- 独立「结构」tab（列为 v1.1，见 §8）。
- 完整支持任意自定义节点类字段名（v1 仅 `val`/`value` + `next`）。

## 3. 用户体验

### 3.1 出现位置

- 面板：右侧 INSPECT → **变量**（`MemoryPanel`）。
- 布局：画布在栈区/堆区**上方**；标题条例如「链表结构」。
- 无链表可抽时：**整块不渲染**（`v-if`），变量页与现网一致。

### 3.2 交互

| 元素 | 行为 |
|------|------|
| 节点 | 两格：`val` \| `next` 锚点；`next==null` 显示空标记 |
| 箭头 | SVG 直线，由 DOM 量测（现有 LinkedListCanvas） |
| 指针标签 | 栈帧变量名挂在对应节点上方（如 `head`、`curr`） |
| 高亮 | 相对上一步「引用目标变化」的指针所指节点高亮 |
| 步进 | 跟全局 `currentStep`，无单独播放器 |

### 3.3 多条链（v1 限制）

若存在多条不相交链，v1 **只展示一条**：优先节点数最多；并列时优先名称含 `head` 的根所在链。其余链仍只在堆卡片中可见。

## 4. 架构

```
player.currentHeap + player.activeStackFrames (+ prev step 对比)
        │
        ▼
frontend/src/utils/linkedListExtract.js   （纯函数，可单测）
        │  { nodes, pointerLabels, highlightedNodeIds }
        ▼
MemoryPanel 顶部
        └── LinkedListCanvas（已有，不改公共 API 除非缺字段）
```

- **数据源：** 现有 `TraceEngine` 步快照中的 `heap` 与栈帧变量（含 `{ref: heapId}`）。
- **抽取层：** 仅前端；不新增后端字段。
- **渲染层：** 复用 `LinkedListCanvas` props：
  - `nodes: { id, val, next, _cycle? }[]`
  - `pointerLabels: { [nodeId]: string[] }`
  - `highlightedNodeIds: string[]`
  - `compareNodeIds`：v1 可空，预留双指针对比。

## 5. 抽取规则（v1）

### 5.1 识别链表节点（heap 对象）

满足任一即可视为节点候选：

1. `type` 匹配 `/ListNode|LinkedList|Node$/i`（可配置白名单常量）；或  
2. `fields` 同时具备：
   - 值字段：`val` 或 `value`（原始值或可展示值）；
   - 链接字段：`next`，且为 `null` 或 `{ ref: string }`。

### 5.2 建链

1. 收集所有节点候选 → `id → { val, nextId }`。  
2. 从「根」出发沿 `next` BFS/循环检测生成有序 `nodes[]`：
   - 根候选：栈帧中指向节点的变量；名称优先 `head`，否则任意指向节点的 ref。  
3. 环：再次访问已在路径中的 id → 标记 `_cycle`，停止延伸（与画布现有语义一致）。  
4. `nodes[].next` 存**下一节点 id**（字符串），供箭头查找。

### 5.3 指针标签

遍历 `activeStackFrames` 的参数与局部变量：

- 若值形如 `{ ref }` 且 `ref` 落在当前展示链的 node id 集合内 → 把变量名加入 `pointerLabels[ref]`。  
- 同名多帧：用最深（最内层）帧覆盖，或合并去重（实现选「最内层优先」）。

**名称启发（仅排序/优先展示，不是过滤）：**  
`head`, `curr`, `current`, `prev`, `next`, `p`, `q`, `slow`, `fast`, `dummy`, `tail`。

### 5.4 高亮（相对上一步）

- 取 `steps[currentStep - 1]` 与当前步的「变量名 → ref」映射（仅链上节点）。  
- 若某变量的 ref **发生变化**，则新 ref 加入 `highlightedNodeIds`。  
- 第一步无 prev：高亮所有根指针所指节点（或仅 `head`）。

## 6. 文件变更（预期）

| 文件 | 变更 |
|------|------|
| `frontend/src/utils/linkedListExtract.js` | **新建** 抽取纯函数 + 导出 |
| `frontend/src/utils/linkedListExtract.test.js`（或项目既有测法） | **新建** 单元测试：线性链、环、无链、指针标签、步进高亮 |
| `frontend/src/components/MemoryPanel.vue` | 顶部嵌入画布 + computed 调用 extract |
| `frontend/src/components/LinkedListCanvas.vue` | 仅当 API 缺口时小改；默认不动 |
| 后端 | **无** |

## 7. 验收标准

1. 经典「反转链表 / 合并链表」类示例运行后，变量页顶部出现链图。  
2. 单步前进时，`curr`/`prev` 标签移动到正确节点；变化节点有高亮。  
3. 非链表代码（纯数组排序）变量页**不出现**链图画布。  
4. 步进 50 次无明显整页闪烁（允许箭头 dash 过渡）。  
5. 不新增 npm 依赖。  
6. 通用颜色联动行为保持不变。

## 8. 后续（v1.1+，不在本规格实现）

- 独立 INSPECT tab「结构」。  
- 多条链并列或切换。  
- `compareNodeIds` 用于 slow/fast 双色。  
- 更宽的节点字段别名（`data`/`link` 等）。

## 9. 风险

| 风险 | 缓解 |
|------|------|
| Trace 未把 `next` 收成 `{ref}` | 验收用现有 TraceEngine 样例；若失败再开后端小补丁（本规格默认够用） |
| 自定义 `Node` 无 `val` | v1 不展示链；文档/提示可后续加 |
| 与堆区信息重复 | 接受：结构 vs 字段卡片分工不同 |

## 10. 决策记录

- 放置：**C** — 先变量页顶部，稳定后再考虑独立 tab。  
- 实现路径：复用 `LinkedListCanvas`，前端抽取，不恢复通用箭头。  
- 指针：标签用栈帧 ref；高亮用相对上一步变化（名称启发仅排序）。
