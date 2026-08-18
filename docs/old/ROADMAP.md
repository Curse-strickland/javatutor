# JavaTutor 路线图

> 最后更新：2026-06-02

---

## What's Done (MVP v1.0)

| Capability | Status |
|---|---|
| AST 解析引擎 — JavaParser 解析用户方法体为 AST | Done |
| AST 源码插桩 — ModifierVisitor 自动在赋值/声明/循环处插入 TraceEngine.record() | Done |
| 动态编译执行 — javax.tools.JavaCompiler 内存编译 + 反射运行 | Done |
| 安全沙盒 — AST 黑名单扫描 + 独立线程 + 5s 超时 | Done |
| 步骤 JSON 输出 — 每步 {step, line, variables} 结构返回前端 | Done |
| Monaco Editor 集成 — 代码编辑 + deltaDecorations 行高亮 | Done |
| 步骤播放器 — 自动播放 / 暂停 / 上一步 / 下一步 / 调速 | Done |
| 变量卡片 — Vue 响应式渲染 + 值变化 0.2s CSS 过渡 | Done |
| AI 流式解说 — DeepSeek API → SSE → 前端打字机效果 | Done |
| SVG 可视化画布 — 数组方框 + 箭头连线 + 高亮动画 | Done |
| 3 个预置算法 — 冒泡排序 / 斐波那契递归 / 链表反转 | Done |
| 毛玻璃暗色 UI — Tailwind backdrop-blur 三栏布局 | Done |
| 前后端联调 — proxy 跨域 + api-contract.json 契约 | Done |

---

## What's Next

### Phase 1 — 用户体验打磨

> 把 MVP 从"能用"变成"好用"。

What you'll see:

- **Loading / Empty / Error 三态覆盖** — 每个组件不再是白屏等待，有骨架屏和友好提示
- **快捷键支持** — `Ctrl+Enter` 运行代码，`Space` 暂停/播放，`← →` 步进
- **代码模板选择器** — 顶部下拉框快速切换预置算法，不用手动粘贴
- **移动端适配** — 三栏变单栏纵向滚动，手机上也能演示
- **暗色/亮色主题切换** — 不只有暗色，答辩教室投影仪对比度低时切亮色
- **首屏加载优化** — Monaco 按需加载，首次打开 < 2s

**You can help:** 用手机打开页面找布局问题，提 UI 改进建议，设计 Logo

---

### Phase 2 — 插桩引擎增强

> 当前只支持 `int` / `int[]` / `String`。扩展类型覆盖，让更多算法能跑。

Key changes:

- **二维数组支持** — `int[][]` 矩阵运算可视化（如动态规划填表）
- **对象类型支持** — `ListNode` / `TreeNode` 引用追踪，展开嵌套结构
- **递归树可视化** — 不只记录变量，画出调用栈的展开/回溯过程
- **多方法调用** — 用户写辅助方法（如 `swap()`），插桩穿透方法边界
- **更智能的变量发现** — 不只是赋值语句，`for-each` / `try-catch` 内的变量也能追踪

**You can help:** 提交你希望支持的算法类型（附输入输出示例），帮忙设计递归树 UI

---

### Phase 3 — AI 导师升级

> LLM 不只是"解说员"，变成能回答问题、发现错误、给出建议的"真导师"。

We're exploring:

- **多轮对话** — 学生在解说面板追问 "为什么用 j < n-i-1？"，AI 结合当前状态回答
- **错误诊断** — 代码运行抛异常时，AI 读异常信息 + 当前变量状态，告诉用户哪里写错了
- **复杂度分析** — 每步展示后附一句 "当前已比较 15 次，最优情况下只需 4 次"
- **对比讲解** — 两个算法同时跑，AI 解释为什么这个比那个快
- **Prompt 模板市场** — 用户可以切换解说风格：教授模式 / 段子手模式 / 三句话模式
- **多模型支持** — 不只 DeepSeek，接入 Qwen / Kimi / GPT 作为备选

**You can help:** 写更多 Few-shot 示例提升 AI 质量，测试不同 Prompt 的效果，推荐好用的国产模型

---

### Phase 4 — 教学功能

> 从"看算法跑"到"学算法怎么写"。

Step 1: 交互式练习

- **填空题模式** — 代码故意挖掉一行（如交换逻辑），用户填空，跑通才过关
- **单步挑战** — 只展示变量状态，不展示代码，让用户猜"这一步执行了什么"
- **速度排行榜** — 同一个算法，谁最快填对所有空

Step 2: 代码批改

- **静态检查** — 提交前 AST 扫描空指针风险 / 数组越界可能
- **风格建议** — "你的变量名 `a1` 太短，建议改成 `currentIndex`"

Step 3: 课程体系

- **算法路线图** — 排序 → 查找 → 递归 → DP → 图，渐进式关卡
- **学习记录** — localStorage 存进度，看到自己从冒泡学到快排

**You can help:** 出算法填空题，设计学习路径，测试教学功能

---

### Phase 5 — 部署与运营

> 不只答辩用，让它活下来。

What's planned:

- **一键部署脚本** — 一个 `docker-compose up` 跑通前后端 + LLM
- **学生机部署** — 阿里云/腾讯云学生机（约 10 元/月）教程
- **Vercel 前端托管** — 静态前端免费部署，后端单独放学生机
- **API Key 管理** — 前端让用户填自己的 Key，后端不存，降低运营成本
- **使用统计** — 哪些算法被跑最多次？哪一步大家最常暂停？
- **开源准备** — `README.md` 英文版 + 架构图 + 贡献指南 + MIT License

**You can help:** 写部署文档，测试 Windows/Mac/Linux 兼容性，翻译英文 README

---

## Get Involved

| How | Where |
|---|---|
| 提交 Bug | GitHub Issues |
| 讨论功能 | GitHub Discussions |
| 贡献代码 | Fork → Feature Branch → PR |
| 测试兼容性 | Windows 11 / macOS / Linux 各一台 |
| 设计 UI | Figma 画布，联系组长 |
| 写算法示例 | `examples/` 文件夹，PR 提交 |

**我们现在最缺的是：**

- **Windows 兼容性测试** — 组员里谁有 Windows 11？跑一遍前后端看有没有路径/编码问题
- **更多算法示例** — 不只冒泡/斐波那契，来几个图算法（BFS/DFS）和 DP（背包）
- **UI 细节打磨** — 当前 UI 能用但不精致，需要一个有审美的人调色卡和间距
- **Prompt 优化** — 当前 AI 解说偶尔啰嗦，需要人反复测试调教 System Prompt
