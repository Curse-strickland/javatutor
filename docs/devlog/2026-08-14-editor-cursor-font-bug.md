# 2026-08-14 编辑器光标偏左 Bug 修复日志

分支: `feat/multi-file-project-run` · 涉及文件: `frontend/src/components/Editor.vue`

---

## 一、现象

该版本（多文件模式）下，**单文件模式**编辑区出现光标错位：光标显示位置偏左，但对应操作字符正确。

用户确认的关键细节：

- **首次打开就有**（未切换过模式，排除模式切换重建导致）
- **越往右越偏**（累积偏移，排除恒定布局偏移）
- **偏一个字符以上**（量级明显）
- 浏览器 **Edge + Windows 100% 缩放**（排除 DPI 缩放）

## 二、排查尝试记录

### 尝试 1 —— 确认"这次更新改了哪些文件"

`git diff main...HEAD` 前端仅改动 5 个文件：

| 文件 | 变化 |
|------|------|
| `ControlBar.vue` | 新增 702 行（从 SingleFileShell 抽出的浮动控制栏，`position: fixed`） |
| `SingleFileShell.vue` | 重写，删 664 行（抽控制栏） |
| `MultiFileShell.vue` | 多文件编辑区 |
| `ProjectRunBar.vue` | 删除 |
| `player.js` | +73 行（模式切换 / snapshot） |

**`Editor.vue`、`style.css`、`App.vue`、编辑区包裹结构均未变。**

结论：用户"没改编辑区"的判断基本成立，但注意 **SingleFileShell 是编辑区的宿主**，且本次引入了**模式切换（`v-if` 销毁重建 Monaco）**这一与编辑区强相关的新机制。

### 尝试 2 —— headless 抓取首屏布局（排除布局错误）

用 headless Edge 抓 `.monaco-editor` 渲染数据：

```
monaco 768 = margin 76 + scrollable 692
margin left 13 + margin 76 = scrollable left 89 ✓
光标 font-family: "Maple Mono", ... · letter-spacing 0 · line-height 24
字体状态 loaded
```

结论：首屏布局完全自洽，**排除确定性布局错误**。

### 尝试 3 —— 模拟「单→多→单」切换（排除模式切换）

puppeteer 点击模式按钮切换后重新测量：`768 ~ 768`，布局仍自洽。结合用户确认"首次打开就有"，**排除模式切换重建**为根因。

### 尝试 4 —— 测宽对比（决定性证据）

用 Canvas `measureText` 对比 16px 下不同字体宽度：

| 字体 | 每字符宽 | "public class UserCode {" (23字符) |
|------|---------|-----------------------------------|
| **Maple Mono**（实际渲染） | **9.60px** | **220.8px** |
| **Consolas**（fallback） | **8.80px** | **202.3px** |
| 差异 | **0.8px/字符** | **18.5px ≈ 2 字符** |

Monaco 光标 x = 测宽字符宽 × 列号。若测宽用 Consolas（8.8px）而实际渲染 Maple Mono（9.6px），光标每列累积偏左 0.8px——第 20 列偏 ~16px（1.7 字符）、第 40 列偏 ~32px（3.3 字符）。**与"越往右越偏、一个字符以上"完全吻合。**

结论：**锁定根因为字体测宽与实际渲染字体不一致**。

## 三、根因

1. [Editor.vue](frontend/src/components/Editor.vue) 原代码把 Monaco 创建包在 `document.fonts.ready.then()` 里。若初始化时 **Maple Mono（近 10MB 本地 TTF）尚未加载完**，Monaco 用 fallback 字体（Consolas 8.8px）做测宽。
2. 之后字体加载完成，浏览器按 `font-display: swap` **重新渲染成 Maple Mono（9.6px）**，字符变宽。
3. `remeasureFonts()` 只在挂载后 50ms / 300ms 各跑一次 + 一次 `fonts.load().then()`。**若字体在 300ms 后才就绪，Monaco 永不再重测宽** → 光标永久偏左。

> 补充：`document.fonts.ready` 等待**所有**字体（含无关的 Google Fonts Archivo/JetBrains Mono/Noto Sans SC）加载结束。Google Fonts 在部分地区不可达时，该 Promise 的时序不可控，进一步放大问题。

## 四、修复（`Editor.vue`，约 20 行，防御性）

1. **先显式加载 Maple Mono 再初始化**，不再依赖 `document.fonts.ready`：

   ```js
   document.fonts.load("16px 'Maple Mono'").catch(() => {}).then(initMonaco)
   ```

   - 字体就绪才 create → 测宽 = 渲染 = Maple Mono → 光标对齐。
   - 加载失败则 catch 后仍初始化（测宽 = 渲染 = fallback，一致，不偏）。
2. **全局监听字体加载事件**，晚到/swap 的字体落地后强制重新测宽：

   ```js
   document.fonts.addEventListener('loadingdone', recalibrate)
   document.fonts.addEventListener('loadingerror', recalibrate)
   ```

3. **兜底延迟校准** 增加 800ms / 2000ms，覆盖字体加载特别慢的场景。
4. `recalibrate` 提升到组件顶层复用，`onBeforeUnmount` 中移除字体监听，避免泄漏。

## 五、验证结果

| 验证项 | 结果 |
|--------|------|
| `npm test`（vitest） | **119 全过** |
| `npm run build` | **通过** |
| headless 正常场景 | 布局 `768 ~ 768` 自洽；行渲染宽 **220.83px = Maple Mono** |
| headless 慢字体（拦截 .ttf 延迟 1500ms） | Monaco 等到 **4322ms** 才初始化，布局仍自洽，行渲染宽仍 **220.83px = Maple Mono** |

修复前慢字体场景的预期表现：Monaco 用 fallback 提前初始化 → 行渲染宽 202px（Consolas）→ 光标累积偏左。修复后两个场景均测宽/渲染一致（220.83px），光标与字符严格对齐。

## 六、遗留

- headless 无法真实聚焦 Monaco 光标做像素级点检，但「测宽 = 渲染字体」已被 220.83px 精确值证明，这是光标对齐的充分条件。
- 若用户机器访问 Google Fonts 被墙，`index.html` 里的 Archivo/JetBrains Mono/Noto Sans SC 仍可能拖慢首次字体加载，但已与编辑器光标无直接关系。
- 建议用户浏览器**强制刷新（Ctrl+F5）清一次字体缓存**后复验；若仍复现，需进一步确认 Edge 的字体渲染路径（`edge://settings` 的字体设置）。
