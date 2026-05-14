# 本机长期稳定部署指南（Windows）

适用场景：项目部署在公司内网一台 Windows 电脑，供同事长期访问。\
项目目录：`d:\manager_vb\projects`\
访问地址示例：`http://192.168.110.239:5000`

***

## 1. 一次性安装

1. 安装 Node.js 20 LTS
2. 安装 pnpm

```powershell
npm i -g pnpm
```

1. 安装 pm2（用于守护进程、重启恢复）

```powershell
npm i -g pm2
```

***

## 2. 环境变量（必须）

在 Windows 系统环境变量中配置（用户变量或系统变量均可）：

```env
COZE_SUPABASE_URL=https://xxxx.supabase.co
COZE_SUPABASE_ANON_KEY=sb_publishable_xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
NEXT_PUBLIC_FEISHU_APP_ID=cli_xxx
NEXT_PUBLIC_FEISHU_APP_SECRET=xxxx
```

配置后必须：

1. 关闭当前 PowerShell
2. 新开 PowerShell
3. 验证变量

```powershell
echo $env:COZE_SUPABASE_URL
echo $env:COZE_SUPABASE_ANON_KEY
```

***

## 3. 首次部署

```powershell
cd d:\manager_vb\projects
pnpm install
pnpm build
```

本地试运行：

```powershell
pnpm start
```

浏览器验证：`http://localhost:5000`

***

## 4. 防火墙放行 5000（内网访问）

管理员 PowerShell 执行：

```powershell
netsh advfirewall firewall add rule name="Nextjs-5000" dir=in action=allow protocol=TCP localport=5000 profile=private
```

同事访问地址：`http://192.168.110.239:5000`

***

## 5. PM2 长期托管（核心）

启动并托管：

```powershell
cd d:\manager_vb\projects
pnpm build
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

> Windows 下不要使用 `pm2 startup`，会报 `Init system not found`，这是正常现象。

查看状态/日志：

```powershell
pm2 status
pm2 logs schedule-web --lines 80
```

重启服务：

```powershell
pm2 restart schedule-web --update-env
```

> `--update-env` 用于加载你最新修改过的环境变量。

***

## 6. 日常更新发布流程

```powershell
cd d:\manager_vb\projects
git pull
pnpm build
pm2 restart schedule-web --update-env
```

发布后检查：

```powershell
pm2 status
pm2 logs schedule-web --lines 100
```

***

## 7. 开机自动恢复（任务计划）

`pm2 save` 后，用 Windows 任务计划在登录时执行 `pm2 resurrect`。

命令行一键创建（管理员 PowerShell）：

```powershell
schtasks /Create /TN "PM2-Resurrect" /SC ONLOGON /RL HIGHEST /TR "cmd /c pm2 resurrect" /F
```

验证任务：

```powershell
schtasks /Query /TN "PM2-Resurrect" /V /FO LIST
schtasks /Run /TN "PM2-Resurrect"
pm2 status
```

***

## 8. 常见故障排查

### 8.1 同事打不开页面

1. 本机先测：`http://localhost:5000`
2. 检查端口监听：

```powershell
netstat -ano | findstr :5000
```

1. 检查防火墙规则是否存在（并匹配专用网络）
2. 同事机器 `ping 192.168.110.239`

### 8.2 报 Supabase 环境变量缺失

现象：`Supabase environment variables are not configured`

处理：

1. 确认环境变量已配置
2. 重新打开终端
3. 执行：

```powershell
pm2 restart schedule-web --update-env
```

### 8.3 进程卡死或异常

```powershell
pm2 restart schedule-web
pm2 logs schedule-web --lines 200
```

### 8.4 日志里出现旧的 3000/Turbopack 记录

这是历史日志残留，不代表当前服务异常。看日志最后几行，确认是否为：

- `http://localhost:5000`
- `http://0.0.0.0:5000`

如需清空旧日志：

```powershell
pm2 flush
pm2 logs schedule-web --lines 80
```

***

## 9. 可选增强（建议）

- 将这台电脑网卡 IP 固定为静态内网 IP（避免地址变化）
- 设置 Windows 自动登录和自动启动 PM2（办公室断电后恢复更快）
- 每天定时备份数据库（Supabase 侧）和项目配置
