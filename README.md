# 唯变项目排期系统

这是一个基于 [Next.js 16](https://nextjs.org) + [shadcn/ui](https://ui.shadcn.com) 的项目排期优化系统，提供智能排期、资源优化、风险管控等功能。

## 项目概述

唯变项目排期系统是一个功能强大的项目管理工具，支持：

- **智能排期算法**：基于依赖关系、资源可用性和任务优先级自动生成最优排期
- **甘特图可视化**：直观展示任务时间轴、关键路径和资源分配
- **资源冲突检测**：自动识别资源时间冲突并提供解决方案
- **智能资源分配**：根据任务被依赖数、优先级和工时自动分配最优资源
- **AI 辅助优化**：集成大语言模型提供智能排期建议
- **Excel 导出**：支持将排期结果导出为 Excel 文件
- **双场景支持**：提供基础场景和复杂场景两种模式，满足不同需求

## 技术栈

- **框架**：Next.js 16 (App Router)
- **UI 组件**：shadcn/ui (基于 Radix UI)
- **样式**：Tailwind CSS 4
- **语言**：TypeScript 5
- **核心库**：xlsx, lucide-react
- **AI 集成**：大语言模型集成（支持流式输出）

## 快速开始

### 启动开发服务器

```bash
coze dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新，修改代码后页面会自动刷新。

### 构建生产版本

```bash
coze build
```

### 启动生产服务器

```bash
coze start
```

## 功能特性

### 1. 基础场景

基础场景提供简洁的任务管理和排期功能：

- **任务管理**：添加、编辑、删除任务，设置工时、优先级、截止日期
- **资源管理**：管理团队成员和设备资源，设置技能、效率系数
- **依赖关系**：设置任务间的依赖关系，确保任务按正确顺序执行
- **自动排期**：一键生成排期，自动分配资源和计算时间
- **甘特图视图**：直观展示任务时间线和资源分配情况
- **表格视图**：详细查看任务信息和资源分配

### 2. 复杂场景

复杂场景提供更高级的项目管理功能：

- **多项目管理**：支持多个项目同时管理和排期
- **共享资源池**：跨项目共享资源，提高资源利用率
- **资源分组**：资源分为平面和后期两类，任务对应分类
- **物料任务**：支持物料任务（里程碑），精确到分钟级别
- **多依赖支持**：任务可以依赖多个前置任务
- **智能资源分配**：被依赖的任务优先获得资源，避免阻塞
- **负载均衡**：避免所有任务集中于高效率人员

### 3. 核心算法

#### 资源分配策略

系统采用以下优先级进行资源分配：

1. **被依赖数**：被依赖任务数越多，优先级越高
2. **任务优先级**：critical > high > normal > low
3. **预估工时**：工时越长，优先级越高

#### 排期计算规则

- **工作时间**：9:30-19:00
- **午休时间**：12:00-13:30（排除）
- **精确度**：普通任务精确到小时，物料任务精确到分钟
- **资源冲突**：同一资源同一时间只能负责一个任务
- **实际工作时间**：任务实际完成时间 = 预估工时 / 资源效率系数

### 4. 数据持久化

系统使用 localStorage 实现数据持久化，确保：

- 任务数据在页面刷新后保留
- 切换场景后数据不会丢失
- 支持空数组保存，即使删除所有任务也不会丢失状态

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── layout.tsx           # 根布局组件
│   ├── page.tsx             # 首页
│   ├── globals.css          # 全局样式（包含 shadcn 主题变量）
│   └── [route]/             # 其他路由页面
├── components/              # React 组件目录
│   └── ui/                  # shadcn/ui 基础组件（优先使用）
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── lib/                     # 工具函数库
│   └── utils.ts            # cn() 等工具函数
└── hooks/                   # 自定义 React Hooks（可选）
```

## 核心开发规范

### 1. 组件开发

**优先使用 shadcn/ui 基础组件**

本项目已预装完整的 shadcn/ui 组件库，位于 `src/components/ui/` 目录。开发时应优先使用这些组件作为基础：

```tsx
// ✅ 推荐：使用 shadcn 基础组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>标题</CardHeader>
      <CardContent>
        <Input placeholder="输入内容" />
        <Button>提交</Button>
      </CardContent>
    </Card>
  );
}
```

**可用的 shadcn 组件清单**

- 表单：`button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- 布局：`card`, `separator`, `tabs`, `accordion`, `collapsible`, `scroll-area`
- 反馈：`alert`, `alert-dialog`, `dialog`, `toast`, `sonner`, `progress`
- 导航：`dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`
- 数据展示：`table`, `avatar`, `badge`, `hover-card`, `tooltip`, `popover`
- 其他：`calendar`, `command`, `carousel`, `resizable`, `sidebar`

详见 `src/components/ui/` 目录下的具体组件实现。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4 进行样式开发，并已配置 shadcn 主题变量。

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">
    主要按钮
  </Button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form>
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **字体**: Geist Sans & Geist Mono
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）

## 修复记录

### 2025-01-XX：修复资源分配和数据持久化问题

**问题描述**：
1. 资源分配未考虑被依赖关系，导致被依赖任务获得低优先级资源，阻塞后续任务
2. 物料任务强制使用 9:30 作为提供时间，导致用户设置的精确时间无效
3. 物料任务参与评分竞争，影响资源分配公平性
4. 复杂场景切换后任务数据丢失

**解决方案**：

#### 1. 修复资源分配逻辑
- 修改 `autoAssignResources` 排序逻辑，优先级调整为：被依赖数 > 优先级 > 工时
- 确保被依赖的任务优先获得资源，避免阻塞后续任务
- 实现负载均衡，避免所有任务集中于高效率人员

#### 2. 修复物料任务处理
- 物料任务使用用户选择的精确时间，不再强制修改为 9:30
- 物料任务作为里程碑，开始和结束时间均设为用户选择的提供时间点
- 物料任务评分函数直接返回 0，不参与资源分配竞争

#### 3. 修复资源冲突检测
- 在资源分配循环中，使用实际工作时间计算结束时间
- 确保冲突检测考虑资源效率系数

#### 4. 修复数据持久化问题
- 添加 `useRef` 跟踪数据加载状态，避免重复加载导致数据丢失
- 修复基础场景保存逻辑，移除 `if (length > 0)` 判断，确保空数组也会保存
- 修复复杂场景保存逻辑，确保数据在切换场景后不会丢失
- 两个场景均采用相同的数据持久化策略

**修改文件**：
- `src/lib/schedule-algorithms.ts`：修复资源分配和冲突检测逻辑
- `src/components/scenarios/basic-scenario.tsx`：修复数据保存和加载逻辑
- `src/components/scenarios/complex-scenario.tsx`：修复数据保存和加载逻辑
- `src/app/api/ai-optimize/route.ts`：修复 API Runtime 配置

**验收结果**：
- ✅ 被依赖任务优先获得资源
- ✅ 物料任务使用用户设置的精确时间
- ✅ 物料任务不参与资源分配竞争
- ✅ 复杂场景数据在切换后不会丢失
- ✅ 基础场景数据在切换后不会丢失
- ✅ 所有场景支持空数组保存

### 2025-01-XX：修复甘特图中物料任务绘制位置错误

**问题描述**：
- 复杂场景下物料任务（里程碑）在甘特图中的绘制位置不正确
- 物料任务使用了错误的日期属性（`estimatedMaterialDate`），导致位置计算错误
- 物料任务使用了普通任务的位置计算逻辑，导致作为时间点显示为时间段

**解决方案**：

#### 1. 修复物料任务时间属性
- 物料任务使用排期算法计算后的 `startDate` 和 `endDate`，而不是 `estimatedMaterialDate`
- 确保物料任务显示的时间与排期结果一致

#### 2. 添加专用里程碑位置计算函数
- 创建 `getMilestonePosition` 函数，专门计算物料任务（里程碑）的位置
- 物料任务作为一个时间点来计算位置，只计算 `left` 位置，不计算 `width`
- 考虑工作日、工作时间和午休时间，确保位置准确

#### 3. 修复物料任务渲染逻辑
- 使用 `getMilestonePosition` 函数替代 `getTaskPosition` 函数
- 简化物料任务的时间显示，直接使用 `task.startDate || task.endDate`
- 保持里程碑的菱形图标样式和交互效果

**修改文件**：
- `src/components/gantt-chart.tsx`：修复物料任务的位置计算和渲染逻辑

**验收结果**：
- ✅ 物料任务在甘特图中的位置准确显示在用户设置的时间点
- ✅ 物料任务使用排期算法计算后的时间，确保与排期结果一致
- ✅ 里程碑作为时间点显示，而不是时间段
- ✅ 构建检查通过，无类型错误
