# 控制流图 + 比例布局 + Stack反射修复 — 开发日志

日期：2026-06-10

## 概述

1. **控制流图标签页**：基于 JavaParser AST 提取方法级控制流结构，用 Mermaid.js 渲染流程图
2. **条件中方法调用钻入**：if/while/for 条件表达式中的用户自定义方法调用现在标记为可钻入
3. **比例自适应布局**：编辑器/面板宽度从固定像素改为比例计算，窗口缩放时自动适配
4. **Stack反射异常修复**：用户代码使用 `java.util.Stack` 不再触发 `InaccessibleObjectException`

## 改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/.../service/ControlFlowService.java` | **新建** | JavaParser AST 遍历提取控制流节点 (entry/for/while/if/call/exit)，支持方法调用钻入 |
| `backend/.../controller/ExplainController.java` | 修改 | 新增 `POST /api/controlflow` 端点 |
| `frontend/.../components/ControlFlowPanel.vue` | **新建** | Mermaid.js 流程图渲染，蓝色节点可点击钻入子方法 |
| `frontend/.../stores/player.js` | 修改 | 新增 `controlFlowData`、`cfViewStack`、`requestControlFlow` action |
| `frontend/src/App.vue` | 修改 | 右侧新增「流程」标签页；`leftWidth` 改为 `splitRatio + containerWidth` 比例计算 |
| `frontend/package.json` | 修改 | 新增 `mermaid: ^11.15.0` |
| `backend/.../controller/RunController.java` | 修改 | TraceEngine 字符串常量: `setAccessible(true)` 移入 try-catch |
| `backend/.../compiler/TraceEngine.java` | 修改 | 同上（磁盘副本） |
| `backend/pom.xml` | 修改 | 添加 `--add-opens java.base/java.util=ALL-UNNAMED` |

## 架构

```
用户代码 → POST /api/controlflow → ControlFlowService JavaParser AST 分析
  → per-method CFG { nodes: [...], edges: [...] }
  → 前端 ControlFlowPanel Mermaid.js 渲染
  → 点击蓝色节点 → cfViewStack.push() → 钻入子方法子图
```

## 控制流节点类型

| 类型 | 颜色 | 说明 |
|------|------|------|
| `entry` | 蓝色 | 方法入口 |
| `for` / `while` | 紫色 | 循环 |
| `if` | 金色 | 分支 |
| `call` / 带 target 的控制流节点 | 蓝色 | 可钻入方法调用 |
| `block` | 灰色 | 顺序语句 |
| `exit` | 蓝色 | 返回 |

## 条件方法调用的钻入修复

**问题**：`matches()` 调用出现在 `else if (!stack.isEmpty() && matches(stack.peek(), c))` 条件中，但控制流节点类型为 `if` 且无 `target`，前端不识别

**修复**：
- 后端 `ControlFlowService` 新增 `checkAndAttachTarget(expr, ctx)` 方法，在 5 个 `handle*` 方法创建节点后检查条件/iterable 中是否有已知方法调用
- 前端 `ControlFlowPanel` 3 处 `n.type === 'call' && n.target` → `n.target`，任何带 `target` 的节点均可钻入

## Stack 反射异常修复

**问题**：用户代码 `java.util.Stack<Character>` → TraceEngine 反射访问 `Vector.elementData` → Java 17 模块系统拒绝

**修复**：`setAccessible(true)` 移入 try-catch，失败时字段记录 `<error>` 而非崩溃。同时 JVM 参数添加 `--add-opens java.base/java.util=ALL-UNNAMED` 使反射能成功。

## 验证

1. 运行括号匹配代码 → 控制流图显示 `main` + `matches` 两个方法子图
2. 点击 `if (!stack.isEmpty() && matches(...))` 节点 → 钻入 `matches` 方法详情
3. 拖拽分割条 → `splitRatio` 更新
4. 缩放浏览器窗口 → 左右面板比例不变
