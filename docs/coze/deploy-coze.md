# Coze Token 部署配置（GitHub Actions → 阿里云）

> 目标：Coze API token **不进仓库、不进 jar**，只存在于服务器环境变量，部署时由 GitHub Secrets 注入。

## 机制总览

```
GitHub Secrets (COZE_API_TOKEN)
      │
      ▼  deploy.yml: SCRIPT_AFTER 写入
服务器 /opt/javatutor/config/coze.env   (COZE_API_TOKEN=xxx)
      │
      ▼  systemd javatutor.service: EnvironmentFile 读取
Spring Boot 运行时环境变量 COZE_API_TOKEN
      │
      ▼  @Value("${coze.api.token}") ← ${COZE_API_TOKEN:} 占位符解析
CozeService
```

## 一、仓库内配置（已改好）

| 文件 | 内容 |
|------|------|
| `backend/src/main/resources/coze.properties` | url/project-id 明文；`coze.api.token=${COZE_API_TOKEN:}` 占位符，**无明文 token** |
| `backend/src/main/resources/application.properties` | `spring.config.import=optional:classpath:coze.properties,optional:classpath:coze-local.properties` |
| `backend/src/main/java/com/javatutor/service/CozeService.java` | `@Value` 读取上述配置；本地用 gitignore 的 `coze-local.properties` 覆盖 token |
| `.gitignore` | 忽略 `coze-local.properties`、`application-local.properties`（防本地真实密钥误提交） |
| `.github/workflows/deploy.yml` | SCRIPT_AFTER 写入 token 到 `/opt/javatutor/config/coze.env` |

## 二、GitHub Secrets 设置

在仓库 Settings → Secrets and variables → Actions → New repository secret:

| Secret 名 | 值 |
|-----------|-----|
| `COZE_API_TOKEN` | Coze 平台生成的 API token |

> 现有 `SSH_PRIVATE_KEY`、`SSH_HOST`、`SSH_USER`、`SSH_PORT` 等部署 secrets 保持不变。

## 三、服务器 systemd 配置（一次性）

登录阿里云服务器，创建/修改 systemd 服务文件 `javatutor.service`，加入 `EnvironmentFile`：

```ini
[Service]
# 已有配置...
EnvironmentFile=/opt/javatutor/config/coze.env
# 可选：无需明文 token 时的降级开关（COZE_ENABLED=false 会禁用 coze）
ExecStart=/usr/bin/java -jar /opt/javatutor/javatutor-backend-0.1.0.jar
```

应用配置：

```bash
sudo mkdir -p /opt/javatutor/config
sudo systemctl daemon-reload
sudo systemctl restart javatutor
```

> 若已有 coze.env 且 token 不变，重启后 token 自动生效；若服务器上未配置 EnvironmentFile，coze 会因 token 为空而**自动禁用**（`CozeService.isEnabled()` 检查），前端复杂度/标签/问答显示"AI 未启用"类提示，不影响其他功能。

## 四、本地开发

本地运行时设置环境变量即可，无需改代码：

```bash
# Git Bash
export COZE_API_TOKEN="你的token"
cd backend && mvn spring-boot:run
```

或创建 `backend/src/main/resources/coze-local.properties`（已被 gitignore，不入库）：

```properties
coze.api.token=你的token
```

## 五、验证

- **无 token**：`POST /api/ai/analyze` 返回 `{"error":"未配置 AI Key..."}`，说明 coze 禁用、未发请求。
- **有 token**：`POST /api/ai/analyze` 返回复杂度 JSON，说明 coze 正常启用。
- **部署后**：`sudo systemctl cat javatutor | grep EnvironmentFile` 应显示 coze.env；`sudo systemctl show javatutor -p Environment` 可确认运行时环境变量已注入。
