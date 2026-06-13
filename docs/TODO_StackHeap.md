# 堆/栈可视化 -- 前后端改造方案

## 现状回顾

当前后端产出的每个 step：

```json
{ "step": 1, "line": 3, "variables": { "arr": [5,3,8], "n": 3, "i": 0 } }
```

是一个扁平 map，不区分基本类型/引用类型、没有对象身份。前端 `VariablePanel.vue` 用 `v-for` 平铺渲染，无法表达"栈指向堆"的结构。

---

## 分期

| | Phase 1（静态类型分离） | Phase 2（运行时对象追踪） |
|---|---|---|
| 改动面 | 不改 Instrumenter，只加一个后处理类 | 改 Instrumenter + TraceEngine |
| 产出 | `stack[]` + `heap[]`（无连线） | `stack[]` + `heap[]` + `edges[]`（完整拓扑） |
| 前端效果 | 栈/堆卡片分区展示，类型标签 | 真正的对象引用连线图 |

---

## 后端 TODO

### Phase 1：静态类型分离（不改插桩，改动面最小）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| B1 | 新建 `StepEnricher.java` | `backend/.../enrichment/StepEnricher.java` | 核心后处理器：拿用户源码解析变量声明类型，把每个 step 的 `variables` 拆成 `stack`（基本类型）和 `heap`（引用类型） |
| B2 | `RunController` 调用 Enricher | `RunController.java` L138-139 | 在 `TraceEngine.getSteps()` 返回后、`RunResponse.ok()` 前，调用 `enricher.enrich(steps, userCode)` |
| B3 | 新 step 数据格式 | `StepEnricher.java` 输出 | 见下方"数据契约" |
| B4 | 单元测试 | `test/.../enrichment/StepEnricherTest.java` | 覆盖 int/String/数组/对象四种变量类型 |

**StepEnricher 核心逻辑**（约 100 行）：

```
输入：userCode 的 AST + raw steps
  ↓
1. 解析 userCode，遍历所有 VariableDeclarator + FieldDeclaration
   → 建立 Map<变量名, 声明类型>（如 arr→int[], n→int, name→String）
  ↓
2. 遍历每个 step 的 variables map：
   - 查类型表：基本类型(int/boolean/char/...) → 放入 stack[]
   - 查类型表：引用类型(数组/String/对象) → 放入 heap[]
   - heap[] 项临时 refId = "name@step"（Phase 1 不做真追踪）
   - edges[] = []（Phase 2 再填充）
  ↓
输出：enriched steps（每个 step 含 stack / heap / edges）
```

**Phase 1 数据契约：**

```json
{
  "step": 1,
  "line": 3,
  "stack": [
    { "name": "n",   "value": 3,    "type": "int" },
    { "name": "i",   "value": 0,    "type": "int" },
    { "name": "temp","value": 5,    "type": "int" }
  ],
  "heap": [
    { "name": "arr", "refId": "arr@1", "type": "int[]", "value": [5,3,8] }
  ],
  "edges": []
}
```

### Phase 2：运行时对象身份追踪（需改插桩）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| B5 | `TraceEngine` 新增 `recordWithId` | `RunController.java` TRACE_ENGINE_SOURCE 常量 | 对引用类型调用 `System.identityHashCode()`，生成真 refId |
| B6 | `Instrumenter.buildRecordStatement()` 改签名 | `Instrumenter.java` L240-258 | 对引用变量生成 `TraceEngine.recordWithId(...)` 而非 `record(...)` |
| B7 | `StepEnricher` 升级 | `StepEnricher.java` | 从 step 中提取 refId，生成真实的 edges[]（当多个变量 refId 相同时连线） |
| B8 | 回归测试 | `InstrumenterTest.java` | 确保旧测试依然通过 |

**Phase 2 数据契约（完整）：**

```json
{
  "step": 1,
  "line": 5,
  "stack": [
    { "name": "a", "value": null, "type": "Node" }
  ],
  "heap": [
    { "refId": "a@obj_12345678", "name": "a", "type": "Node", "value": { "val": 1, "next": null } }
  ],
  "edges": [
    { "from": "a", "to": "obj_12345678" }
  ]
}
```

---

## 前端 TODO

### Phase 1：栈/堆分区展示（不引入图引擎）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| F1 | `player.js` 新增 getter | `stores/player.js` | `currentStack` / `currentHeap` / `currentEdges`，从当前 step 读 `stack`/`heap`/`edges`（兼容旧格式降级为全放入 stack） |
| F2 | 新建 `cards/` 目录 + `StackCard.vue` | `components/cards/StackCard.vue` | 轻量卡片：变量名 + 类型标签（小 badge）+ 值，栈区专用（蓝紫配色，表示在线程栈上） |
| F3 | 新建 `HeapCard.vue` | `components/cards/HeapCard.vue` | 堆对象卡片：毛玻璃效果、发光边框、refId 角标、值区可折叠展开（表示在堆上） |
| F4 | 重写 `VariablePanel.vue` | `components/VariablePanel.vue` | 拆为上下两区：上半"调用栈 Stack"用 `<TransitionGroup>` 包裹 StackCard 列表；下半"堆 Heap"用 grid 排列 HeapCard。保留现有 flash 动画 |
| F5 | 栈卡片入栈/出栈动画 | `VariablePanel.vue` + `StackCard.vue` | 利用 `<TransitionGroup>` + Tailwind `enter/leave` 类：新变量从上方滑入（入栈），消失变量向上飘出（出栈） |
| F6 | 更新 Mock 数据 | `stores/player.js` 注释区 | 把旧 mock 数据格式升级为新格式，供前端离线调试 |

### Phase 2：图连线引擎（需要后端 Phase 2 先完成）

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| F7 | 安装 `@vue-flow/core` + `@vue-flow/background` | `package.json` | 约 +80KB gzipped |
| F8 | `player.js` 新增图布局 getter | `stores/player.js` | `getLayoutNodes` / `getLayoutEdges`：把 stack/heap 数据转为 VueFlow 的 `Node[]` + `Edge[]` 格式 |
| F9 | 重构 `VariablePanel.vue` 嵌入 VueFlow | `components/VariablePanel.vue` | `StackCard` / `HeapCard` 作为 `#node-stack` / `#node-heap` 的自定义模板节点，带自动布局 + 贝塞尔曲线连线 |
| F10 | 连线动画 | CSS / VueFlow 内置 | 引用箭头带流动虚线动效，表示"指向"关系 |

---

## 文件变更总览

```
后端新增/修改：
  backend/src/main/java/com/javatutor/enrichment/
    └── StepEnricher.java          ← 新建 (Phase 1)
  backend/src/main/java/com/javatutor/controller/
    └── RunController.java         ← 修改 L138-139 (Phase 1)
  backend/src/main/java/com/javatutor/instrumentation/
    └── Instrumenter.java          ← 修改 buildRecordStatement (Phase 2)

前端新增/修改：
  frontend/src/
    ├── stores/
    │   └── player.js              ← 修改：新增 getter + 升级 mock (Phase 1)
    └── components/
        ├── cards/                  ← 新建目录 (Phase 1)
        │   ├── StackCard.vue      ← 新建
        │   └── HeapCard.vue       ← 新建
        └── VariablePanel.vue      ← 重写 (Phase 1)
```

---

## 预估工时

| 阶段 | 后端 | 前端 | 合计 |
|------|------|------|------|
| Phase 1（静态类型分离 + 分区卡片） | 2h | 4h | 6h |
| Phase 2（运行时追踪 + 图连线） | 3h | 4h | 7h |
