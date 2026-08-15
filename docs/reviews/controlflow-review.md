# 控制流图（流程页）审查

> 审查日期: 2026-06-10

---

## 一、架构

**数据流**: 用户运行代码 → `POST /api/controlflow` → `ControlFlowService` JavaParser AST 遍历 → 构建 per-method CFG (nodes/edges JSON) → 前端 `controlFlowData` store → `ControlFlowPanel` Mermaid.js 渲染 → 支持点击调用节点钻入子方法。

**右侧面板**: 新增「流程」Tab，位于「变量」和「经典」之间。

---

## 二、后端：ControlFlowService

| 项目 | 评估 |
|------|------|
| AST 遍历 | JavaParser `CompilationUnit.findAll(MethodDeclaration)` ✓ |
| 语句覆盖 | for / while / do-while / if-else / return / block / expression ✓ |
| 调用检测 | `knownMethods` 集合识别自定义方法调用，标记 `type: call` + `target` ✓ |
| if-else 汇合 | then+else 均非 terminal 时创建 merge node ✓ |
| return 终止 | `traverseBlock` 检测 null 返回中止链 ✓ |
| 默认视图 | `main` 方法优先，否则取第一个方法 ✓ |

### [重要] 字段级线程不安全

**文件**: `ControlFlowService.java:15-18`

```java
private int nodeId;
private List<Map<String, Object>> nodes;
private List<Map<String, Object>> edges;
private Set<String> knownMethods;
```

`ControlFlowService` 是 Spring `@Service` 单例。`analyze()` 被 `POST /api/controlflow` 调用时共享这些字段。并发请求会导致 node ID 交叉污染、nodes/edges 列表混乱。

**修复**: 全部改为方法局部变量，通过参数传递：
```java
public Map<String, Object> analyze(String code) {
    int localNodeId = 0;
    List<...> localNodes = new ArrayList<>();
    // 通过参数传递，或改为内部类封装
}
```

---

### [低] ForEach 显示为 "for (...)"

**文件**: `ControlFlowService.java:65`

```java
if (stmt.isForEachStmt()) return handleFor(stmt.asForStmt(), fromId);
```

ForEachStmt 被当普通 ForStmt 处理，图中标签显示 `for (...)` 而非 `for-each`。可提取 variable/iterable 信息单独生成标签。

---

## 三、前端：ControlFlowPanel

| 项目 | 评估 |
|------|------|
| Mermaid 主题 | dark + `primaryColor: #0a84ff`、`fontSize: 14px` 匹配设计系统 ✓ |
| 多方法钻入 | `cfViewStack` 栈式导航 + «← 返回» 面包屑 ✓ |
| 调用节点 | 检测 `type: call` + `target`，点击 `drillDown(target)` ✓ |
| 空状态 | `v-if="!controlFlowData"` → "运行代码后自动生成控制流图" ✓ |
| 自动触发 | `runCode()` 成功后自动调用 `requestControlFlow()` ✓ |
| SVG 自适应 | `max-width: 100%; height: auto` ✓ |

### [重要] mermaid 依赖未声明

**文件**: `ControlFlowPanel.vue:19`

```js
import mermaid from 'mermaid'
```

`package.json` 中无 `mermaid` 依赖。除非通过其他包间接引入，否则组件加载必定报错。

**修复**: `npm install mermaid` 并在 `package.json` 中确认。

---

### [低] Mermaid SVG 中 click handler 无去重保护

**文件**: `ControlFlowPanel.vue:99-102`

每次调用 `render()` 时通过 `querySelectorAll` 重新绑定 click 事件。`v-html` 替换 innerHTML 会销毁旧 DOM → 旧 listener 随 DOM 销毁，不会累积。**不是 bug**，但 `v-html` 是隐式 GC，显式清理更稳妥。

---

## 四、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **重要** | 字段级线程不安全 | `ControlFlowService:15-18` |
| **重要** | mermaid 未在 `package.json` 声明 | `package.json` |
| **低** | ForEach 显示为 "for (...)" | `ControlFlowService:65` |
