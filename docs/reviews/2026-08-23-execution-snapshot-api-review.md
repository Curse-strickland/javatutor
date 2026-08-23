# 2026-08-23 执行快照 API Review

> 审查对象：JavaTutor `feat/execution-snapshot-api`
> 对应计划：`docs/superpowers/plans/2026-08-23-execution-snapshot-api-plan.md`
> 状态：**已按计划执行并通过验证**

## 结论

计划 Task 1-5 代码全部完成,自动化回归全绿,本地端到端验证通过:执行快照模型、内存存储、带 token 鉴权的内部查询接口、run 成功后保存、chat 时更新位置与 Coze payload 瘦身均已就位。Coze 侧只需凭 `runId` 拉取上下文,不再依赖入站消息携带完整执行数据。

## 验证记录

| 门槛 | 命令 | 结果 |
|---|---|---|
| 后端全量测试 | `./mvnw.cmd test` | **100 tests** 全绿 |
| 新增单测 | 见各 `*Test` | Snapshot 1 + Store 4 + Controller 4 + Service 2 + CozePayload 2 全部通过 |
| 前端测试 | `npm test` | 13 文件 / **129 tests** |
| 前端构建 | `npm run build` | 通过 |
| 端到端 | 启动后端 + curl | 401(无/错 token)、404(不存在 runId)、200(存在 runId 返回源码+steps) |

## Findings

### 无阻塞项

- 接口契约与 spec 一致:`GET /api/agent/execution-context/{runId}` 与 `X-Agent-Token`。
- 鉴权逻辑正确:token 未配置或与请求头不符均返回 401;`runId` 不存在返回 404;成功返回快照。
- `runId` 由后端 UUID 生成,保持唯一业务键语义;TTL 30 分钟;快照不长期保存用户代码。
- Coze payload 瘦身正确:有 `runId` 只发送最小 envelope,无 `runId` 回退旧完整 payload,保留本地旧链路兼容。

### 计划修正(1 处,已记录)

计划内 `InMemoryExecutionSnapshotStore.save()` 无条件覆盖 `expiresAtEpochMs = now + TTL`,与测试需注入过期快照的意图矛盾,致 2 个测试必失败。已在实现中修正:仅当 `expiresAtEpochMs <= 0` 才盖章默认 TTL,否则尊重传入值。真实路径行为不变。

## 遗留

- **真实 Coze 联调未做**(需部署 coze + HTTPS + 浏览器验收)。coze 侧 `fetch_context.py` / `tools/fetch_execution_context` / `state.run_id` 已与本契约吻合。
- **提交未做**:按计划约定不主动 commit / push,待用户明确指示。
