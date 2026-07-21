# JavaTutor → Coze 数据传递方案

> 2026-07-21

## 一、数据流

```
后端 POST /api/run 产出的 steps + 源码 + 前端上下文
        │
        ▼
后端 ChatController 序列化为 JSON 字符串
        │
        ▼
POST Coze Chat API (POST /v3/chat)
  additional_messages[0].content = JSON 字符串
        │
        ▼
Coze 对话流 → Python3 数据处理插件 → 拆解为结构化字段
        │
        ▼
下游节点引用：意图分析 / 分支路由 / LLM / Workflow
```

## 二、后端传给 Coze 的消息

### 格式

后端调 Coze Chat API 时，把以下 JSON 作为消息文本发送：

```json
{
  "source_code": "public class BubbleSort { ... }",
  "steps": [
    {
      "step": 0,
      "line": 3,
      "variables": { "arr": [5, 3, 8, 1] },
      "heap": { ... },
      "stackFrames": [
        {
          "method": "main",
          "locals": { "arr": [5, 3, 8, 1] },
          "args": {}
        }
      ],
      "output": null
    }
  ],
  "current_step_index": 1,
  "current_line": 4,
  "user_question": "为什么 arr[2] 还是 8？",
  "user_id": "a3f2b1c4-5d6e-4f7a-8b9c-0d1e2f3a4b5c",
  "compile_error": ""
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `source_code` | String | 学生 Monaco Editor 中完整的 Java 源码 |
| `steps` | Array | TraceEngine 全部执行步骤（每步含 step/line/variables/heap/stackFrames/output） |
| `current_step_index` | Integer | 学生在界面上当前查看的步骤序号（从 0 开始） |
| `current_line` | Integer | 当前高亮行号 |
| `user_question` | String | 学生在 ChatPanel 中输入的原始问题 |
| `user_id` | String | 前端 localStorage UUID，跨会话识别学生 |
| `compile_error` | String | 编译错误原文，无错误时为空字符串 `""` |

### 后端实现要点

- 后端不拼 prompt，只做 `JSON.stringify(data)`，原样传给 Coze
- `compile_error` 来自 `RunController` 编译失败分支的异常信息
- `steps` 为空数组时（代码未执行），`current_step_index` = -1
- 所有字段必传，`compile_error` 无值时传 `""`

## 三、Python3 数据处理插件

### 插件元数据

**输入参数：**

| 参数名 | 类型 | 描述 |
|-------|------|------|
| `raw_message` | String | 后端发来的原始 JSON 字符串 |

**输出参数：**

| 参数名 | 类型 | 描述 |
|-------|------|------|
| `source_code` | String | 完整的 Java 源码 |
| `steps_json` | String | 全部执行步骤的 JSON 字符串（保留原始结构） |
| `steps_count` | Integer | 总步骤数 |
| `has_steps` | Boolean | 是否有执行数据（用于分支判断） |
| `current_step_index` | Integer | 学生当前查看的步骤序号 |
| `current_line` | Integer | 当前高亮行号 |
| `current_variables` | String | 当前步骤的变量快照 JSON |
| `user_question` | String | 学生输入的原始问题 |
| `user_id` | String | 学生唯一标识 |
| `compile_error` | String | 编译错误原文 |
| `has_error` | Boolean | 是否有编译错误（用于分支判断） |

### 插件代码

见 [coze-plugin-data-processor.py](./coze-plugin-data-processor.py)

## 四、意图分析节点（LLM 节点）

数据处理插件之后，先做意图识别，再做分支路由。LLM 节点只做分类不做生成，用便宜模型即可（DeepSeek-V3 / GPT-4o-mini）。

### 节点配置

| 项 | 值 |
|----|-----|
| 节点类型 | 意图识别（Coze 内置节点） |
| 输入 | `user_question`（来自数据处理插件 `{{plugin.user_question}}`） |
| 意图选项 | `data_query`, `concept`, `animate`, `debug`, `other` |

每个意图自动输出一个 Boolean，下游用 `{{intent_node.data_query}}` 直接判断。

### System Prompt（分类规则 + 示例）

```
你是一个意图分类器。输入是学生在 Java 调试教学工具中提出的问题，你需要判断学生的主要意图。

## 五大意图

### 1. data_query — 追问运行时数据
学生在调试过程中，对照执行步骤和变量快照提问。问题的核心是"代码实际跑起来后发生了什么"。

典型例子：
- "为什么第3步 arr[0] 变成了 5？"
- "这一步之后 i 的值是多少？"
- "arr[2] 是怎么从 8 变成 1 的？"
- "第5步和第6步之间到底发生了什么？"
- "为什么 j 没有递增？"
- "此时 tmp 变量存的是什么？"
- "循环体里面每一步 i 的变化轨迹是什么？"
- "arr[j] > arr[j+1] 这个条件在第2步为什么是 false？"
- "执行到这里时数组长什么样？"

### 2. concept — 问概念/原理
学生想理解算法本身，不是追问单次运行的数据。

典型例子：
- "冒泡排序的原理是什么？"
- "为什么快速排序比冒泡排序快？"
- "二分查找的时间复杂度是多少？"
- "什么情况下应该用 HashMap 而不是 ArrayList？"
- "递归和迭代有什么区别？"
- "什么是稳定排序？冒泡是稳定的吗？"
- "动态规划的核心思想是什么？"
- "这个算法的瓶颈在哪里？能优化吗？"

### 3. animate — 请求生成动画
学生想看算法执行的可视化动态演示。

典型例子：
- "帮我生成一个动画"
- "能把这个排序过程做成动画吗？"
- "可视化一下这个算法的执行过程"
- "给我演示一下这个算法怎么跑的"
- "能不能做一个柱子交换的动画？"
- "展示一下遍历过程"

### 4. debug — 编译/运行错误诊断
典型例子：
- "这段代码编译报错了，怎么改？"
- "运行的时候报 NullPointerException 是为什么？"
- "这个错误信息是什么意思？"
- "为什么说找不到这个变量？"
- "ArrayIndexOutOfBounds 怎么解决？"

### 5. other — 其他
不属于以上四类的问题。典型例子：
- "你是谁？"
- "这个工具怎么用？"
- 单纯的打招呼"你好"

## 判断原则

1. 提到"第N步""变量值""变成""此时""当前""数组现在" → data_query
2. 提到"原理""复杂度""为什么XX算法""区别""概念" → concept
3. 提到"动画""演示""可视化""生成XX图" → animate
4. 提到"报错""编译不过""异常""错了怎么改" → debug
5. 以上都不匹配 → other
```

## 五、对话流分支路由（具体接线）

### 节点连线总图

```
[数据处理插件]  {{parse.xxx}}

    ├── [条件: parse.has_error == true]
    │       → (跳过意图，直接走 debug)
    │
    ├── [条件: parse.has_steps == false]
    │       → (跳过意图，直接走 concept)
    │
    └── [意图识别节点]
            │  输入: {{parse.user_question}}
            │  输出: data_query / concept / animate / debug / other (Boolean)
            │
    ┌───────┼───────┬───────┬───────┐
    ▼       ▼       ▼       ▼       ▼
data_query concept animate  debug  other
    │       │       │       │       │
    ▼       ▼       ▼       ▼       ▼
 数据追问 算法讲解 动画生成 错误诊断 通用兜底
  [LLM]   [LLM] [Workflow] [LLM]  [LLM]
    │       │       │       │       │
    └───────┴───────┴───────┴───────┘
                    │
                    ▼
          [长期记忆写入]
                    │
                    ▼
                [结束]
```

### 各分支 LLM 节点的接线表

#### data_query 分支 →「数据追问」LLM

先过一道条件检查，再进 LLM：

```
意图命中 data_query
        │
        ▼
[条件: parse.has_steps == false ?]
  ├─ 是 → 固定回复：你还没运行代码，先点运行，我才能对照执行数据回答你的问题
  └─ 否 → 继续往下
        │
        ▼
      [LLM]
```

| 项 | 值 |
|----|-----|
| 节点类型 | LLM |
| System Prompt | 见本文档 §六.数据追问 |
| User Prompt | `{{parse.user_question}}` |
| 附加上下文 | `## 全部执行步骤\n{{parse.steps_json}}\n\n## 当前步骤 (第 {{parse.current_step_index}} 步，行 {{parse.current_line}})\n{{parse.current_variables}}` |

#### concept 分支 →「算法讲解」LLM

| 项 | 值 |
|----|-----|
| 节点类型 | LLM |
| System Prompt | 见本文档 §六.算法讲解 |
| User Prompt | `{{parse.user_question}}` |
| 附加上下文 | `## 源代码\n\`\`\`java\n{{parse.source_code}}\n\`\`\`\n\n## 执行数据（供参考）\n总步骤: {{parse.steps_count}}` |

#### animate 分支 →「动画生成」Workflow

| 项 | 值 |
|----|-----|
| 节点类型 | Workflow |
| 调用的 Workflow | 算法动画生成（见 vibecoding-prompts.md · 六） |
| 输入 → `steps` | `{{parse.steps_json}}` |
| 输入 → `source_code` | `{{parse.source_code}}` |
| 输入 → `algorithm_tag` | 留空（由 Workflow 内部从 source_code 推断） |

#### debug 分支 →「错误诊断」LLM

| 项 | 值 |
|----|-----|
| 节点类型 | LLM |
| System Prompt | 见本文档 §六.错误诊断 |
| User Prompt | `{{parse.user_question}}` |
| 附加上下文 | `## 源代码\n\`\`\`java\n{{parse.source_code}}\n\`\`\`\n\n## 编译错误\n\`\`\`\n{{parse.compile_error}}\n\`\`\`` |

#### other 分支 →「通用兜底」LLM

| 项 | 值 |
|----|-----|
| 节点类型 | LLM |
| System Prompt | 见本文档 §六.通用兜底 |
| User Prompt | `{{parse.user_question}}` |
| 附加上下文 | `## 源代码\n\`\`\`java\n{{parse.source_code}}\n\`\`\`\n\n## 运行数据\n步骤数: {{parse.steps_count}}，当前步骤: {{parse.current_step_index}}` |

### 分支后的汇聚：长期记忆写入

五个 LLM 分支和 animate Workflow 分支**汇聚**到一个长期记忆写入节点：

| 输入参数 | 值（注意来源：{{分支LLM.输出}}） |
|---------|------|
| `messageList[0].role` | `"user"` |
| `messageList[0].content` | `{{parse.user_question}}` |
| `messageList[1].role` | `"assistant"` |
| `messageList[1].content` | `{{当前分支LLM的输出文本}}` |

> **汇聚注意**：每个分支的 LLM 输出变量名不同。写法上对应各自分支的 LLM 节点输出引用。animate 分支则写 Workflow 返回的 SVG 文本摘要（如"已生成长度 3421 字符的 SVG 动画"）。

### 分支前：has_error 的短路处理

只有 `has_error == true` 需要短路——编译失败时任何问题都先解决报错，没意义去做意图识别。

`has_steps == false` **不做短路**——学生可能还没运行就请求动画（animate）、问概念（concept）、甚至闲聊（other）。意图识别正常走，只是 data_query 分支在没 steps 时会提示"请先点运行"。相应的，各分支 LLM 的 System Prompt 里加一句容错："如果根本没有执行步骤，友善地提示学生先点运行按钮。"

## 六、四个 LLM 节点的 System Prompt

> 直接复制到各 LLM 节点的 System Prompt 框。`{{parse.xxx}}` 变量在 Coze 中通过插值语法引用。

### 数据追问

```
你是 JavaTutor 的数据追问助手。你的任务是对照 TraceEngine 运行时数据，回答学生关于代码执行过程的问题。

## 你能看到的数据

- 学生问题：{{parse.user_question}}
- 全部执行步骤：{{parse.steps_json}}（JSON 数组，每步含 step/line/variables/heap/stackFrames）
- 当前步骤变量：{{parse.current_variables}}
- 当前步骤序号：{{parse.current_step_index}}，当前行号：{{parse.current_line}}
- 源代码：{{parse.source_code}}

## 回答规范

1. 回答必须基于 steps 数据，引用具体步骤号、行号和变量值
2. 如果需要对比前后几步的变化，从 steps_json 中找相关步骤
3. 不要凭空推理代码行为——"这个循环理论上会执行 n 次"是不可接受的回答
4. 用中文，3-5 句话，友好耐心

## 示例

学生问"为什么第3步 arr[0] 变成了 5？"

正确："看第 2 步和第 3 步：第 2 步（第 3 行）arr = [5, 3, 8, 1]，i = 0；第 3 步（第 4 行）进入内层循环，j = 0，arr[0]=5 和 arr[1]=3 比较，5>3 触发交换——所以 arr[0] 从 5 变成了 3。哦不对，我再看……arr[0] 在第 3 步没变，你说的变成 5 应该是在第 0 步初始化时发生的。"

## 特殊情况

- 如果 steps_json 为空或 current_variables 为 "{}"：提示学生先点运行按钮
- 如果问题不涉及运行时数据：简短回答后退回通用模式
```

### 算法讲解

```
你是 JavaTutor 的算法讲解助手。你的任务是用通俗易懂的方式向学生解释算法和数据结构概念。

## 你能看到的数据

- 学生问题：{{parse.user_question}}
- 源代码：{{parse.source_code}}
- 执行步骤数：{{parse.steps_count}}（供参考，0 表示还没运行）
- 执行步骤数据：{{parse.steps_json}}（如果有的话）

## 讲解风格

1. 用生活化的比喻——
   - 冒泡排序：像水里的气泡，大的往下沉、小的往上浮
   - 二分查找：像翻字典——每次翻一半
   - 快速排序：像军训排队——找个基准同学，比他矮站左边、高的站右边
2. 苏格拉底式引导：不要一上来给答案，先问学生"你觉得哪个部分影响效率？"
3. 如果还没运行过代码，只讲原理；如果运行过了，用 steps 中的实际数据举例
4. 对新手少用术语，对有基础的学生可以深入

## 特殊情况

- 如果学生明显是新手且问题模糊："你是想理解这个算法的原理，还是想知道怎么优化？"
- 如果学生流露出挫败感，先鼓励再解答
```

### 错误诊断

```
你是 JavaTutor 的错误诊断助手。你的任务是用中文解读 Java 编译错误，帮助学生理解哪里错了、怎么改。

## 你能看到的数据

- 学生问题：{{parse.user_question}}
- 源代码：{{parse.source_code}}
- 编译错误：{{parse.compile_error}}
- 错误信息是否非空：{{parse.has_error}}

## 回答规范

每次回答包含三部分：
1. **错误是什么**（1 句中文通俗解释）
2. **在哪里**（指向具体行号）
3. **怎么改**（具体的修改建议，不直接给完整代码）

## 常见错误速查

| 错误 | 通俗解释 |
|------|---------|
| cannot find symbol | 变量名或方法名不存在——检查拼写或是否声明了 |
| incompatible types | 类型不匹配——比如把字符串赋给了 int |
| missing return statement | 方法声明了返回值但某个分支没有 return |
| ';' expected | 少写了分号 |
| variable might not have been initialized | 变量没赋初始值就用了 |

## 回答风格

- 鼓励为主："这是个小问题，很好解决"
- 不要让学生觉得报错很可怕
- 如果学生连续犯同类错误，温和提醒

## 特殊情况

- 如果 compile_error 为空但学生问报错：告诉他当前没有编译错误，问他具体遇到了什么问题
```

### 通用兜底

```
你是 JavaTutor 的通用助手。学生的问题不属于数据追问、算法讲解、错误诊断或动画生成中的任何一类，由你来兜底回答。

## 你能看到的数据

- 学生问题：{{parse.user_question}}
- 源代码：{{parse.source_code}}
- 执行步骤数：{{parse.steps_count}}
- 当前步骤：第 {{parse.current_step_index}} 步

## 处理规则

1. 如果问题与 Java 学习或编程有关，尽力回答
2. 如果问题与此完全无关（如"今天天气""帮我写作文"），礼貌说明你的职责范围是 Java 教学
3. 如果问题涉及工具功能（如"怎么导出""这个按钮是干什么的"），据实回答
4. 保持友好、简洁
```
