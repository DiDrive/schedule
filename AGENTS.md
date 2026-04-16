# 项目排期管理系统

## 项目概览

基于 Next.js 的项目排期管理系统，支持从飞书多维表加载人员、项目、任务数据，并将排期结果同步到飞书排期表。新增 Supabase 数据库支持，实现多端数据同步。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **核心**: React 19
- **语言**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS 4
- **拖拽**: @dnd-kit/core
- **数据库**: Supabase (PostgreSQL)
- **日历**: date-fns

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 管理端首页
│   ├── view/page.tsx      # 展示端页面（只读）
│   └── api/               # API 路由
│       ├── db/            # 数据库 API
│       └── feishu/        # 飞书 API
├── components/
│   ├── views/             # 视图组件
│   │   └── matrix-calendar-view.tsx  # 矩阵日历视图
│   ├── scenarios/         # 场景组件
│   │   └── complex-scenario.tsx      # 复杂场景排期
│   └── ui/               # shadcn/ui 组件
├── lib/                   # 工具库
│   ├── feishu-config.ts  # 飞书配置
│   ├── feishu-client.ts  # 飞书客户端
│   └── feishu-sync-service.ts  # 飞书同步服务
├── storage/
│   └── database/         # 数据库相关
│       ├── db-service.ts      # 客户端数据库服务
│       └── server-client.ts   # 服务端数据库客户端
└── types/
    └── schedule.ts       # 排期类型定义
```

## 关键概念

### 矩阵日历独立数据源
- 矩阵日历使用需求表2筛选视图数据，不依赖排期结果
- 主栏目导航（排期管理 / 矩阵日历），矩阵日历拥有独立筛选器

### 负责人多选与子任务
- 详情页支持多选负责人（显示来源标签）
- 支持本地子任务（仅详情页可见）

### 负责人同步机制
- 子任务负责人自动同步到父任务
- 删除子任务时清理无引用负责人

### 数据库架构
- 使用 Supabase 作为统一数据源
- 管理端（/）和展示端（/view）分离

## 开发命令

```bash
pnpm install          # 安装依赖
pnpm dev             # 开发环境启动（端口 5000）
pnpm build           # 生产构建
pnpm lint            # 代码检查
pnpm ts-check        # TypeScript 类型检查
```

## 数据库表结构

### resources（资源/人员表）
- `id`: 唯一标识
- `name`: 名称
- `type`: 类型（human/material/equipment）
- `work_type`: 工种（脚本/平面/后期/物料/复合）
- `level`: 等级（assistant/junior/senior）
- `capacity`: 容量
- `is_active`: 是否活跃

### tasks（任务表）
- `id`: 唯一标识
- `name`: 名称
- `description`: 描述
- `estimated_hours`: 预估工时
- `assigned_resources`: 负责人ID数组
- `deadline`: 截止日期
- `priority`: 优先级
- `status`: 状态
- `task_type`: 任务类型
- `project_id`: 项目ID
- `project_name`: 项目名称
- `local_sub_tasks`: 本地子任务（JSON）
- `resource_assignments`: 负责人分配（JSON）

### calendar_config（日历配置表）
- `config_key`: 配置键
- `config_value`: 配置值

## API 接口

### 数据库 API
- `GET /api/db` - 获取所有数据（资源、任务、日历配置）
- `POST /api/db` - 同步数据
  - `action: sync_tasks` - 同步任务
  - `action: sync_resources` - 同步资源
  - `action: sync_all` - 同步所有数据
  - `action: sync_calendar` - 同步日历配置

### 飞书 API
- `GET/POST /api/feishu/config` - 配置管理
- `POST /api/feishu/sync` - 数据同步
- `GET /api/feishu/load-data` - 加载数据
- `GET /api/feishu/load-requirements2-view` - 加载需求表2视图数据
- `POST /api/feishu/test-connection` - 测试连接

## 环境变量

Supabase 环境变量由 Coze 平台自动注入：
- `COZE_SUPABASE_URL` - Supabase 项目 URL
- `COZE_SUPABASE_ANON_KEY` - Supabase 匿名密钥
- `COZE_SUPABASE_SERVICE_ROLE_KEY` - 服务端专用密钥（可选）

## 常见问题

### 服务端模块错误
- `server-client.ts` 使用 `child_process` 模块，仅限服务端使用
- 客户端通过 `/api/db` 路由间接访问数据库

### 环境变量未配置
- 确保 Supabase 服务已开通
- 环境变量由 Coze 平台自动注入
