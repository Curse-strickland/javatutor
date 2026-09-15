# JavaTutor 部署指南

> **线上主站**: `https://javatutor.cn` / `https://www.javatutor.cn` → `112.124.67.74`
> **首次部署与服务器侧排查**见本文；**产品发布页**（`intro.javatutor.cn`）在独立仓，见文末。

## 主流程：GitHub Actions 自动部署

**日常部署不需要手动做任何事** —— push 到 `main` 即触发
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)：

```
push to main
  → 构建后端 jar（backend/target/javatutor-backend-0.1.0.jar）
  → 构建前端 dist（frontend/dist）
  → rsync 到服务器 /opt/javatutor/
  → SCRIPT_AFTER：建 logs/config、写 coze.env、重启 javatutor、reload nginx
```

**触发条件是 `main` 分支**，PR 不触发（避免未审核代码直接上生产）。

## 线上服务器真实布局（2026-09-15 实测）

```
/opt/javatutor/                        ← rsync 的 TARGET（--delete 的靶心）
├── javatutor-backend-0.1.0.jar
├── dist/                              ← 前端静态文件真正在这里
│   ├── index.html
│   └── assets/
├── config/coze.env                    ← token，systemd EnvironmentFile 读取
└── logs/

/var/www/html  ──(软链)──→  /opt/javatutor/dist     ← nginx 的 root
/var/www/html.bak                                    ← 2026-07-19 迁移前的遗留

/etc/nginx/sites-enabled/javatutor                   ← 唯一站点文件，由 certbot 管理
/etc/letsencrypt/live/javatutor.cn/                  ← Let's Encrypt 证书（含 4 个域名）
后端 Spring Boot：127.0.0.1:8080（仅经 nginx 的 /api/ 暴露）
```

> ⚠️ **`/var/www/javatutor` 是 2026-07-19 迁移前的旧路径，nginx 已不再服务它。**
> 仓库里 `deploy/scripts/deploy.sh` 和 `deploy/nginx/javatutor.conf` 曾指向该路径，
> 已于 2026-09-15 修正。若你看到别处仍写 `/var/www/javatutor`，那是过时的。

## 🔴 红线：不要把任何文件放进 `/opt/javatutor/`

主站部署用 `rsync -avz --delete` 镜像到 `/opt/javatutor/`。**任何绕过部署流程放进去的文件，
都会在下一次主站部署时被静默删除，而且部署仍显示绿色成功。**

**同样危险的是放进 `/var/www/html/` 之下** —— 那是软链，会穿过它落进 `/opt/javatutor/dist/`，
也就是同一个靶心。

站点级静态资源（例如产品发布页）一律放 `/var/www/` 下的**独立真实目录**，例如
`/var/www/javatutor-intro/`。

## 手动部署（备用路径，非首选）

> 仅在 GitHub Actions 不可用时使用。首次需先跑 `build.sh` 产出本地构建产物。

### 第 1 步：本地构建

```bash
./deploy/scripts/build.sh
# 产物 → deploy/backend/javatutor-backend-0.1.0.jar、deploy/frontend/dist/
```

### 第 2 步：推送到服务器

```bash
./deploy/scripts/deploy.sh <user>@<host>
```

`deploy.sh` 的 `REMOTE_WEB_ROOT` 必须与 nginx 实际服务的目录一致 —— 当前为
`/opt/javatutor/dist`（与 `deploy.yml` 的 TARGET 对齐）。**改这个值前先确认线上
`nginx -T | grep root` 的结果**，否则前端推送会静默失效。

### 第 3 步：Nginx（仅首次，且线上已配置好）

线上 nginx 由 certbot 管理（HTTPS + 4 个域名 + HTTP 跳转）。

> ⚠️ **`deploy/nginx/javatutor.conf` 是部署结构参考，不是可直接使用的配置 ——
> 不要 cp 它覆盖线上文件**，那会丢掉 HTTPS 与多域名。改线上 nginx 前先
> `sudo nginx -T` 看现状，改完 `sudo nginx -t` 通过再 `sudo systemctl reload nginx`。

## 目录结构

```
deploy/
├── backend/                        ← 后端部署文件
│   ├── javatutor-backend-0.1.0.jar    构建产物（gitignored）
│   ├── application-prod.properties    生产环境配置
│   ├── start.sh / stop.sh / logs.sh
├── frontend/dist/                  ← 前端构建产物（gitignored）
├── nginx/javatutor.conf            ← Nginx 配置参考（见上方警告）
├── env/.env.prod                   ← 环境变量模板
├── scripts/
│   ├── build.sh                     本地构建
│   └── deploy.sh                    手动推送
└── README.md
```

## 安全说明

- 后端 `server.address=127.0.0.1` — 只监听本机，外部无法直连
- API Key 通过环境变量注入（`/opt/javatutor/config/coze.env`），不写死在配置文件或代码里
- 生产配置 `application-prod.properties` 不上传到 Git
- GitHub Secrets 是 **per-repo** 的：新建仓库时要各自配置 `SSH_PRIVATE_KEY` / `SSH_HOST` / `SSH_USER` / `SSH_PORT`

## 产品发布页（独立仓）

`intro.javatutor.cn` 的发布页**不属于本仓**，在
`javatutor-product-introduction-page` 仓，走自己的 workflow 部署到 `/var/www/javatutor-intro/`。
集成方案与服务器侧步骤见该仓的 `docs/plan/2026-09-15-product-intro-page-integration-plan.md`。
