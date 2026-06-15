# JavaTutor — Java 算法可视化教学工具

浏览器中编写 Java 代码 → 后端 AST 插桩 + 内存编译 + 沙箱执行 → 前端逐步播放变量快照 + 行高亮 + AI 解说。

JavaTutor 让 Java 程序的执行过程变得**完全可见**。无论是算法初学者观察数据变化轨迹，还是日常开发中快速验证一段逻辑、可视化调试复杂嵌套调用，都可以通过逐步播放变量状态、堆栈内存变化和控制流图来直观理解代码的每一步在做什么。测试模式支持直接粘贴 LeetCode 风格的 `class Solution { method }` 片段，无需手写 main 和 import，也适合刷题时快速验证思路。

详细项目文档见 [项目文档.md](项目文档.md)，部署与使用教程见 [使用指南.md](使用指南.md)。

## 功能

**代码编辑与执行**
- Monaco Editor 语法高亮，三色行高亮（上一步/当前/下一步）
- 逐步执行：单步前进/后退、自动播放、速度调节
- 控制台输出实时捕获

**内存可视化**
- 栈帧面板：函数调用栈，每帧显示局部变量、参数
- 堆对象面板：引用类型对象的字段展开，支持数组、集合、Map
- 变量值变化时闪光动画，栈帧与堆对象交叉高亮

**控制流图**
- 基于 Mermaid 的流程图实时生成
- 执行时黄色呼吸灯高亮当前节点，自动滚动跟随
- 全屏放大、缩放、SVG 下载
- 方法调用钻取（点击蓝色节点进入子方法流程图）

**AI 解说**
- 单步解说：每一步执行时解释当前行在做什么
- 整体解说：综述算法的目标、策略、数据结构、复杂度
- 自动解说模式：步进时自动生成解说
- 多平台支持：智谱 / DeepSeek / OpenAI / Kimi / 自定义端点
- SSE 流式输出，实时显示

**测试模式**
- 粘贴 LeetCode 风格的 `class Solution { method }` 片段即可运行
- 自动补 `import java.util.*;`，无需手动写 main
- 文本/逐行两种参数输入方式
- 支持 `int[]`、`int[][]`、`String[]`、`List<Integer>`、`ListNode`、`TreeNode` 等类型

**其他**
- 经典代码浏览器：30+ 内置算法示例（排序、递归、链表等）
- 文件上传：拖放 .java 文件导入
- 壁纸系统：纯色/网格/渐变/图片/视频背景 + 背景音乐
- 看板娘 Live2D 桌面助手：功能引导语录、互动反馈

## 技术栈

### 后端

<table>
<tr><th>类别</th><th>技术</th></tr>
<tr><td>语言与运行时</td><td>Java 17</td></tr>
<tr><td>Web 框架</td><td>Spring Boot 3.2（内嵌 Tomcat）</td></tr>
<tr><td>构建工具</td><td>Maven 3.9+</td></tr>
<tr><td>AST 解析</td><td>JavaParser 3.25（含 symbol-solver）</td></tr>
<tr><td>动态编译</td><td>javax.tools.JavaCompiler（内存编译，不落盘）</td></tr>
<tr><td>安全沙箱</td><td>AST 黑名单扫描 + SecurityManager 运行时拦截 + 线程隔离超时</td></tr>
</table>

### 前端

<table>
<tr><th>类别</th><th>技术</th></tr>
<tr><td>框架</td><td>Vue 3.5（Composition API）</td></tr>
<tr><td>状态管理</td><td>Pinia 3</td></tr>
<tr><td>代码编辑器</td><td>Monaco Editor 0.55</td></tr>
<tr><td>构建工具</td><td>Vite 8</td></tr>
<tr><td>CSS 框架</td><td>Tailwind CSS 3</td></tr>
<tr><td>流程图</td><td>Mermaid 11</td></tr>
<tr><td>HTTP 客户端</td><td>Axios</td></tr>
<tr><td>Markdown 渲染</td><td>marked</td></tr>
</table>

### AI 集成

<table>
<tr><th>类别</th><th>技术</th></tr>
<tr><td>通信协议</td><td>SSE（Server-Sent Events）流式输出</td></tr>
<tr><td>模型支持</td><td>GLM-4.7 / DeepSeek / GPT-4o / Kimi / 自定义 OpenAI 兼容端点</td></tr>
<tr><td>Key 管理</td><td>前端会话级存储，不上传服务器</td></tr>
</table>

## 项目结构

```
javatutor/
├── backend/src/main/java/com/javatutor/
│   ├── controller/
│   │   ├── RunController.java        # POST /api/run 全流程编排
│   │   └── ExplainController.java    # /api/explain /analyze /controlflow
│   ├── instrumentation/
│   │   └── Instrumenter.java         # JavaParser AST 插桩引擎
│   ├── compiler/
│   │   ├── InMemoryCompiler.java     # javax.tools 内存编译
│   │   ├── TraceEngine.java          # 运行时追踪引擎（磁盘副本）
│   │   ├── SourceFileObject.java     # 内存源码包装
│   │   └── ClassFileObject.java      # 字节码输出桶
│   ├── sandbox/
│   │   ├── SandboxValidator.java     # AST 层：import 白名单 + 方法/类型黑名单
│   │   └── SafeSecurityManager.java  # 运行时层：文件写/网络/进程拦截
│   ├── service/
│   │   ├── DeepSeekService.java      # AI 解说（多Provider + SSE流式）
│   │   ├── AnalyzeService.java       # 复杂度 / 算法检测
│   │   └── ControlFlowService.java   # 控制流图生成
│   └── model/                        # DTO: RunRequest/Response, ExplainRequest
├── frontend/src/
│   ├── App.vue                       # 主布局：编辑器 + 变量面板 + 控制栏
│   ├── stores/player.js              # Pinia 全局状态
│   ├── components/
│   │   ├── Editor.vue                # Monaco Editor 封装
│   │   ├── MemoryPanel.vue           # 栈帧 + 堆对象可视化
│   │   ├── ControlFlowPanel.vue      # Mermaid 控制流图
│   │   ├── AiTutorPanel.vue          # AI 解说面板（多Provider选择）
│   │   ├── TestCasePanel.vue         # 测试模式参数输入
│   │   ├── ClassicCodePanel.vue      # 经典算法示例浏览器
│   │   ├── FileUploadPanel.vue       # 文件拖放上传
│   │   ├── ConsoleOutput.vue         # 控制台输出
│   │   ├── WallpaperSelector.vue     # 壁纸/视频/音乐设置
│   │   └── Live2DWidget.vue          # 看板娘助手
│   └── style.css                     # 全局设计系统变量
├── docs/                             # 技术设计文档（沙箱、AST、堆栈等）
├── devlog/                           # 开发日志（按日期）
├── .devcontainer/                    # GitHub Codespaces 配置
├── 项目文档.md                       # 项目文档（目标、进度、分工）
├── 使用指南.md                       # 部署与使用教程
└── readme.md                         # 本文件
```

## 快速开始

### GitHub Codespaces（推荐，零安装）

点击仓库页绿色 Code → Codespaces → Create codespace on main，等待环境自动构建（约 2 分钟）。

构建完成后，打开两个终端分别启动：

```bash
# 终端 1 — 后端 (8080)
cd backend && ./mvnw spring-boot:run

# 终端 2 — 前端 (5173)
cd frontend && npm run dev
```

在 Ports 面板点击 5173 端口的小地球图标，浏览器中打开即可使用。

### 本地启动

前提：JDK 17+、Maven、Node.js 18+

```bash
# 终端 1 — 后端
cd backend
mvn spring-boot:run          # 端口 8080

# 终端 2 — 前端
cd frontend
npm install
npm run dev                   # 端口 5173，/api 代理到 8080
```

浏览器打开 `localhost:5173`。停止：`Ctrl+C` 两个终端。

## API

### POST /api/run — 执行代码

```json
// 请求
{
  "code": "public class Main { public static void main(String[] args) { int x = 1; } }",
  "mode": "default",           // "default" | "test"
  "testCases": ["[1,2,3]", "7"] // 仅测试模式
}

// 响应
{
  "success": true,
  "runId": "uuid-xxx",
  "steps": [
    { "line": 3, "variables": { "x": 1 }, "stackFrames": [...], "heap": {...}, "output": "" }
  ],
  "output": "Result: 42\n",
  "methodName": "twoSum",
  "methodSignature": "int[] twoSum(int[] nums, int target)"
}
```

### POST /api/explain — 单步解说 (SSE)

```json
// 请求
{
  "code": "...", "runId": "uuid", "step": 0, "totalSteps": 10,
  "currentLine": 3, "variables": { "x": 1 },
  "apiKey": "可选", "mode": "default",
  "apiUrl": "可选", "apiModel": "可选"
}
// 响应: SSE stream — event: chunk / data: 解说文本...
```

### POST /api/explain/overview — 整体解说 (SSE)

请求体同 `/api/explain`（不需 step/variables），返回 SSE 流式代码综述。

### POST /api/analyze — 代码分析

```json
// 请求: { "code": "...", "apiKey": "可选" }
// 响应: { "timeComplexity": "O(n²)", "spaceComplexity": "O(1)", "algorithm": "暴力枚举", ... }
```

### POST /api/controlflow — 控制流图

```json
// 请求: { "code": "..." }
// 响应: { "default": "main", "methods": { "main": { "nodes": [...], "edges": [...] } } }
```

## AI 解说配置

项目部署上线后将内置默认 API 服务。当前需自行申请免费 API Key：

- **智谱 GLM-4.7-Flash**（推荐）：前往 [open.bigmodel.cn](https://open.bigmodel.cn) 注册，免费额度充足
- **DeepSeek**：前往 [platform.deepseek.com](https://platform.deepseek.com) 注册
- 其他支持 OpenAI 兼容接口的服务商也可使用

在右侧 AI 面板展开"自定义 API"，选择平台并填入 Key 后保存即可。Key 仅保存在当前浏览器会话中，不会上传到服务器存储。

Key 格式：
- 智谱：`xxxxxxxx.xxxxxxxx`
- DeepSeek / OpenAI / Kimi：`sk-` 开头
- 自定义：任意 OpenAI 兼容端点，需额外填写 API URL 和模型名称

## 安全模型

```
① AST 静态扫描 (SandboxValidator)
   ├─ import 白名单: java.util, java.lang, java.math, java.text
   ├─ 方法黑名单: System.exit, Runtime.exec, Class.forName, 反射 invoke 等
   └─ 类型黑名单: FileWriter, Socket, Thread, ProcessBuilder 等 25 种

② 内存编译 (InMemoryCompiler) — 天然隔离，不落盘

③ 运行时沙箱 (SafeSecurityManager)
   ├─ 拦截外部命令执行、文件写/删、外部网络连接
   └─ 放行 localhost、文件读、Tomcat 内部通信
```

已知局限：`while(true){}` 纯 CPU 死循环无法被 `Thread.interrupt()` 中断；SecurityManager 在 Java 17 已标记废弃，未来计划迁移到 Docker 容器隔离。

## 贡献指南

### 文档导航

<table>
<tr><th>文档</th><th>内容</th></tr>
<tr><td><a href="项目文档.md">项目文档.md</a></td><td>项目文档：目标定位、完成进度、人员分工、技术栈、项目结构</td></tr>
<tr><td><a href="使用指南.md">使用指南.md</a></td><td>使用指南：环境部署、基本使用、测试模式、AI 解说、控制流图等</td></tr>
<tr><td><a href="docs/">docs/</a></td><td>技术设计文档：沙箱设计、堆栈可视化方案、设计规范、路线图</td></tr>
<tr><td><a href="devlog/">devlog/</a></td><td>开发日志：按日期记录的功能开发、问题排查与设计决策</td></tr>
</table>

### 开发环境搭建

```bash
# 克隆仓库
git clone https://github.com/Curse-strickland/javatutor.git
cd javatutor

# 后端 — 端口 8080
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run

# 前端 — 端口 5173（另开终端）
cd frontend
npm install
npm run dev
```

也可使用 GitHub Codespaces 零安装开发（见上方快速开始）。

### 项目约定

- **分支策略**：`main` 为稳定分支，功能开发在 feature 分支进行，完成后 PR 合并
- **提交信息**：中文简述，格式 `类型: 说明`（如 `feat: 新增 xxx`、`fix: 修复 xxx`、`refactor: 重构 xxx`）
- **后端代码**：Java 17，遵循 Spring Boot 约定，控制器编排逻辑、Service 处理业务、Model 定义 DTO
- **前端代码**：Vue 3 Composition API，状态集中在 Pinia store，组件按功能拆分
- **安全红线**：禁止提交 API Key 等敏感信息到仓库；沙箱相关改动需同步更新验收清单

### 贡献流程

1. Fork 本仓库
2. 创建 feature 分支：`git checkout -b feature/xxx`
3. 提交代码并推送
4. 提交 Pull Request，描述改动内容和验证方式
5. 至少一位成员 Code Review 后合并
