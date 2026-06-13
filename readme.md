# JavaTutor — Java 算法可视化教学工具

浏览器中编写 Java 代码 → 后端 AST 插桩 + 内存编译 + 沙箱执行 → 前端逐步播放变量快照 + 行高亮 + AI 解说。

面向算法与数据结构初学者，让抽象的代码执行过程变得可见。

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
- 零配置可用：内置智谱 GLM-4.7 免费模型，无需任何 API Key
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

| 层 | 技术 |
|----|------|
| 后端 | Java 17, Spring Boot 3.2, Maven, JavaParser 3.25 |
| 前端 | Vue 3.5, Pinia 3, Monaco Editor 0.55, Mermaid 11, Tailwind CSS 3, Vite 8 |
| AI | 智谱 GLM-4.7（默认免费）, OpenAI 兼容 API, SSE 流式 |
| 安全 | AST 黑名单扫描 + 内存编译 + SecurityManager 运行时沙箱 |

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
├── start.bat / start.sh              # 一键启动脚本
├── stop.bat                          # 一键停止脚本
├── docs/
│   ├── DESIGN.md                     # 前端设计规范
│   └── ROADMAP.md                    # 路线图
└── CLAUDE.md                         # AI 助手指令
```

## 快速开始

**Windows**：双击 `start.bat`，浏览器自动打开 `localhost:5173`。

**macOS / Linux**：
```bash
./start.sh
```

**手动启动**：

前提：JDK 17、Maven、Node.js 18+

```bash
# 终端 1 — 后端
export JAVA_HOME="/path/to/jdk-17"
cd backend
mvn spring-boot:run          # 端口 8080

# 终端 2 — 前端
cd frontend
npm install
npm run dev                   # 端口 5173，/api 代理到 8080
```

停止：双击 `stop.bat`，或 `Ctrl+C` 两个终端。

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

默认使用智谱 GLM-4.7 免费模型，无需任何配置即可使用。

如需切换平台，在右侧 AI 面板展开"自定义 API"，选择平台并填入 Key：
- 智谱：`xxxxxxxx.xxxxxxxx` 格式
- DeepSeek：`sk-` 开头 32 位
- OpenAI：`sk-` 开头
- 月之暗面 (Kimi)：`sk-` 开头
- 自定义：任意 OpenAI 兼容端点

Key 仅保存在当前浏览器会话中，不会上传到服务器存储。

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

## 设计系统

前端设计规范见 [DESIGN.md](docs/DESIGN.md)。核心原则：深灰调 + 蓝色单一 accent、卡片统一用 `.card p-3 mb-3`、可折叠面板用蓝色圆点 + chevron SVG。

## 文档索引

| 文档 | 内容 |
|------|------|
| [DESIGN.md](docs/DESIGN.md) | 前端设计规范：调色板、字体、组件模式 |
| [ROADMAP.md](docs/ROADMAP.md) | Phase 1-5 路线图 |
| [CLAUDE.md](CLAUDE.md) | AI 助手指令（项目技术约定） |
| [sandbox-design.md](docs/sandbox-design.md) | 沙箱四层架构设计 |
| [sandbox-verification-checklist.md](docs/sandbox-verification-checklist.md) | 31 条沙箱验收用例 |
| [前端分工.md](docs/前端分工.md) | 前后端分工与接口约定 |
| [devlog/](devlog/) | 按日期归档的开发日志 |

## License

MIT
