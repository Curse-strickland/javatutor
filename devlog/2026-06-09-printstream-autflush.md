# 2026-06-09 PrintStream autoFlush 修复

## 问题

用户报告 `System.out.println()` 输出丢失字符：

| 输入 | 预期输出 | 实际输出 |
|------|----------|----------|
| `"!@#$%^&*()"` | `!@#$%^&*()` | `%^&*()` (丢失 `!@#$`) |
| `"line1\nline2"` | `line1\nline2` | `1\nline2` (丢失 `line`) |
| `"中文测试"` | `中文测试` | `中文测试` (正常) |

规律：恰好丢失 4 个字符（`!@#$` 和 `line`）。

## 根因

`RunController.java` 中 `new PrintStream(capturedOut)` 默认 `autoFlush=false`。

用户代码 `println()` 的数据流经多层缓冲：

```
println() → BufferedWriter → OutputStreamWriter → StreamEncoder(byte[8192]) → ByteArrayOutputStream
                                                           ↑
                                                    数据滞留在此缓冲区！
```

- `BufferedWriter.flushBuffer()` 只刷到 `OutputStreamWriter`
- `StreamEncoder` 内部持有 8192 字节缓冲区，`autoFlush=false` 时不触发 `out.flush()`
- 短字符串输出全部卡在 `StreamEncoder` 缓冲区，`ByteArrayOutputStream` 中实际为空
- `TraceEngine.record()` 调用 `capturedOutput.toString()` 拿不到数据
- 最终 `System.setOut(originalOut)` 恢复时也未 flush，残留数据丢失

丢失恰好 4 个字符的原因：`StreamEncoder` 在某些编码边界（如中文多字节 UTF-8 编码触发内部状态变化）时部分刷新，导致只有剩余数据被写出。

## 修复

**文件**: `backend/src/main/java/com/javatutor/controller/RunController.java`

改动 2 处：

1. **启用 autoFlush**（第 142 行）：
   ```diff
   - System.setOut(new PrintStream(capturedOut));
   + System.setOut(new PrintStream(capturedOut, true));
   ```

2. **恢复前显式 flush**（第 167 行）：
   ```diff
     } finally {
   +     System.out.flush(); // 确保 StreamEncoder 缓冲区全部写入 capturedOut
         System.setOut(originalOut);
   ```

## 验证

### 自动化测试
```
中文测试\n          ✅
!@#$%^&*()\n        ✅
line1\nline2\n       ✅
```

### 回归测试 (`test-sandbox.py`)
```
B 组 (import白名单): 5/5 ✅
C 组 (方法黑名单):   7/7 ✅
D 组 (类型黑名单):   9/9 ✅
E 组 (运行时拦截):   1/1 ✅ (E1 跳过)
F 组 (超时保护):     2/2 ✅
G 组 (错误提示):     3/3 ✅
O 组 (控制台输出):   3/3 ✅
```

## 注意事项

- `PrintStream(OutputStream, boolean)` 在 JDK 17 中可用，非 deprecated
- `autoFlush=true` 会让每次 `println` 后立即 flush，性能影响可忽略（教学场景单线程执行）
- 与 `Charset.defaultCharset()` 一致性：PrintStream 和 `ByteArrayOutputStream.toString()` 均使用默认 charset，不会产生编码不一致

---

# 2026-06-09 Monaco Editor 按键两次修复

## 问题

代码编辑区键盘需要按两次才会键出字符。

## 根因（3 个叠加因素）

### 1. `automaticLayout: false` + 手动 `ResizeObserver` 竞态
Monaco 编辑器每次内部 DOM 变化都会触发 `ResizeObserver` 回调，回调中的 `editor.layout()` 重置编辑器内部状态，导致正在处理的按键事件被丢弃。

### 2. 初始化时机过早
`onMounted` 触发时 flex 容器可能尚未完成布局，Monaco 以 0×0 尺寸创建后再被拉伸，内部状态异常。

### 3. HMR 重复挂载
Vite HMR 热更新时组件重新 `onMounted`，在同一个 DOM 上创建第二个 Monaco 实例，两个实例争抢键盘事件。

### 4. CSS 干扰 Monaco 内部 DOM（潜在）
`.editor-container` 上的 `direction: ltr`、`text-align: left`、`transform: none !important` 可能干扰 Monaco 内部文本度量和光标定位。

## 修复

**文件**: `frontend/src/components/Editor.vue`

| 改动 | 说明 |
|------|------|
| `automaticLayout: false` → `true` | 使用 Monaco 内置 rAF 整合的布局，无竞态 |
| 移除手动 ResizeObserver | 不再需要 |
| `onMounted` 改为 `async` + `await nextTick()` + `await requestAnimationFrame()` | 确保 DOM 完成布局后再创建编辑器 |
| 创建前 dispose 旧实例 | 防止 HMR 导致双实例 |
| 移除 `.editor-container` 上的 `direction: ltr` / `text-align: left` / `transform: none !important` | 避免干扰 Monaco 内部渲染 |

## 验证

- `npm run build` 成功，无编译错误 ✅

---

# 2026-06-09 Monaco Editor 键盘输入问题（待修复 🐛）

## 状态

**未解决** — 已撤销所有尝试，回退到原始代码。

## 现象

代码编辑区键盘需要按两次才会键出字符。

## 已知约束

原始 `Editor.vue` 中 `.editor-container` 的 CSS：
```css
direction: ltr;
text-align: left;
transform: none !important;
```

- **保留这 3 条 CSS**：代码显示正确，键盘有问题（按两次）
- **移除这 3 条 CSS**：键盘正常，但代码显示右偏
- **只用 `text-align: left`（无 `direction`）**：显示正确，键盘有问题
- **`dir="ltr"` HTML 属性**：显示和键盘都有问题
- **`lineNumbers: 'off'`**：显示和键盘都有问题
- **JS 后置 `direction`**：显示正确，键盘有问题

核心矛盾：`direction: ltr`（无论 CSS/JS/属性形式）和 Monaco 键盘输入不可兼得。

## 尝试过但无效的方案

| 方案 | 显示 | 键盘 |
|------|:--:|:--:|
| `automaticLayout: true` + 移除 CSS | ❌ 右偏 | ✅ |
| `automaticLayout: true` + 保留 CSS | ✅ | ❌ |
| `automaticLayout: true` + JS 后置 direction | ✅ | ❌ |
| `dir="ltr"` HTML 属性 | ❌ | ❌ |
| `lineNumbers: 'off'` + `glyphMargin: false` | ❌ | ❌ |

## 当前代码状态

`Editor.vue` 已回退到原始版本：
- `automaticLayout: false` + 手动 `ResizeObserver`
- `.editor-container` 保留 `direction: ltr; text-align: left; transform: none !important`

## 下一步方向

需要找到一种不依赖 CSS `direction` 的方式修复代码右偏显示，或找到让 Monaco 在 `direction: ltr` 下正常处理键盘输入的方法。
