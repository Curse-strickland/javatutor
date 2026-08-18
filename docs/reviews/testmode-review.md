# 测试模式 + 面板优化 + 看板娘审查

> 审查日期: 2026-06-12 | 基准: `b6b982e` + 未提交

---

## 一、测试模式 — 核心流程

```
前端输入代码 + 测试用例 → RunRequest{mode:"test", testCases:[...]}
  → autoImportMissing() + extractCommentedClasses(辅助类)
  → findMethodInfo() + generateLauncherClass(含 Tree/List builder)
  → Instrumenter 插桩 → 内存编译 → 执行 → 返回 steps + methodName
```

| 环节 | 关键实现 | 状态 |
|------|----------|------|
| 方法发现 | `findMethodInfo` 优先 public 非构造函数，兜底任意非构造函数 | ✓ |
| Launcher | `generateLauncherClass` 生成完整 main + 参数赋值 + 结果打印 | ✓ |
| 树构建 | `generateTreeBuilder` BFS 层次遍历 `[1,2,3,null,4]` → TreeNode | ✓ |
| 链表构建 | `generateListBuilder` 遍历 int 数组 → ListNode | ✓ |
| 多维数组 | `countBracketDepth` 校验维度匹配，错误消息含具体维度差 | ✓ |
| 大数组截断 | >200 元素 → `[int[2000]]` 占位，避免 OOM | ✓ |
| 辅助类 | `/* ... */` 注释中的 ListNode/TreeNode 定义自动提取编译 | ✓ |

---

## 二、前端 — TestCasePanel

编辑器顶栏「测试」按钮 → 向下滑出测试用例面板：

- **文本模式**: 多行 textarea，每行一个参数，Ctrl+Enter 保存
- **逐行模式**: 独立 input + 动态添加参数按钮
- 保存后 `store.saveTestCases` 设置 `testMode=true`
- 检测到签名后显示 `methodSignature`（如 `int binarySearch(int[] arr, int target)`）

| 项目 | 评估 |
|------|------|
| 模式切换 | 文本 ↔ 逐行按钮，`toggleMode` ✓ |
| 当前签名墙 | `store.methodSignature` 显示为 `<code>` 蓝色 ✓ |
| 空模式提示 | "粘贴包含 class Solution 的代码，输入用例后保存" ✓ |
| 清除 | `clearTestCases` 重置所有测试状态 ✓ |

---

## 三、需修复

### [中等] String/char 测试用例无注入校验

**文件**: `RunController.java — generateValueExpr`

```java
if (type.equals("String") || type.equals("java.lang.String"))
    return tc.startsWith("\"") && tc.endsWith("\"") ? tc : "\"" + tc + "\"";
```

用户输入的字符串测试用例直接拼入生成的 Java 代码。恶意输入如 `" + Runtime.getRuntime().exec("calc") + "` 会生成该代码并触发沙箱拦截，但异常信息对用户不友好（"SecurityException: 沙箱: 不允许执行外部命令"）。

虽然沙箱三层防御兜底，但建议在 `TestCasePanel` 前端或后端 `generateValueExpr` 中做基础校验：拒绝含 `"`（非起止符）、`\n`、`\\` 等字符的 String 测试用例。

---

### [低] 复制粘贴时控件异常关闭

**文件**: `App.vue` — `testCaseOpen` 无 `@click.stop` 防护

`toggleTestCase` 和 `toggleUpload` 都未对当前 panel 内的点击做 `@click.stop` 处理。在 TestCasePanel 中 Ctrl+A / 右键粘贴等操作可能穿透触发外层折叠。

已在 `FileUploadPanel` 中有 `@click.stop`，`TestCasePanel` 面板包装 `<div class="upload-panel-wrapper">` 应同样处理。

---

### [低] `extractCommentedClasses` 名称拼写

**文件**: `RunController.java`

方法名为 `extractCommentedClasses` → `extractCommentedClasses` 语义正确（提取注释中的类），但一般惯例更倾向 `extractAnnotatedClasses`。不影响功能，仅命名习惯。

---

## 四、其他优化（已提交）

| 优化 | 说明 |
|------|------|
| 看板娘 | 仅水平拖动，默认右下角，折叠角标跟随 |
| 壁纸 | 视频+图片混合支持，可裁剪，背景音乐可选 |
| MemoryPanel | TreeNode 对象标签区分（"[节点1]" vs "[数组 arr]"） |

---

## 五、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **中等** | String/char 测试用例无注入输入校验 | `RunController.generateValueExpr` |
| **低** | TestCasePanel 内点击穿透 | `App.vue` upload-panel-wrapper |
| **低** | 方法名命名习惯 | `RunController.extractCommentedClasses` |

测试模式整体架构扎实，Launcher 生成涵盖 int/String/数组/TreeNode/ListNode 五种参数类型，BFS 树构建 + 维度校验细致。`explainOverview` 新增代码级综述端点设计合理。
