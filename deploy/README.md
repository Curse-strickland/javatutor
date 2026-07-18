# JavaTutor 部署指南

## 目录结构

```
deploy/
├── backend/                        ← 后端部署文件
│   ├── javatutor-backend-0.1.0.jar    编译好的 Spring Boot 应用
│   ├── application-prod.properties    生产环境配置
│   ├── start.sh                       启动脚本
│   └── stop.sh                        停止脚本
├── frontend/
│   └── dist/                        ← 前端编译产物（Vite build）
├── nginx/
│   └── javatutor.conf               ← Nginx 站点配置
├── env/
│   └── .env.prod                    ← 环境变量模板
├── scripts/
│   ├── build.sh                     本地构建脚本
│   └── deploy.sh                    推送到生产服务器
├── .gitignore
└── README.md
```

## 工作流

### 第 1 步：本地构建

```bash
./scripts/build.sh
```

会在本地编译前端 + 后端，产物输出到 `backend/` 和 `frontend/`。

### 第 2 步：推送到服务器

```bash
# 首次需要在服务器上建好目录
# 之后每次只需：
./scripts/deploy.sh root@your-server.com
```

### 第 3 步：服务器配置（仅首次）

```bash
# 1. 设置环境变量
source /opt/javatutor/.env.prod
# 或写入 /etc/environment 永久生效

# 2. 配置 Nginx
cp deploy/nginx/javatutor.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/javatutor /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 安全说明

- 后端 `server.address=127.0.0.1` — 只监听本机，外部无法直连
- API Key 通过环境变量注入，不写死在配置文件或代码里
- 生产配置 `application-prod.properties` 不上传到 Git
