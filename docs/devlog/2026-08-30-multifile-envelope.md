# 2026-08-30 多文件 envelope（后端 + 前端发 files）开发日志

> 对应计划：`docs/plan/2026-08-30-multifile-envelope-plan.md`
> 涉及仓库：`JavaTutor`（分支 `fix/ai-tutor-panel-trace-render`）
> 状态：后端 + 前端代码完成 + 后端全量测试全绿 + 前端构建/测试通过；真实 Coze 联调与浏览器验收待做

## 背景

`javatutor-coze` 侧 Phase 2（`fetch_execution_context` 多文件读取，见其 `docs/devlog/2026-08-30-multifile-whole-project.md`）要求：Coze 侧 `state.files` 拿到完整项目结构。为此后端要把**项目全部文件**塞进发给 Coze 的入站消息，前端把全部文件随 `askQuestion` 发送。

## 改动内容

### 修改文件

| 文件 | 改动 |
|---|---|
| `model/ExplainRequest.java` | 新增 `files`（`List<Map<String,String>>`，每个元素含 `name`/`code`）+ `entryFile` + getter/setter |
| `service/CozeService.java` | `buildAgentPayload` / `streamExplain` 末尾追加 `files`/`entryFile` 参数：runId 分支与旧分支均「非空才带」`files`/`entry_file`；两个 blocking 重载末尾补 `null, null`，抽 `addFiles` 复用 |
| `controller/CozeAIController.java` | SSE `/api/ai/chat` `streamExplain` 调用处追加 `request.getFiles()` / `request.getEntryFile()` |
| `service/CozeServicePayloadTest.java` | `withRunIdBuildsFullEnvelope` 补断言 `files` + `entry_file`；新增 `withNulFilesOmitsKeys`（files/entryFile 为空时不含对应键） |
| `frontend/src/stores/player.js` | `askQuestion` body 发 `files: this.multiState.files.map(...)` + `entryFile`；`stepSnapshots` 每步补 `file` |

### 不做（沿用 Phase 1 结论）

- `deploy.yml`、`coze.properties`、`coze-local.properties`：不改。`/api/agent/execution-context` 接口与 `X-Agent-Token` 保留。

## 验证结果

| 门槛 | 命令 | 结果 |
|---|---|---|
| 后端全量测试 | `mvn test` | **108 tests** 全绿（新增 `withNulFilesOmitsKeys`，`CozeServicePayloadTest` 3 例） |
| 前端构建 | `npm run build` | 通过 |
| 前端测试 | `npm test` | 22 文件 **209 tests** 通过 |

## 遗留 / 注意事项

- `files` 为可选：单文件模式前端不发 files / 为空 → 后端 null → Coze `normalize_files` 得空 dict，行为不变。
- `entry_file` 前端当前发 `multiState.entryFile || ''`（store 未显式维护该值）；`current_step_file` + `step_facts` 按当前步文件取证据是「当前步正确性」的硬保证。
- 需**重新构建/部署 JavaTutor** + Coze 平台**重新发布 agent**；前后半段同一改动，建议一起上线（先后端后 coze）。
