# 修复计划：日志目录不可写导致后端启动失败（线上 502）+ 本地遗留合并冲突（5173 白屏）

> 现象（用户报告，2026-09-11）：
> 1. 本地启动前后端，`localhost:5173` 一片空白；
> 2. 在 javatutor.cn 执行**正确**代码，报 `Unexpected token '<', "<html>\n<h"... is not valid JSON`，无法正常执行；
> 3. 向 agent 发消息，报 `HTTP 502`。
>
> 结论：**现象 2 与 3 是同一个根因的两面**——线上后端因新引入的日志文件 appender 打不开日志目录而**启动即退出**，
> nginx 对 `/api/*` 一律回 502 HTML 错误页；现象 2 只是前端把那张 HTML 当 JSON 解析后的**次生报错**。
> **现象 1 与线上无关**，是本地工作区停在一次**未完成的 merge** 里、两个文件带着冲突标记。
>
> 本计划只覆盖 **JavaTutor 仓**（`javatutor`），不涉及 `javatutor-coze`。

## 0. 根因与证据

### 0.1 现象 2 / 3：后端进程不在，nginx 回 502 HTML

| 探针 | 结果 |
|---|---|
| `curl -s -o /dev/null -w "%{http_code}" https://javatutor.cn/api/run` | `502`，`Server: nginx/1.18.0 (Ubuntu)`，`Content-Type: text/html`，`Content-Length: 166`，body `<html>\n<head><title>502 Bad Gateway</title>...` |
| 同上，`/api/ai/chat`、`OPTIONS /api/run` | 同为 `502`（**含 OPTIONS** ⇒ 不是某个接口的问题，是整个 upstream 不在） |
| `https://javatutor.cn/` | `200`（nginx 活着、`dist/` 在服务，**挂的只有后端**） |

body 与现象 2 里那串 `<html>\n<h` **逐字吻合**，可确定现象 2 的报错文本就是这张 502 页。

### 0.2 后端为什么起不来：logback 配置 ERROR 被 Spring Boot 判为致命

`LogbackLoggingSystem.reportConfigurationErrorsIfNecessary` 会把 logback 配置阶段的**任何** ERROR 状态升级成启动失败——
「日志少写几条」于是变成了「整个应用不启动」。

本地已复现（把日志目录指到一个必然不可写的位置）：

```
JAVATUTOR_LOG_DIR="Z:/definitely-not-writable" java -jar backend/target/javatutor-backend-0.1.0.jar --server.port=8081
→ java.lang.IllegalStateException: Logback configuration error detected:
  ERROR ... RollingFileAppender[APP_FILE] - openFile(.../app.log, true) call failed. java.io.FileNotFoundException
  ERROR ... RollingFileAppender[REQUEST_FILE] - openFile(.../request.log, true) call failed. java.io.FileNotFoundException
  at org.springframework.boot.logging.logback.LogbackLoggingSystem.reportConfigurationErrorsIfNecessary(LogbackLoggingSystem.java:277)
→ [ERROR] Process terminated with exit code: 1
```

来源：本次合并（PR #46，`ad8eec5`）新增了 [logback-spring.xml](../../backend/src/main/resources/logback-spring.xml) 的两个
`RollingFileAppender`（`APP_FILE`/`REQUEST_FILE`），目录取自 `javatutor.logging.dir`；而
[deploy.yml](../../.github/workflows/deploy.yml) 的 `SCRIPT_AFTER` 用 **`sudo mkdir -p /opt/javatutor/logs`** 建目录（root 所有），
systemd 服务却是以**非 root 用户**运行的 ⇒ 服务用户对该目录没有写权限 ⇒ 上面的 `FileNotFoundException` ⇒ 启动失败 ⇒ nginx 502。

> 这是**推断**，T0 的三条取证命令用于确认（尤其 `User=`）；若取证结果不符，见 §3.3 的备选分支。

### 0.3 现象 1：本地工作区停在未完成的 merge

```
$ git status
On branch feat/decision-trace-unused-fields
You have unmerged paths.
  (fix conflicts and run "git commit")
  (use "git merge --abort" to abort the merge)
...
Unmerged paths:
	both modified:   frontend/src/stores/player.js
	both modified:   frontend/src/utils/decisionTrace.test.js
```

两个文件在**磁盘上**确实带着冲突标记：

- [player.js:1-9](../../frontend/src/stores/player.js#L1-L9) — `<<<<<<< HEAD` / `>>>>>>> 4c35e75`
- [decisionTrace.test.js:97-116](../../frontend/src/utils/decisionTrace.test.js#L97-L116) — 同款标记

`.git/MERGE_HEAD` = `4c35e75`（*refactor(logging): 用 logging 包完整日志取代 config 旧版过滤器*），
merge message 为 `Merge branch 'feat/decision-trace-unused-fields' of github.com:... into feat/decision-trace-unused-fields`。

`npx vite build` 的直接报错：`[PARSE_ERROR] Encountered diff marker src/stores/player.js:3:1` —— 解析失败 ⇒ 白屏。

**这次合并的结果远端已经存在**，且是干净的：

| ref | commit | 冲突标记 |
|---|---|---|
| `origin/feat/decision-trace-unused-fields` | `5e9d081 resolve merge conflict` | 无 |
| `origin/main` | `ad8eec5 Merge pull request #46 from Curse-strickland/feat/decision-trace-unused-fields` | 无 |

（已逐字核对：`git show origin/main:frontend/src/stores/player.js | grep -c '<<<<<<<'` → `0`；测试文件同为 `0`。）

⇒ **不需要手工解冲突**，本地直接取回远端已解决的版本即可（见 T2）。

## 1. 全局约束

- 只改 JavaTutor 仓；**不碰** `javatutor-coze`。
- 不改 `frontend/src/backup-20260807/`（备份副本，含同名 `AiTutorPanel.vue`）。
- **不做 git 写操作**（本计划的执行者若需 commit/push，须由仓库所有者明确指示）。
  T1 里的 `merge --abort` / `checkout` / `reset --hard` 属于**破坏性**操作，执行前须确认本地无其他未提交改动
  （见 T1 的前置检查）。
- 下列内容**不在本计划**：coze `critic.py` 的 G1–G5、时间线 R1（回退后新问答被折叠吞掉）、
  「冒泡排序→插入排序」误判。见 §7。

## 2. 改动清单

| # | 优先级 | 文件 | 改动 |
|---|---|---|---|
| T0 | P0（线上取证） | —（服务器命令） | 确认后端死因是 logback 目录权限，并拿到服务运行用户 |
| T1 | P0（线上） | —（服务器命令） | `chown` 日志目录 + 重启服务，先让站点恢复 |
| T2 | P0（本地） | `frontend/src/stores/player.js`、`frontend/src/utils/decisionTrace.test.js` | 结束遗留 merge，取回 `origin` 上已解决的版本 |
| T3 | P0（防复发） | `.github/workflows/deploy.yml`、`deploy/scripts/deploy.sh`、`docs/logging-guide.md` | 部署期保证日志目录对服务用户可写 |
| T4 | P1（回归） | `backend/src/main/java/com/javatutor/config/GlobalExceptionHandler.java` | 404/405 不再被兜底成 500 |
| T5 | P1（可选，推荐） | `frontend/src/utils/http.js` | 非 2xx 时抛出可读错误，不再让 `Unexpected token '<'` 盖住真相 |
| T6 | P2（可选硬化） | `backend/.../logging/LogDirEnvironmentPostProcessor.java`（新）+ `META-INF/spring.factories` | 日志目录不可写时降级到临时目录，不阻断启动 |

---

## 3. T0 + T1（P0）：线上先恢复

### 3.1 取证（先看清再动手）

```bash
sudo systemctl status javatutor --no-pager
# 期望：inactive (dead) / failed，而**不是** active (running)

sudo journalctl -u javatutor -n 80 --no-pager \
  | grep -i -B2 -A6 "RollingFileAppender\|Logback configuration error\|openFile"
# 期望：命中 §0.2 那段 IllegalStateException + FileNotFoundException

sudo systemctl cat javatutor | grep -E "User=|Group=|WorkingDirectory=|EnvironmentFile=|ExecStart="
# 目的：拿到服务运行用户（下面 chown 用）与 EnvironmentFile 是否已挂上
```

### 3.2 修复

```bash
sudo mkdir -p /opt/javatutor/logs
sudo chown -R <上面 User>:<Group> /opt/javatutor/logs     # unit 未写 User= 则为 root:root，此时见 §3.3
sudo chmod 755 /opt/javatutor/logs
sudo systemctl restart javatutor
```

验证：

```bash
systemctl is-active javatutor
sudo -u <User> touch /opt/javatutor/logs/.probe && sudo -u <User> rm /opt/javatutor/logs/.probe   # 真能写，而不是「看起来能写」
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' \
     -d '{"code":"public class A { public static void main(String[] a){ int x=1; } }"}' \
     https://javatutor.cn/api/run
# 期望 200
```

> 说明：**别用 `curl https://javatutor.cn/api/run`（GET）当验证**——`/api/run` 是 POST 接口，
> 除 502 外它还可能是 405/500（见 T4），无法区分「服务已恢复」与「另有一类错误」。

### 3.3 备选分支（取证不符时）

- 若 `status` 为 `active (running)`：后端活着，问题在 nginx 侧或端口。
  查 `sudo grep -rn "proxy_pass" /etc/nginx/` 是否指向 `127.0.0.1:8080`
  （`application.properties` 有 `server.address=127.0.0.1`，nginx 必须走回环）；
  再看 `sudo journalctl -u javatutor -n 100 --no-pager` 里有无别的 `Application run failed`。
- 若 unit **确实没写 `User=`**（即 root 运行）：目录权限理论上是够的，则改查磁盘满
  （`df -h /opt`）、`/opt/javatutor` 挂载只读、SELinux 之类，不要盲目 chown。

### 3.4 应急回退（5 分钟内定位不了时）

用 **PR #46 之前**那次成功的 Deploy 把旧制品顶回去（该次构建不含日志改动，站点先可用）：

```bash
gh run list -R Curse-strickland/javatutor --workflow=Deploy --limit 10
gh run rerun <#46 之前那条成功的 run id>
```

重跑是对**同一个旧 commit** 重新构建部署 ⇒ 旧 jar + 旧 `dist` ⇒ 回到合并前状态。
随后再按 §3.1 慢慢定位。**注意**：这会一并撤下日志能力与前端新功能，仅作救火。

---

## 4. T2（P0）：本地结束遗留 merge

前置检查（`merge --abort` 会丢弃这次未完成的合并产物，先确认没有别的东西要留）：

```bash
cd <javatutor 仓库>
git status --short          # 除那 21 个 merge 相关条目外，是否还有别的未提交改动
git stash list              # 或有需要保留的 stash
```

主路径（本地产物已在远端，直接取回）：

```bash
git merge --abort
git fetch origin
git checkout main
git pull --ff-only                       # 期望 fast-forward 到 ad8eec5（= origin/main）
```

若希望继续留在原分支上：`git reset --hard origin/feat/decision-trace-unused-fields`
（= `5e9d081`，与 main 内容一致）。

手工解冲突的备用路径（**推荐照抄远端，别自己拼**）：

```bash
git checkout origin/main -- frontend/src/stores/player.js frontend/src/utils/decisionTrace.test.js
```

其解析结果（供 review 对照，两处都是「**两边都要**」而非二选一）：

- `player.js:1-9` —— HEAD 侧的三行导入**与本分支的 `http` 都要**（`player.js` 里同时用到
  `http(...)`、`allowedPanels`、`buildGoalPrompt`、`MAX_TIMELINE`）：

  ```js
  import { defineStore } from 'pinia'
  import { detectTutorialCategory } from '../utils/algoTutorialMap.js'
  import { http } from '../utils/http.js'
  import { allowedPanels, algoSubTabs } from '../constants/uiPanelManifest.js'
  import { buildGoalPrompt } from '../utils/editSuggestion.js'
  import { MAX_TIMELINE, buildCheckpointLabel } from '../utils/timeline.js'
  ```

- `decisionTrace.test.js:97-116` —— 保留 main 侧的
  `it('annotates step_facts result status on the tool line', ...)` **和**紧随其后的修订用例
  （三条断言含 `revised: false → '评审未通过（未修订）'`），一个都不能少。
  该用例标题沿用 main 的 `shows revise text only when critic failed and revised`
  （分支侧改成了 `for all critic-failed cases`，但按远端为准；标题已略不精确，可选顺手改正）。

自检：

```bash
grep -rn "<<<<<<<\|>>>>>>>" frontend/src --include=*.js --include=*.vue
# 应无输出（assets/fonts/*.ttf 的匹配是二进制误报，忽略）
cd frontend && npx vite build
# 不应再出现 [PARSE_ERROR] Encountered diff marker ...
```

---

## 5. T3（P0，防复发）：部署期让日志目录对服务用户可写

### 5.1 `.github/workflows/deploy.yml` — `SCRIPT_AFTER`

当前（会造出 root 所有、服务用户不可写的目录）：

```yaml
sudo mkdir -p /opt/javatutor/config
sudo mkdir -p /opt/javatutor/logs
```

改为：

```yaml
sudo mkdir -p /opt/javatutor/config
sudo mkdir -p /opt/javatutor/logs
# 日志目录必须对**服务运行用户**可写：logback 打不开日志文件会直接让 Spring Boot 启动失败，
# 表现为 nginx 全部 /api/* 回 502（见 docs/plan/2026-09-11-log-dir-permission-502-...）。
sudo chown -R <User>:<Group> /opt/javatutor/logs
sudo chmod 755 /opt/javatutor/logs
```

`<User>` 取 §3.1 `systemctl cat javatutor` 的实际值。
（更彻底的做法是给 unit 加 `LogsDirectory=javatutor` 并把 `JAVATUTOR_LOG_DIR` 指到 `/var/log/javatutor`——
systemd 会以正确属主预建目录，从根上不需要 chown；但会同时改动 unit、`logs.sh` 的默认值与文档，**本次不做**，
可在 T3 验证通过后另开小改动。）

> **`--delete` 的连带确认**：`ARGS: "-avz --delete"` 的删除作用域是**被同步的目录**，
> 这里只有 `frontend/dist` → `/opt/javatutor/dist/`，`config/`、`logs/` 是同级的旁系目录，理论上不受影响。
> 但它是本 bug 的**复发点**（目录被删 ⇒ 服务起不来、token 丢失且 agent 静默禁用），
> 部署一次后务必 `ls -la /opt/javatutor` 确认 `config/coze.env` 与 `logs/` 都还在。

### 5.2 `deploy/scripts/deploy.sh`（手工部署路径）

它目前只 `scp deploy/backend/logs.sh`，**既没有 `mkdir -p $REMOTE_DIR/logs`，也没有赋权**——
而 `start.sh`（nohup 路径）同样假设目录已存在。补一段，紧跟第 1 步之后：

```bash
# ---- 1b. 保证日志目录存在且对运行用户可写（logback 打不开会直接让应用启动失败）----
echo ""
echo "[1b/2] 准备日志目录 ..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR/logs && chmod 755 $REMOTE_DIR/logs"
```

（手工路径以 root 登录，故无需 `chown`；若该路径改为非 root 部署，需与 5.1 同样赋权。）

### 5.3 文档

- [docs/logging-guide.md:21](../../docs/logging-guide.md#L21) 目前只写了「生产 `/opt/javatutor/logs/`（由
  `JAVATUTOR_LOG_DIR` 注入）」，**漏掉了关键前提**。补一句：
  「该目录**必须对 systemd 服务运行用户可写**——logback 打开日志文件失败会被 Spring Boot 判为配置错误，
  应用直接退出（exit 1），外部表现为 nginx 对全部 `/api/*` 返回 502。」
- [docs/coze/deploy-coze.md:40-49](../../docs/coze/deploy-coze.md#L40-L49) 的 systemd 片段处同上加一行注记。

---

## 6. T4（P1，回归修复）：404 / 405 被兜底成 500

`GlobalExceptionHandler` 的 `@ExceptionHandler(Exception.class)` 把**所有**未捕获异常都变成 500，
包括 Spring 6.1 的 `NoResourceFoundException`（静态资源 404）与 `HttpRequestMethodNotSupportedException`（405）。

实测（本地 8080）：`GET /` → `500 {"success":false,"error":"No static resource .","requestId":"..."}`（合并前是 404）。

影响：监控与前端都会把「路径不存在」误读为「服务器故障」；`curl https://javatutor.cn/api/run`（GET）
也会显示 500 而非 405，干扰 T1 的验证判断。

修法（`@ExceptionHandler` 按最具体匹配，**原 catch-all 保持不变**）：

```java
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@ExceptionHandler(NoResourceFoundException.class)
public ResponseEntity<Map<String, Object>> handleNotFound(NoResourceFoundException e) {
    // 路径不存在：保住 404 语义，别让兜底把「没有这个资源」说成「服务器故障」（否则监控/前端都会误判）
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("success", false, "error", "not found"));
}

@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
public ResponseEntity<Map<String, Object>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
            .body(Map.of("success", false, "error", "method not allowed"));
}
```

> `HttpRequestMethodNotSupportedException` 在 `spring-web`（`org.springframework.web`），
> `NoResourceFoundException` 在 `spring-webmvc`（`org.springframework.web.servlet.resource`），
> 两者均无需新增依赖。`Map.of` 返回不可变且**不允许 null 值**，这里都是字面量常量，安全。

---

## 7. T5（P1，可选但推荐）：别让 `Unexpected token '<'` 盖住真相

现象 2 之所以难懂，是因为后端不可用时 nginx 回的是 HTML，而前端拿它去 `res.json()`。
[player.js:146-151](../../frontend/src/stores/player.js#L146-L151) 直接 `const data = await res.json()`，**没有 `res.ok` 检查**；
[player.js:451](../../frontend/src/stores/player.js#L451)（`/api/ai/chat`）有检查，所以它至少报了 `HTTP 502`——两者都只说了症状。

最小单点修法：在 [http.js](../../frontend/src/utils/http.js)（已有封装，注释自称「等价于 axios 拦截器」）里，
把 `.then(response => ...)` 改成先判 `response.ok`：

```js
      if (!response.ok) {
        // 后端未启动时反向代理会回 HTML 错误页（nginx 502）；调用方直接 res.json() 会抛
        // `Unexpected token '<'`，把真实原因盖住。这里换成可读错误。
        const text = await response.text().catch(() => '')
        const hint = /^\s*</.test(text) ? '（后端未启动或不可用）' : ''
        throw new Error(`HTTP ${response.status}${hint}`)
      }
      return response
```

**爆炸半径需知**：`http()` 现有 7 个调用点（`player.js` 6 处、`UmlPanel.vue` 1 处）。
本项目业务错误走的是 **HTTP 200 + body 内 `code` 字段**（`/api/run` 失败即 `{code:400, error:...}`，
见 `__tests__/player-timeline.test.js` 的 mock），因此 `!response.ok` 只会命中真正的传输/HTTP 层错误，
不会误伤业务错误分支。`player.js:451` 的自查 `if (!response.ok)` 会变成不可达，但语义不变（同样抛错），
可顺手删掉并让错误信息更准确。

保守替代方案（若不想动公共封装）：只在 `player.js:146` 那一处补 `if (!res.ok) throw new Error(...)`。
**倾向单点修法**：现象 2 有 7 个潜在入口，只堵一个明年还会再来一次。

---

## 8. T6（P2，可选硬化）：日志目录不可写不该等于应用启不来

T3 已从**部署侧**防住；T6 防的是 T3 覆盖不到的路径（换机器、改路径、运维手滑、磁盘满、权限被 reset）。

思路：在 Spring **配置阶段**、logback 初始化**之前**校验目录，不可写就降级——这样故障从「全站 502」
降为「日志落在临时目录 + 一条告警」。

新增 `backend/src/main/java/com/javatutor/logging/LogDirEnvironmentPostProcessor.java`（约 30 行）：
读 `javatutor.logging.dir`，`Files.isWritable` 探测或其父目录可创建性探测；不可写则把该属性覆盖为
`${java.io.tmpdir}/javatutor-logs`，并打印一条 WARN 说明降级原因。注册于
`backend/src/main/resources/META-INF/spring.factories`：

```properties
org.springframework.boot.env.EnvironmentPostProcessor=\
com.javatutor.logging.LogDirEnvironmentPostProcessor
```

**取舍**：降级后日志落到 `/tmp`（可能被系统清理，也不是运维预期位置），但**服务是活的**——
对「教学站点整站不可用」而言这个交换划算。若认为不值得增加一个启动期钩子，可只做 T3 并跳过本节，
但需接受「同样的故障会再发生一次」。

---

## 9. 验证清单

| 项 | 命令 | 期望 |
|---|---|---|
| 本地前端冲突已清 | `grep -rn "<<<<<<<" frontend/src --include=*.js --include=*.vue` | 无输出（忽略 `*.ttf` 二进制误报） |
| 本地前端构建 | `cd frontend && npx vite build` | 通过，无 `[PARSE_ERROR] ... diff marker` |
| 本地前端测试 | `cd frontend && npx vitest run` | 全绿（本次修复前基线：**28 文件 / 340 用例**） |
| 本地前端起来了 | `npm run dev` → 打开 `localhost:5173` | 页面正常渲染，**不再是白屏** |
| 本地后端测试 | `cd backend && ./mvnw test` | 全绿（含合并新增的 `LogMaskerTest`、`RequestLoggingFilterTest`） |
| 本地端到端 | 起后端 + 前端各跑一次带 `main` 的类 | 控制器输出正常，无 `Unexpected token '<'` |
| T4 回归修复 | `curl -i http://localhost:8080/` / `curl -i http://localhost:8080/api/run` | `404` / `405`，**不再是 500** |
| 线上服务 | `systemctl is-active javatutor` | `active` |
| 线上接口 | 见 §3.2 的 POST `curl` | `200`（不再是 502） |
| 线上页面 | 浏览器执行一段正确代码 + 发一条 agent 消息 | 均正常，无 JSON 解析报错、无 502 |
| T3 防复发 | 触发一次 Deploy（合入 main），再跑 §3.2 的两条命令 | 仍 200；且 `ls -la /opt/javatutor` 里 `config/`、`logs/` 都在 |
| 日志真落地 | `sudo -u <User> ls -la /opt/javatutor/logs/` | 有 `app.log`、`request.log` 且在增长 |

## 10. 不纳入本计划

- **coze `critic.py` 的 G1–G5**（PR #14 / `holycandle/harness` 的 `revise_node` 改动）：其中 G1 为
  `_split_edit_block` 只覆盖 `【编辑建议】`，若 `【视角导航】` 排在它之前会落进正文而被「不要 JSON」重写吃掉。
  属 coze 仓，另开。
- **时间线 R1**（回退后**新**提问的问答被折叠区吞掉）：已在
  `docs/reviews/2026-09-10-coze-agent-goal-binding-and-timeline-review.md` 记录，按该 review 的建议单独排。
- **「冒泡排序→插入排序」误判**：队友在修，本计划不碰。
- **`GlobalExceptionHandler` 兜底 500 打 ERROR 全栈**：属设计意图（最后一道防线），保留。
