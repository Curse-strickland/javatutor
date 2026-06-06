# 2026-06-06 安全沙箱 Step 4: 整合与文档

## 工作概述

完成沙箱三层防护的整合收尾，修整数处细节，写设计文档供团队交接。

## 整合清理

### RunController 序号修复

之前插入了新步骤后，注释编号重复（两个 ④、两个 ⑤ 等），已全部理顺：

```
① runId 生成
② AST 黑名单扫描 (SandboxValidator)
③ 提取类名 (extractClassName)
④ AST 插桩 (Instrumenter)
⑤ 移除 package 声明
⑥ 内存编译 (InMemoryCompiler)
⑦ ClassLoader 加载
⑧ TraceEngine.reset()
⑨ 安全沙箱执行 (SecurityManager + 5s 超时)
⑩ TraceEngine.getSteps()
⑪ 返回 RunResponse
```

### extractClassName 错误提示优化

旧：`代码语法错误，请检查代码格式`
新：`代码格式错误：缺少 public class 声明，请确保代码包含完整的类定义`

当用户只写了裸 main 方法没有外层 class 时，能一眼看出缺什么。

## 设计文档

新建 `docs/sandbox-design.md`，供后续开发者和答辩使用。内容包括：

- 四层纵深防御架构图
- 每一层的详细规则（白名单/黑名单/拦截策略）
- 完整执行流程图
- 已知局限（AST 短名匹配、死循环绕过超时等）
- 维护指南（如何加新规则、改白名单、调超时）

## 当前沙箱文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `sandbox/SandboxValidator.java` | 187 | AST 层：import 白名单 + 方法/类型黑名单 |
| `sandbox/SafeSecurityManager.java` | 102 | 运行时层：文件/网络/进程拦截 |
| `controller/RunController.java` | 197 | 编排：串联三层 + 线程隔离 + 超时 |
| `pom.xml` | 70 | 配置：`-Djava.security.manager=allow` |
| `docs/sandbox-design.md` | 新建 | 设计文档 |
| `devlog/2026-06-06-sandbox-step1-2.md` | 新建 | Step 1-2 开发日志 |
| `devlog/2026-06-06-sandbox-step3.md` | 新建 | Step 3 开发日志 |
| `devlog/2026-06-06-sandbox-step4.md` | 新建 | 本日志 |

## 验收检查表

- [x] 冒泡排序正常运行
- [x] `import java.io.File;` 第一行 → 被 AST 层拦截
- [x] `import` 写在文件末尾 → 提示"import 必须写在文件顶部"
- [x] `System.exit(0)` → 被 AST 层拦截
- [x] `new java.io.FileWriter("test.txt")` → 被 AST 层拦截（短名匹配 FileWriter）
- [x] `System.exit(1)` → 被 AST 层拦截
- [x] 缺少 `public class` → 提示"缺少 public class 声明"
- [x] 前后端均正常启动

## 后续建议

1. **测试完善** — 在 `InstrumenterTest.java` 旁新增 `SandboxValidatorTest.java`，覆盖所有黑名单/白名单规则
2. **死循环防护** — 当前 `Thread.interrupt()` 无法中断纯 CPU 死循环（如 `while(true){}`）。考虑用 ProcessBuilder 启动子进程隔离，或字节码注入计数器
3. **内存限制** — 用户代码可以 `new int[Integer.MAX_VALUE]` 撑爆内存。考虑在子线程设置 `-Xmx` 或使用 `ByteArrayOutputStream` 限制
4. **并发安全** — SecurityManager 是 JVM 全局单例。当前单请求无问题，若未来支持并发需加锁保护
5. **SecurityManager 替代方案** — Java 17 已标记 deprecated，JDK 未来版本可能彻底移除。可选替代：Java Agent（字节码级拦截）或进程级 Docker 容器隔离
