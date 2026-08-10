# 多文件项目模式与 UML 图设计

## 1. Goal

为 JavaTutor 增加“多文件项目模式”：用户上传完整多文件 Java 项目后，在不运行代码的前提下，通过静态分析在右侧面板查看三类 UML 图：流程图、类图、结构图（包/类依赖图）。M1 不做运行调试、不做导出、不做 AI 联动；数据流图与用例图放到 M2，由 LLM 辅助生成。

## 2. Scope

### In Scope (M1)

- 多文件项目上传与项目模式入口（自动识别文件夹 vs 单文件）。
- 左侧项目文件树 + 只读代码预览。
- 右侧 3 个图 tab：流程 / 类图 / 结构图，外加项目文件树 tab。
- 后端独立静态分析子系统：JavaParser 全项目解析、建模、三张图生成。
- 尽力而为解析：失败文件进入错误清单，成功文件照常出图。
- 项目规模限制：最多 50 个 `.java` 文件、总大小 2MB、单文件 500KB。
- 自动分析 + 手动“重新分析”按钮。

### Out of Scope (M1)

- 多文件运行、单步调试、变量/堆栈查看。
- 数据流图、用例图（M2，LLM 辅助）。
- 图导出/下载。
- 图节点 AI 解说联动。
- ZIP 上传。
- 服务端文件持久化（后端无状态，不落盘）。

## 3. Decisions

- **D-01**：多文件模式为纯静态分析，不运行代码。
- **D-02**：三张图由后端 JavaParser 静态分析生成；数据流图与用例图 M2 用 LLM 辅助。
- **D-03**：结构图定义为“包/类依赖图”，展示包与类的从属关系以及类间依赖边。
- **D-04**：数据流图按经典 DFD（外部实体/处理过程/数据存储/数据流）理解，代码中无直接依据，M2 由 LLM 生成。
- **D-05**：M1 只交付流程图、类图、结构图三张静态图。
- **D-06**：拖入/选择文件夹自动进入项目模式；拖入单个 `.java` 仍走现有单文件模式。
- **D-07**：项目模式左侧为项目文件树，点击文件在 Monaco 中只读预览。
- **D-08**：项目模式右侧 tab 为：流程 / 类图 / 结构图 / 文件树；隐藏变量、控制台等运行期面板。
- **D-09**：流程图按“每个类、每个方法一张图”组织，方法调用可跨文件跳转。
- **D-10**：进入项目模式默认展示入口类 `main` 方法的流程图；找不到入口时展示第一个可解析类的第一个方法。
- **D-11**：类图默认展示全部类，含类名、字段、方法，以及继承/实现/关联/依赖关系；点击类高亮关系边并显示方法签名清单。
- **D-12**：结构图包含包节点与类节点两级；包可展开/收起；点击类节点高亮其依赖边。
- **D-13**：依赖规则为类型引用全量：字段类型、方法参数、返回值、局部变量类型、继承/实现、方法调用。
- **D-14**：上传方式仅支持文件夹/多文件选择，浏览器读取文件内容后整体 JSON 提交，不落盘。
- **D-15**：进入项目模式后自动分析，并提供“重新分析”按钮。
- **D-16**：解析失败的文件不影响其他文件出图，失败信息按文件展示在文件树与错误清单中。
- **D-17**：后端返回结构化图数据（JSON），前端用 Mermaid 渲染并实现高亮、折叠、跳转。
- **D-18**：M1 不支持导出图。
- **D-19**：M1 不做图节点与 Coze AI 解说的联动。

## 4. Architecture

采用独立“项目静态分析”子系统，与现有单文件编译/运行链路完全隔离。

### Frontend

- `ProjectFileTree.vue`：项目文件树；每个文件显示解析状态（成功/失败）；失败文件可点击查看错误清单。
- `ProjectCodePreview.vue`：复用 Monaco，以只读方式预览当前选中文件。
- `FlowDiagramPanel.vue`：跨文件方法流程图；方法节点可跳转到对应类/方法；默认展示入口方法。
- `ClassDiagramPanel.vue`：类图；点击类高亮关系边，下方显示方法签名清单。
- `StructureDiagramPanel.vue`：包/类两级依赖图；包节点可展开/收起；点击类高亮依赖边。
- `App.vue`：按上传类型自动切换单文件模式与项目模式；项目模式隐藏运行期面板。
- `stores/player.js`：扩展项目模式状态（项目文件、当前选中路径、分析结果、图 tab、错误清单）。

### Backend

- `ProjectController`：`POST /api/project/analyze`。
- `ProjectAnalysisService`：编排解析、建模、三张图生成。
- `ProjectModelBuilder`：JavaParser 解析全部文件，构建类/方法/包/类型依赖模型。
- `FlowGraphBuilder`：按类/方法生成流程图，跨文件调用 target 使用完全限定名。
- `ClassDiagramBuilder`：生成类图（类、字段、方法、关系）。
- `StructureGraphBuilder`：生成包/类两级依赖图。
- `ParseErrorCollector`：按文件收集解析错误。

## 5. Data Flow

```text
用户拖入/选择文件夹
  -> 前端递归收集 .java 文件（保留相对路径，去重，校验上限）
  -> 自动进入项目模式
  -> POST /api/project/analyze {files:[{path, code}]}
  -> 后端返回 {entry, flow, classDiagram, structure, errors}
  -> 前端默认展示入口类 main 流程图
  -> 用户可在 3 个图 tab 与文件树间切换
  -> “重新分析”按钮重新发送当前文件集合
```

## 6. Interface Contracts

### 6.1 Request

```json
{
  "files": [
    { "path": "src/main/java/com/demo/Main.java", "code": "..." }
  ]
}
```

### 6.2 Response

```json
{
  "entry": { "class": "com.demo.Main", "method": "main" },
  "flow": {
    "classes": [
      {
        "name": "com.demo.Main",
        "methods": [
          { "name": "main", "nodes": [], "edges": [], "targets": ["com.demo.Service:run"] }
        ]
      }
    ]
  },
  "classDiagram": {
    "classes": [
      { "id": "com.demo.Main", "label": "Main", "fields": [], "methods": [] }
    ],
    "relations": [
      { "from": "com.demo.Main", "to": "com.demo.Service", "type": "depends_on" }
    ]
  },
  "structure": {
    "packages": [
      { "id": "com.demo", "classes": ["com.demo.Main", "com.demo.Service"] }
    ],
    "dependencies": [
      { "from": "com.demo.Main", "to": "com.demo.Service" }
    ]
  },
  "errors": [
    { "path": "src/main/java/Broken.java", "message": "..." }
  ]
}
```

### 6.3 ID Convention

- 图节点 id 使用完全限定类名（如 `com.demo.Main`），保证跨文件唯一。
- 方法 target 使用 `完全限定类名:方法名`。
- 依赖边 from/to 使用完全限定类名。
- `relations[].type` 取值限定为 `extends`、`implements`、`associates`、`depends_on`。

## 7. Error Handling & Boundaries

- 解析策略：尽力而为。每个文件独立解析，失败文件不进图模型，但出现在 `errors` 中。
- 入口：优先找含 `main(String[])` 的类；找不到则用第一个可解析类的第一个方法；无任何可解析类时返回空图 + 全局错误。
- 依赖解析：优先完全限定名匹配；解析不了的外部类型跳过并可选标注 `external`。
- 规模限制：前端与后端双重校验：≤50 个 `.java`、总 ≤2MB、单文件 ≤500KB。
- 空项目/无 `.java` 文件：进入项目模式前拦截提示。
- 前端渲染兜底：Mermaid 渲染失败时显示“渲染失败 + 原始数据”，不崩溃；交互基于结构化数据而非 Mermaid DOM id。
- 重复路径：按相对路径去重；同名同路径以后者覆盖。

## 8. Testing & Acceptance

### Backend Unit Tests

- `ProjectModelBuilderTest`：多文件解析、包名归类、重复路径覆盖、失败文件隔离。
- `FlowGraphBuilderTest`：跨文件方法调用 target 解析、默认入口选择、找不到入口兜底。
- `ClassDiagramBuilderTest`：继承/实现/字段/参数/返回值/局部变量类型依赖、外部类型跳过。
- `StructureGraphBuilderTest`：包内类聚合、跨包依赖边、孤立类。
- `ParseErrorCollectorTest`：单文件失败不影响其他文件。

### Backend Integration Test

- `ProjectControllerTest`：样例项目验证 `POST /api/project/analyze` 返回 `entry/flow/classDiagram/structure/errors` 契约。

### Frontend Testing

- 核心纯函数（依赖折叠、入口默认选择、超限校验）做单元测试。
- 组件与交互以浏览器手工验收为主。

### Acceptance Scenarios

1. 拖入含 `main` + 多个类的文件夹：自动进入项目模式，默认显示 `main` 流程图，方法节点可跳到其他类的方法。
2. 类图展示全部类、字段、方法、关系；点击类高亮相关边并显示方法清单。
3. 结构图展示包/类两级；包可展开收起；点类高亮依赖边。
4. 放入一个含语法错误的文件：其余图正常，文件树标注失败，点击可见错误信息。
5. 超过 50 文件 / 2MB / 单文件 500KB：前端拦截提示。
6. 现有单文件模式回归：编译、运行、变量、流程图、AI 均不受影响。

## 9. M2 (Deferred)

- 数据流图：经典 DFD，由 LLM 辅助生成。
- 用例图：由 LLM 从入口点与公开 API 启发式生成。
- 可选：图导出、图节点 AI 解说联动、ZIP 上传。

## 10. Related Docs

- [前端 readme](../../../frontend/readme.md)
- [单文件控制流图实现](../devlog/2026-06-10-controlflow-layout-fixes.md)
- [展示设计](../superpowers/specs/2026-08-07-javatutor-showcase-design.md)
