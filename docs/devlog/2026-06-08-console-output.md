# 2026-06-08 控制台输出功能

## 背景

用户代码中的 `System.out.println()` 当前无反馈——输出写入服务器 stdout，前端看不到。这是初学者最自然的调试手段，缺失导致困惑。

## Step 1: 后端 — 捕获 System.out 并返回

**RunResponse.java**: 新增 `output` 字段 + getter/setter，`ok()` 方法增加 output 参数。

**RunController.java**: 安装 SecurityManager 后立即重定向 `System.out` 到 `ByteArrayOutputStream`，finally 块中恢复原始输出流并读取缓冲区。捕获的字符串通过 `RunResponse.ok(runId, steps, output)` 返回。

```
执行流程：
  SM 安装 → System.setOut(captured) → executor.submit → future.get → 
  finally: System.setOut(original) → captured.toString() → SM 恢复 → 
  return RunResponse.ok(runId, steps, output)
```

**验证**:
- curl `System.out.println("hello world")` → `"output":"hello world\r\n"`
- 冒泡排序（无 print） → `"output":""` 向后兼容

## Step 2: 前端 Store — 接收 output 字段

**player.js**: state 新增 `output: ''`，runCode 开始前清空 `this.output = ''`，成功分支 `this.output = data.output || ''`。

## Step 3: 前端 UI — 控制台输出面板

**新建 ConsoleOutput.vue**:
- 深色终端风格（`background: #1a1a20`，绿色 Consolas 等宽字体）
- 有输出时显示，无输出时隐藏
- 点击标题行折叠/展开，max-height 200px 可滚动
- 标题"控制台输出" + 收起/展开开关

**App.vue**: 在 VariablePanel 下方插入 `<ConsoleOutput />`。

## Step 4: 测试（初版）

测试脚本新增 O 组 3 条：
- O1: `println("hello")` → output 含 "hello" ✅
- O2: 连续 `print("a"); print("b")` → output 含 "ab" ✅
- O3: 循环打印 3 行 → output 含 "line 1" ✅

回归: B-G 组 27 条全部通过，A1 冒泡排序正常。

## 影响范围（初版）

| 文件 | 改动 |
|------|------|
| RunResponse.java | 新增 output 字段 + getter/setter + ok() 参数 |
| RunController.java | System.out 重定向 + 缓冲区读取 |
| player.js | state 加 output，runCode 接收 |
| ConsoleOutput.vue | 新建 |
| App.vue | 引入 ConsoleOutput |
| test-sandbox.py | O 组 3 条 |

---

## 第二轮改进：按步骤实时显示

### 问题

初版把所有输出在运行结束后一次性展示。用户需要的是：代码执行到 `println` 那一行时控制台才出现对应输出，回退步骤时输出也回退。

### 方案

TraceEngine.record() 每次被调用时检查 `ByteArrayOutputStream` 的新增内容，以 `output` 字段写入当前 step。前端 getter `currentOutput` 计算 `steps[0..currentStep]` 所有 delta 的累积。

### TraceEngine 改动（3 处同步）

- 新增 `capturedOutput` + `lastOutputPos` 字段
- `setOutputStream()` — RunController 反射调用，传入捕获流
- `record()` — 检测缓冲区增量，写入 step 的 `output` 字段
- `reset()` — 复位 `lastOutputPos`

磁盘文件 `TraceEngine.java`、RunController 硬编码 `TRACE_ENGINE_SOURCE`、InstrumenterTest 独立副本三处同步。

### RunController 改动

`System.setOut()` 之后反射调用 `TraceEngine.setOutputStream(capturedOut)`，将捕获流传入 TraceEngine。

### 前端改动

- **player.js**: 新增 `currentOutput` getter — 遍历 `steps[0..currentStep]` 拼接所有 `output` delta
- **ConsoleOutput.vue**: 绑定从 `store.output` 改为 `store.currentOutput`

### 效果

```
Step 1: int x = 1;       → 控制台空
Step 2: println("hello") 后   → 控制台显示 "hello"
Step 3: println("world") 后   → 控制台显示 "hello\nworld"
回退到 Step 1              → 控制台变为空
```

### 验证

- O1: step1 无 output，step2 含 "hello" ✅
- O2: 连续 print 在同一 step 的 delta 中 ✅
- O3: 循环内 3 次 println → 累积输出含 3 行 ✅
- 单元测试 3/3 ✅
- A1 冒泡排序无回归 ✅
