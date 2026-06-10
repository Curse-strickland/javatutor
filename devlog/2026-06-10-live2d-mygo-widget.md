# MyGO 看板娘前端集成

**日期**: 2026-06-10

## 概述

将 MyGO 看板娘（Live2D 动态角色）集成到 JavaTutor 前端，作为全局 UI 插件。用户可在右下角看到一个可交互的二次元角色，鼠标悬浮页面元素时触发萌系对话气泡。

---

## 涉及的资源

| 资源 | 来源 |
|:--|:--|
| Live2D 渲染框架 | `萌萌看板娘/live2d-widget/` — stevenjoezhang/live2d-widget 开源项目 |
| 6 个 MyGO 角色模型 | `036`~`040` 的 `.moc` + `.mtn` + `.exp.json` + 纹理 (Cubism 2 格式) |

---

## 改动内容

### 新增文件

| 路径 | 说明 |
|:--|:--|
| `frontend/public/live2d/` | 整个看板娘运行时 (~390 文件) |
| `frontend/public/live2d/autoload.js` | 入口脚本，已将 base 路径改为 `/live2d/` |
| `frontend/public/live2d/waifu-tips.js` | Rollup 打包的核心逻辑，**修改** — 注入 `window.__live2dModel` 暴露模型引用 |
| `frontend/public/live2d/waifu-tips.json` | **自定义** — 对话配置，全部选择器改为 JavaTutor 真实 DOM |
| `frontend/public/live2d/waifu.css` | **修改** — 默认位置从左下角改为右下角，看板娘放大至 400×400 |
| `frontend/public/live2d/expression-zones.js` | **新建** — 鼠标区域→表情联动（见下方详细说明） |
| `frontend/public/live2d/live2d.min.js` | Cubism 2 渲染核心 |
| `frontend/public/live2d/models/{036..040}_school_summer-2023/` | 5 个 MyGO 模型，各有自己的 `index.json` |

### 修改文件

| 文件 | 改动 |
|:--|:--|
| `frontend/index.html` | `</body>` 前加 `<script src="/live2d/autoload.js"></script>` |

### 对原有框架的适配改动

1. **`waifu.css` — 左侧 → 右侧**: `#waifu` 和 `#waifu-toggle` 的定位从 `left:0` 改为 `right:0`，工具栏从 `right:-10px` 改为 `left:-10px`，toggle 动画方向同步调整
2. **`autoload.js` — 移除 `cubism5Path`**: 注释掉外部 CDN 引用，所有模型是 Cubism 2 格式，不需要 Live2D 官方 SDK
3. **`waifu-tips.json` — 对话精细化重写**: 原来 mouseover/click 粗粒度分组（如 `.ctrl-btn:not(.run-btn)` 涵盖 4 个不同按钮），全部拆分为每个按钮/区域独立对话，使用 `[title="..."]` 属性选择器精准匹配。

### mouseover 映射表（共 27 个触发点）

**编辑器 & 数据区：**

| 选择器 | 触发场景 | 示例对话 |
|:--|:--|:--|
| `.editor-card` | 代码编辑器 | "主人在写什么神奇的功能呢？让我悄悄看一眼～" |
| `.variable-panel` | 变量卡片区 | "每一个变量的变化都逃不过我的眼睛～" |
| `.heap-stack-panel` | 堆/栈面板 | "栈帧一层一层，就像千层蛋糕一样！" |
| `.console-panel` | 控制台输出 | "System.out.println 的归宿就在这里！" |
| `.splitter` | 分屏拖拽条 | "左手写代码，右手看数据，完美搭配～" |

**播放控制按钮（每个独立）：**

| 选择器 | 按钮 | 示例对话 |
|:--|:--|:--|
| `[title='运行代码']` | ▶ 运行 | "要运行代码了吗？好紧张好紧张！(๑•̀ㅂ•́)و✧" |
| `[title='跳到第一步']` | ⏮ 跳到开头 | "回到原点！不忘初心方得始终嘛～" |
| `[title='上一步']` | ◀ 上一步 | "后退一小步，Debug 一大步！" |
| `[title='下一步']` | ▶ 下一步 | "向前迈进一步！离成功又近了一点～" |
| `[title='跳到最后']` | ⏭ 跳到结尾 | "一键直达！主人喜欢先看结果再回头看过程？" |
| `[title='开始自动播放'], [title='暂停自动播放']` | 自动播放/暂停 | "自动播放模式！解放双手～" / "暂停一下！让我喘口气" |

**控制栏其他：**

| 选择器 | 触发场景 | 示例对话 |
|:--|:--|:--|
| `.speed-btn` | 速度选择 | "调快一点？还是慢一点？主人喜欢什么节奏呢？" |
| `.ai-toggle-btn` | AI 解说按钮 | "AI 老师上线啦！有什么问题尽管问～" |
| `.progress-track` | 进度条 | "进度条君正在努力前进中！加油加油！" |
| `.drag-handle` | 控制栏拖动 | "拖动控制栏找个舒服的位置吧！" |
| `.control-bar` | 控制栏整体 | "播放、暂停、调速、AI 解说…一切尽在掌控中！" |

**状态提示：**

| 选择器 | 触发场景 | 示例对话 |
|:--|:--|:--|
| `.global-loading` | 编译中 | "嗡嗡嗡…后端正在努力编译主人的代码呢～" |
| `.global-error` | 报错提示 | "NullPointerException？主人你是不是又忘了初始化了…" |

**看板娘工具按钮（7 个）：** `#waifu-tool-*` 全部保留，对话改为编程语境（如 "一台照片一个 Star ⭐"、"写代码也要穿得漂漂亮亮的！"）。

### click 映射表（8 个触发点）

点击运行/跳转/AI/编辑器/关闭报错按钮时触发对应萌系短句。

### 季节 & 时段消息

- 新增 **1024 程序员节**："愿你的世界只有 0 Error, 0 Warning！"
- 时段消息全部加入编程语境（凌晨→"再不睡我要生气了！"）

---

4. **`expression-zones.js` — 鼠标区域 → 表情联动 + 点击彩蛋**

**Part A — 表情联动：** 鼠标在不同 UI 区域时自动切换看板娘表情。

| 鼠标所在区域 (CSS 选择器) | 触发表情 | 冷却 |
|:--|:--|:--|
| `.editor-card` 编辑器 | `thinking01` 思考脸 🤔 | 5s |
| `[title='运行代码']` 运行按钮 | `kime01` 决意脸 😤 | 3s |
| `.progress-track` 进度条 | `smile01` 开心脸 😊 | 4s |
| `.variable-panel` 变量区 | `serious01` 认真脸 🧐 | 5s |
| `.heap-stack-panel` 堆栈面板 | `thinking02` 深思脸 💭 | 5s |
| `.global-error` 报错提示 | `sad01` 难过脸 😢 | 5s |
| `.global-loading` 编译中 | `surprised01` 惊讶脸 😯 | 3s |
| `.ai-toggle-btn` AI 解说 | `kandou01` 感动脸 ✨ | 4s |
| `[title='跳到第一步'],[title='跳到最后']` 跳转 | `smile02` | 3s |
| `[title='上一步'],[title='下一步']` 逐步 | `serious02` | 2s |
| `.control-bar` 控制栏 | `idle` 放松 | 3s |
| 离开所有区域 | `idle` 默认 | 2s |

**Part B — 点击彩蛋：** 监听 `live2d:tapbody` 事件，在 2 秒窗口内累计连击：

| 连击次数 | 彩蛋效果 |
|:--|:--|
| 3 次 | "不要一直戳我啦！虽然不痛但是很害羞的…(*/ω＼*)" |
| 5 次 | "呀！还戳！主人是戳戳怪吗！(╯>□<)╯" |
| 7 次 | "…主人你是不是太闲了？代码写完了吗就在这戳我！" |
| 10 次 🎉 | "十连击！！主人你赢了…我认输！(oT-T)ノ" + 模型变 `shame01` 害羞脸 3 秒 |
| 15+ 次（每 5 次一跳） | "第 N 下了…主人求求你别戳了，我要报 Bug 了！🐛" |

彩蛋消息延迟 1.5s 显示，避免与框架自带的 `tapBody` 消息撞车。

5. **`waifu.css` — 看板娘放大**: `#live2d` canvas 尺寸从 300×300 → **400×400**，视觉上放大 33%。

---

## 冲突检查结果

| 检查项 | 结论 |
|:--|:--|
| DOM ID 冲突 | 无 — `#waifu` / `#live2d` 与 Vue `#app` 不重叠 |
| CSS z-index | 无 — waifu 用 `1`，控制栏用 `100`，waifu 在下层 |
| localStorage | 无 — waifu 用 `waifu-*` 前缀，Pinia 不使用 localStorage |
| 事件监听覆盖 | 无 — 全部 `addEventListener`，不覆盖 |
| Canvas 冲突 | 无 — `window.Image` 劫持不影响 Vue 组件 |
| `L2DWidgetConfig` | **删除** — 该上游版本不支持 `position`/`width_limit` 配置，已从 `index.html` 移除 |

---

## 技术要点

- 模型是 **Cubism 2** 格式，通过 `live2d.min.js` 渲染，无需 Cubism 5 Core
- 每个模型目录下有 `index.json`，将动作组映射为引擎标准名：`idle01` → `idle`，`angry*/cry*/sad*` → `tap_body`，`surprised01` → `flick_head`
- 点击模型身体触发 `tap_body` 动作组（随机选择愤怒/哭泣/害羞动画），鼠标悬浮头部触发 `flick_head`
- 所有文件放在 `public/` 下，Vite 直接静态托管，无需构建配置
- 后端 Spring Boot 不需任何修改
- 表情联动通过 `window.__live2dModel` 桥接：`waifu-tips.js` → 暴露引用 → `expression-zones.js` 消费
- 表情名称按 `model.json` 中 `expressions[].name` 取值，不同模型可能存在细微差异；zone 脚本有自动 fallback 到 `idle` / `default` / `smile01`

---

## 已知限制

- 对话气泡依赖 CSS 选择器匹配，如果前端 DOM 结构或 `title` 属性变更，部分 mouseover/click 提示可能失效
- `waifu-tips.json` 中的 `welcome` 消息会自动读取页面 `<title>`，效果良好
- 模型换装功能实际依赖 `textures.cache`，这 5 个模型各只有一套纹理，换装按钮会提示"没有其他衣服"
- 表情联动依赖 `window.__live2dModel`，若切换模型后引用未更新，需在 `waifu-tips.js` 的模型加载处重新赋值（当前仅在初始化时赋值一次）
- 连击彩蛋在切换模型后计数器会保留（不清零），属于 feature 不是 bug
