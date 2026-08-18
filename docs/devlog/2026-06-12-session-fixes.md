# 会话修复与增强

> 日期: 2026-06-12 | 分支: `fix/internal-errors`

## 后端修复

### 1. Instrumenter — 防止插桩级联

**问题**: `shouldInstrument()` 和 `detectMethodCall()` 会匹配插桩器自身生成的 `TraceEngine.record()` 等语句，产生大量冗余 record。`detectMethodCall` 匹配 "record" 后在各人工语句前插入 before-record，层层级联导致步骤数据膨胀，且这些中间记录的 line = -1（无源码位置），可能干扰行号高亮。

**修复** ([Instrumenter.java](../../backend/src/main/java/com/javatutor/instrumentation/Instrumenter.java)):
- 新增 `isTraceEngineCall()` 方法，过滤 `record/buildMap/allocArray/allocObject/pushFrame/popFrame`
- `shouldInstrument` 中方法调用判断前先检查是否为 TraceEngine 调用
- `detectMethodCall` 入口先过滤 TraceEngine 调用，不再为其生成 before-record

### 2. pushFrame — Collection 参数支持

**问题**: `java.util.List<Integer> path` 等 Collection 类型在 `pushFrame` 中走到 else 分支，存储原始 ArrayList 对象。Jackson 序列化为 JSON 数组后，前端无法识别为堆引用，帧标题只显示 `backtrack([数组 nums], [数组 usd], )`，缺少第三个参数。

**修复**:
- [TraceEngine.java](../../backend/src/main/java/com/javatutor/compiler/TraceEngine.java): `pushFrame` 新增 `instanceof java.util.Collection` 分支，存储参数名字符串
- [RunController.java](../../backend/src/main/java/com/javatutor/controller/RunController.java): 硬编码 `TRACE_ENGINE_SOURCE` 同步更新

## 前端修复

### 3. MemoryPanel — 普通变量卡片悬浮高亮修复

**问题**: 悬浮任意普通变量卡片（i, j 等），所有同名/同类型卡片同时高亮。根因：`refId` 为 `null` 时 `null === null` 匹配全部非引用卡片。

**修复**: hoverState 新增 `itemName` 字段，普通变量按变量名精确匹配。

### 4. MemoryPanel — 普通变量卡片自动换行

从 `flex: 0 0 calc(50% - 3px)`（强制每行两个）改为 `flex: 0 1 auto; min-width: 58px`，短变量名自然多列排列，长变量名占更多空间。

### 5. MemoryPanel — 堆区数组值变化荧光高亮

**问题**: `.mp-cell-val` 是 `<span>` inline 元素，CSS `transform` 对 inline 元素无效，荧光动画完全不显示。

**修复**: `.mp-cell-flash` 加 `display: inline-block`。

### 6. MemoryPanel — 帧标题引用参数显示与映射

**问题**: `quickSort(a, 0, 5)` 中 `a` 显示为裸变量名而非 `[数组 a]`，且悬浮无堆区联动高亮。

**修复**:
- 帧标题 arg 检测新增 `heap[pVal]` 匹配（数组名作为 arg 值存储）和 `Array.isArray(pVal) && heap[pName]` 兜底
- arg 对象新增 `refId` 用于悬浮联动
- `onFrameArgEnter()` 触发堆卡片高亮，`frameArgStyle()` 实现双向辉光反馈

### 7. MemoryPanel — 帧标题自动换行

**问题**: 长标题 `backtrack([数组 nums], [数组 usd])` 被截断，改为自动换行后与卡片重叠。

**修复**: 帧标题从 `position: absolute` 改为 `position: relative; top: -18px`，保留文档流空间，换行时自然推开下方内容。

### 8. 折叠控件现代化

**ClassicCodePanel**: 两个独立按钮 → 单个圆角胶囊按钮，chevron 旋转 + 文字联动，分组折叠使用 CSS Grid `grid-template-rows: 1fr/0fr` 动画（350ms cubic-bezier）。

**MemoryPanel**:
- 帧标题左侧：小 chevron 折叠该帧变量卡片
- 栈区/堆区标题右侧：chevron 一键折叠整个分区
- 堆区数组卡片标题左侧：chevron 折叠 slots/fields
- 所有 chevron 半透明低存在感，hover 变亮，`prefers-reduced-motion` 降级

## 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/.../instrumentation/Instrumenter.java` | 新增 isTraceEngineCall 防级联 |
| `backend/.../compiler/TraceEngine.java` | pushFrame 支持 Collection |
| `backend/.../controller/RunController.java` | TRACE_ENGINE_SOURCE 同步 |
| `frontend/src/components/ClassicCodePanel.vue` | 折叠控件现代化 + 平滑动画 |
| `frontend/src/components/MemoryPanel.vue` | 悬浮修复 + 自动换行 + 堆区高亮 + 帧标题 + 三级折叠 |
