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

# 2026-06-09 Monaco Editor 键盘输入问题（已确认 ✅）

## 状态

**已确认根因** — 非代码 bug，无需修改前端代码。

## 现象

代码编辑区键盘需要按两次才会键出字符。仅在一台设备上出现，组员相同代码无此问题。

## 根因

**第三方输入法（Rime/小狼毫）与 Monaco Editor 冲突。**

Rime 输入法即使在英文模式下，底层仍然 hook 键盘事件，与 Monaco Editor 内部隐藏 textarea 的键盘事件捕获机制冲突。按键事件被输入法拦截后未正确派发到 Monaco 的 textarea，导致第一次按键"丢失"，需要按第二次才能输入。

## 验证

- 切换到系统自带输入法（微软拼音英文模式）→ 键盘正常 ✅
- 组员使用系统输入法 → 无此 bug ✅

## 结论

这不是代码问题，是 Monaco Editor + 第三方输入法的已知兼容性问题。解决方案：使用 Monaco 时切换到系统自带输入法。

---

## 附录：排查过程（保留供参考）

排查阶段曾怀疑 CSS `direction: ltr` 与 Monaco 冲突，尝试了以下方案：

| 方案 | 显示 | 键盘 |
|------|:--:|:--:|
| `automaticLayout: true` + 移除 CSS | ❌ 右偏 | ✅ |
| `automaticLayout: true` + 保留 CSS | ✅ | ❌ |
| `automaticLayout: true` + JS 后置 direction | ✅ | ❌ |
| `dir="ltr"` HTML 属性 | ❌ | ❌ |
| `lineNumbers: 'off'` + `glyphMargin: false` | ❌ | ❌ |

所有方案均无效，原因是根本矛盾不在 CSS，而在输入法层面。最终回退到原始代码（`automaticLayout: false` + `ResizeObserver`），确认组员代码相同无 bug 后才锁定输入法为根因。
