# 2026-06-13 会话增强与修复 — 测试模式 + AI 解说升级

## 测试模式 (LeetCode Tutor Mode)

用户粘贴 `class Solution { method }` 片段即可单步可视化，无需手动写 main 方法和 import 语句。

### 后端

**RunRequest.java** — 新增 `mode` 字段 (`"default"` | `"test"`) 和 `testCases` 字段（原始参数文本列表）。

**RunResponse.java** — 新增 `methodName`、`methodSignature` 字段，`ok()` 工厂方法重载支持额外参数。

**RunController.java** — 核心分叉逻辑：

- `autoImportMissing(code)`: 自动补 `import java.util.*;`
- `findMethodInfo(code)`: JavaParser 提取第一个 public 方法的签名信息
- `generateLauncherClass(methodInfo, testCases)`: 生成 Launcher.java（含 main + 用例数据），只对 Solution 插桩，Launcher 不插桩
- `extractCommentedClasses(code)`: 提取 `// class Node {}` 格式的注释辅助类（如 ListNode、TreeNode）
- 类型映射：int/int[]/int[][]/String/String[]/List<Integer>/自定义类型 → 从文本用例生成 Java 字面量
- TraceEngine 增强：大数组/Collection > 200 元素截断（防 OOM）、Map 类型支持、deepCopyArray 截断保护

### 前端

**TestCasePanel.vue** (新建) — 测试用例参数面板：
- 文本模式：textarea 逐行输入，每行一个参数
- 逐行模式：根据检测到的参数数量动态渲染输入行
- 保存时自动激活测试模式，清除时退出
- 复用 upload-slide transition

**App.vue** — 编辑器头部：
- "测试"按钮（列表图标），激活态蓝色高亮
- "非测试模式请输完整代码" 琥珀色提醒徽章
- 测试用例面板向下滑出

**player.js** — 新增状态：`testMode`、`testCases`、`methodName`、`methodSignature`；新增 action：`saveTestCases()`、`clearTestCases()`；`runCode()` 在测试模式下附加 `mode: 'test'` 和 `testCases`。

---

## AI 解说升级

### 零配置智谱 GLM-4.7 默认服务

- `application.properties`: 配置智谱免费 API (`deepseek.api.url` → 智谱端点，`deepseek.api.model` → `glm-4.7`，内嵌免费 API Key)
- `DeepSeekService.java`: `defaultKey` 替代 `apiKey`，`resolveKey()` 两级解析（用户 Key → 默认 Key），移除匿名 fallback
- `AnalyzeService.java`: 同步改为 `defaultKey` + 安全校验

### 多 Provider 选择

**player.js** — 新增：
- `apiProvider` 状态 (`'zhipu'` 默认) + `apiProviders` 预设字典（智谱/DeepSeek/OpenAI/Kimi/自定义）
- 每个 provider 含 `label`、`url`、`model`、`keyHint`（placeholder）、`keyRe`（格式正则）
- `_apiBody(extra)` 辅助：用户配了 Key 时才附加 `apiUrl`/`apiModel`

**AiTutorPanel.vue** — 自定义 API 面板：
- Provider 选择改为 chip 按钮组（圆角 8px，Design System 统一色调）
- 选中态蓝色 accent 背景 + 边框
- "自定义"选项展开 URL + Model 输入框
- Key 格式按 provider 正则校验
- 状态标签显示当前 provider 名（如 "智谱"）

### 整体解说

**ExplainController.java** — 新增 `POST /api/explain/overview` SSE 端点；`/api/explain` 增加 `customUrl`/`customModel`/`mode` 参数透传。

**DeepSeekService.java** — 新增 `explainOverview()` 方法：
- 系统提示词：分四段综述（算法目标 → 核心策略 → 数据结构 → 复杂度）
- 总长 4-8 句，约 150-300 字
- 测试模式下优先分析 Solution 方法

**player.js** — 新增 `requestOverview()` action，SSE 流式读取同 `requestExplain()`。

**AiTutorPanel.vue** — "整体解说"按钮 + "单步解说"按钮并排，统一样式。

---

## 控制流图 else-if 链高亮修复

**ControlFlowPanel.vue**:
- 新增 `extractNodeId(svgEl)`: 从 Mermaid SVG 元素 `id` 属性解析内部节点 ID（如 `flowchart-n2-5` → `n2`）
- `applyHighlight()`: 用 `matchedIds` Set 做精确 ID 匹配，替代 `label.startsWith()` 模糊匹配
- 钻取点击也用 ID 匹配，修复多个相同文本节点同时高亮的 bug

---

## MemoryPanel Map 类型展示

- 虚拟堆条目（`virtualMapEntries` computed）：检测 Map 类型局部变量自动生成堆卡片
- Map 表格布局：Key 列 → 箭头 → Value 列，带类型表头
- > 200 条目截断显示 + 省略提示
- 堆区标签：`[映射 xxx]` 标识
- 栈帧中 Map 变量显示为引用标签（ref chip）

---

## 看板娘语录全覆盖更新

**waifu-tips.json**:
- 替换 9 个过期 selector（VariablePanel 旧 class → MemoryPanel `.mp-*` 新 class）
- 新增 12+ 条 feature 引导语录（测试模式按钮、整体解说、流程图、导入历史、经典代码、Map 展示等）
- `message.default` 新增 8 行功能介绍
- 修复 mouseover 语录不触发问题：selector 从通用→具体改为具体→通用（`closest()` 按数组顺序匹配）
- 修复 `.right-tab` 语录随机混串：使用 `{text}` 占位符动态匹配
- 新增 selector：`.testmode-btn`、`.cf-panel`、`.cf-icon-btn`、`.mp-heap-card`、`.mp-map-table` 等

---

## 杂项修复

- **ConsoleOutput.vue**: 测试模式下显示 `store.output`（Launcher println 输出）
- **WallpaperSelector.vue**: `.upload-row` flex 布局 + `.upload-label` flex:1 修复对齐
