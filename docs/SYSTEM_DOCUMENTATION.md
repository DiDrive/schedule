# 唯变项目排期系统 - 详细文档

## 目录

1. [系统概述](#1-系统概述)
2. [核心功能](#2-核心功能)
3. [系统架构](#3-系统架构)
4. [数据结构](#4-数据结构)
5. [业务流程](#5-业务流程)
6. [飞书集成](#6-飞书集成)
7. [排期算法](#7-排期算法)
8. [项目模板](#8-项目模板)
9. [API接口](#9-api接口)
10. [使用指南](#10-使用指南)

---

## 1. 系统概述

### 1.1 简介

唯变项目排期系统是一个基于 Next.js 的智能项目排期管理系统，支持：
- 从飞书多维表加载人员、项目、任务数据
- 自动资源分配和智能排期
- 排期结果同步到飞书排期表
- 项目模板管理和快速创建项目

### 1.2 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | 全栈框架 (App Router) |
| React | 19 | 前端UI |
| TypeScript | 5 | 类型安全 |
| Tailwind CSS | 4 | 样式系统 |
| shadcn/ui | - | UI组件库 |
| XLSX | - | Excel导出 |

### 1.3 核心特性

- **多数据源支持**：支持需求表模式（新）和传统模式两种数据源
- **智能排期**：自动计算任务开始/结束时间，支持依赖关系
- **资源优化**：自动分配资源，实现负载均衡
- **分页读取**：突破飞书API 500条限制，支持大数据量
- **实时同步**：排期结果一键同步到飞书多维表
- **复合任务**：支持同时包含平面和后期工时的任务拆分

---

## 2. 核心功能

### 2.1 功能模块总览

```
┌─────────────────────────────────────────────────────────────┐
│                      唯变项目排期系统                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  飞书集成   │  │  排期管理   │  │  模板管理   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │ 数据加载    │  │ 任务管理    │  │ 模板编辑    │          │
│  │ 数据同步    │  │ 资源管理    │  │ 快速创建    │          │
│  │ 配置管理    │  │ 排期生成    │  │ 依赖设置    │          │
│  └─────────────┘  │ 甘特图展示  │  └─────────────┘          │
│                   │ 冲突检测    │                           │
│                   └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 飞书集成功能

#### 数据加载
- 从飞书多维表加载人员、项目、任务数据
- 支持分页读取，突破500条限制
- 支持两种数据源模式：
  - **需求表模式**：从需求表1、需求表2加载任务
  - **传统模式**：从项目表、任务表加载

#### 数据同步
- 排期结果同步到飞书排期表
- 全量覆盖模式：先删除所有记录，再重新创建
- 支持进度显示和错误反馈

### 2.3 排期管理功能

#### 任务管理
- 创建、编辑、删除任务
- 设置任务依赖关系
- 指定负责人或自动分配
- 支持复合任务（平面+后期）

#### 资源管理
- 添加、编辑人员资源
- 设置工作类型（平面/后期/物料）
- 设置效率系数和技能

#### 排期生成
- 自动计算任务时间
- 资源冲突检测
- 关键路径分析
- 工时统计

### 2.4 模板管理功能

- 预置项目模板（买量片、宣传片等）
- 自定义模板创建和编辑
- 支持复合任务模板
- 依赖关系可视化

---

## 3. 系统架构

### 3.1 目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 主页面
│   ├── layout.tsx                # 布局组件
│   └── api/                      # API路由
│       ├── feishu/               # 飞书相关API
│       │   ├── load-data/        # 数据加载
│       │   ├── sync-schedule/    # 排期同步
│       │   └── config/           # 配置管理
│       └── schedule-ai/          # AI排期优化
│
├── components/                   # React组件
│   ├── scenarios/                # 场景组件
│   │   └── complex-scenario.tsx  # 复杂场景主组件
│   ├── gantt-chart.tsx           # 甘特图
│   ├── task-row.tsx              # 任务行组件
│   ├── template-editor.tsx       # 模板编辑器
│   └── feishu-*.tsx              # 飞书相关组件
│
├── lib/                          # 核心库
│   ├── schedule-algorithms.ts    # 排期算法
│   ├── feishu-api.ts             # 飞书API封装
│   ├── feishu-config.ts          # 飞书配置
│   ├── feishu-data-mapper.ts     # 数据映射
│   ├── project-templates.ts      # 项目模板
│   └── template-generator.ts     # 模板生成器
│
└── types/                        # TypeScript类型
    ├── schedule.ts               # 排期相关类型
    └── feishu-extended.ts        # 飞书扩展类型
```

### 3.2 数据流架构

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   飞书多维表   │────▶│   数据加载    │────▶│  localStorage │
└──────────────┘     └──────────────┘     └───────┬───────┘
                                                   │
                     ┌─────────────────────────────┘
                     │
                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   前端组件    │◀───▶│   排期算法    │────▶│   排期结果    │
└──────────────┘     └──────────────┘     └───────┬───────┘
                                                   │
                     ┌─────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐     ┌──────────────┐
              │   数据同步    │────▶│   飞书多维表   │
              └──────────────┘     └──────────────┘
```

---

## 4. 数据结构

### 4.1 核心类型定义

#### Resource（资源）

```typescript
interface Resource {
  id: string;                    // 资源ID
  name: string;                  // 姓名
  type: 'human' | 'material' | 'equipment';  // 资源类型
  workType?: ResourceWorkType;   // 工作类型：平面/后期/物料/复合
  level?: ResourceLevel;         // 资源等级：assistant/junior/senior
  efficiency?: number;           // 效率系数，0.5-2.0
  skills?: string[];             // 技能列表
  availability: number;          // 可用性系数，0-1
  color?: string;                // 甘特图显示颜色
}

type ResourceWorkType = '平面' | '后期' | '物料' | '复合';
type ResourceLevel = 'assistant' | 'junior' | 'senior';
```

#### Task（任务）

```typescript
interface Task {
  id: string;                    // 任务ID
  name: string;                  // 任务名称
  description?: string;          // 任务描述
  estimatedHours: number;        // 预估工时
  assignedResources: string[];   // 分配的资源ID
  deadline?: Date;               // 截止日期
  priority: 'urgent' | 'high' | 'normal' | 'low';  // 优先级
  status: 'pending' | 'in-progress' | 'to-confirm' | 'completed' | 'overdue' | 'blocked';
  taskType?: ResourceWorkType;   // 任务类型
  fixedResourceId?: string;      // 指定的资源ID
  
  // 项目关联
  projectId?: string;            // 所属项目ID
  projectName?: string;          // 项目名称
  dependencies?: string[];       // 前置任务ID列表
  
  // 复合任务字段
  parentTaskId?: string;         // 父任务ID
  isSubTask?: boolean;           // 是否为子任务
  subTaskType?: '平面' | '后期'; // 子任务类型
  estimatedHoursGraphic?: number; // 平面工时
  estimatedHoursPost?: number;   // 后期工时
  subTaskDependencyMode?: 'parallel' | 'serial';  // 子任务依赖模式
  fixedResourceIdGraphic?: string; // 指定的平面负责人ID
  fixedResourceIdPost?: string;  // 指定的后期负责人ID
  
  // 排期结果
  startDate?: Date;              // 开始时间
  endDate?: Date;                // 结束时间
  startHour?: number;            // 开始小时
  endHour?: number;              // 结束小时
  isCritical?: boolean;          // 是否在关键路径上
  
  // 飞书同步
  feishuRecordId?: string;       // 飞书记录ID
  
  // 扩展字段
  subType?: string;              // 细分类
  language?: string;             // 语言
  dubbing?: string;              // 配音要求
  businessMonth?: string;        // 商务月份
  size?: string;                 // 尺寸规格
}
```

#### Project（项目）

```typescript
interface Project {
  id: string;                    // 项目ID
  name: string;                  // 项目名称
  description?: string;          // 项目描述
  priority: 'urgent' | 'normal'; // 项目优先级
  tasks: Task[];                 // 任务列表
  resourcePool: string[];        // 资源池ID列表
  color?: string;                // 甘特图显示颜色
}
```

#### ScheduleResult（排期结果）

```typescript
interface ScheduleResult {
  tasks: Task[];                 // 排期后的任务列表
  projects: Project[];           // 项目列表
  criticalPath: string[];        // 关键路径任务ID
  criticalChain: string[];       // 关键链任务ID
  resourceConflicts: ResourceConflict[];  // 资源冲突列表
  resourceUtilization: Record<string, number>;  // 资源利用率
  totalDuration: number;         // 总工期（天）
  totalHours: number;            // 总工时
  workingHoursConfig?: WorkingHoursConfig;  // 工作时间配置
  warnings: string[];            // 警告信息
  recommendations: string[];     // 优化建议
}
```

### 4.2 项目模板类型

```typescript
interface TemplateTask {
  id: string;                    // 模板任务ID
  sequence: number;              // 任务序号
  name: string;                  // 任务名称
  description?: string;          // 任务描述
  estimatedHours: number;        // 预估工时
  estimatedHoursGraphic?: number; // 平面工时（复合任务）
  estimatedHoursPost?: number;   // 后期工时（复合任务）
  subTaskDependencyMode?: 'parallel' | 'serial';  // 子任务依赖模式
  priority: 'urgent' | 'high' | 'normal' | 'low';
  taskType: ResourceWorkType | '复合';  // 任务类型
  dependencies: number[];        // 依赖的任务序号数组
  tags?: string[];               // 标签
  notes?: string;                // 任务说明
}

interface ProjectTemplate {
  id: string;                    // 模板ID
  name: string;                  // 模板名称
  description: string;           // 模板描述
  category: string;              // 模板分类
  tasks: TemplateTask[];         // 任务模板列表
  defaultWorkingHours?: number;  // 默认每天工作小时数
  defaultPriority?: 'urgent' | 'normal';
  color?: string;                // 显示颜色
  isDefault?: boolean;           // 是否为默认模板
}
```

### 4.3 飞书配置类型

```typescript
interface FeishuConfig {
  appId: string;                 // 飞书应用ID
  appSecret: string;             // 飞书应用密钥
  dataSourceMode: 'legacy' | 'new';  // 数据源模式
  requirementsLoadMode?: 'all' | 'requirements1' | 'requirements2';
  
  // 需求表模式配置
  newMode: {
    appToken: string;            // 多维表App Token
    tableIds: {
      resources: string;         // 人员表ID
      requirements1: string;     // 需求表1 ID
      requirements2: string;     // 需求表2 ID
      schedules: string;         // 排期表ID
    };
  };
  
  // 传统模式配置
  legacyMode: {
    appToken: string;
    tableIds: {
      resources: string;         // 人员表ID
      projects: string;          // 项目表ID
      tasks: string;             // 任务表ID
      schedules: string;         // 排期表ID
    };
  };
  
  enableAutoSync?: boolean;      // 启用自动同步
  autoSyncInterval?: number;     // 自动同步间隔（分钟）
}
```

---

## 5. 业务流程

### 5.1 整体业务流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        项目排期工作流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 飞书配置                                                     │
│     ┌──────────┐                                                │
│     │ 配置飞书  │──▶ 设置App ID、App Secret、多维表Token         │
│     │ 集成信息  │──▶ 选择数据源模式（需求表/传统）                 │
│     └──────────┘                                                │
│          │                                                       │
│          ▼                                                       │
│  2. 数据加载                                                     │
│     ┌──────────┐                                                │
│     │ 从飞书   │──▶ 分页读取人员数据                             │
│     │ 加载数据  │──▶ 分页读取项目/需求数据                       │
│     └──────────┘──▶ 数据转换映射到本地格式                       │
│          │                                                       │
│          ▼                                                       │
│  3. 任务管理                                                     │
│     ┌──────────┐                                                │
│     │ 编辑任务  │──▶ 设置任务属性（类型、工时、优先级）           │
│     │ 设置依赖  │──▶ 设置任务依赖关系                            │
│     └──────────┘──▶ 指定负责人或保持自动分配                     │
│          │                                                       │
│          ▼                                                       │
│  4. 排期生成                                                     │
│     ┌──────────┐                                                │
│     │ 生成排期  │──▶ 自动分配资源                                │
│     │          │──▶ 计算任务时间                                │
│     └──────────┘──▶ 检测资源冲突                                │
│          │                                                       │
│          ▼                                                       │
│  5. 结果查看                                                     │
│     ┌──────────┐                                                │
│     │ 甘特图   │──▶ 可视化查看排期结果                           │
│     │ 冲突列表  │──▶ 处理资源冲突                                │
│     └──────────┘                                                │
│          │                                                       │
│          ▼                                                       │
│  6. 数据同步                                                     │
│     ┌──────────┐                                                │
│     │ 同步到   │──▶ 清空排期表旧数据                             │
│     │ 飞书     │──▶ 创建新排期记录                               │
│     └──────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 排期生成流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        排期生成算法流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  输入: 任务列表、资源列表、工作时间配置                           │
│                                                                  │
│  Step 1: 构建依赖图                                              │
│     └──▶ 分析任务依赖关系，构建有向无环图                        │
│                                                                  │
│  Step 2: 拓扑排序                                                │
│     └──▶ 按依赖关系对任务排序，确定执行顺序                      │
│                                                                  │
│  Step 3: 资源预分配                                              │
│     ├──▶ 按被依赖数、优先级、工时排序任务                        │
│     ├──▶ 匹配任务类型与资源工作类型                              │
│     └──▶ 选择负载最低的合适资源                                  │
│                                                                  │
│  Step 4: 时间计算                                                │
│     ├──▶ 根据依赖关系确定任务开始时间                            │
│     ├──▶ 考虑工作时间（9:30-12:00, 13:30-18:30）                │
│     ├──▶ 跳过非工作日（周末）                                    │
│     └──▶ 计算任务结束时间                                        │
│                                                                  │
│  Step 5: 冲突检测                                                │
│     ├──▶ 检查同一资源的重叠任务                                  │
│     └──▶ 生成冲突报告                                            │
│                                                                  │
│  Step 6: 关键路径分析                                            │
│     ├──▶ 计算项目最短工期                                        │
│     └──▶ 标识关键路径任务                                        │
│                                                                  │
│  输出: ScheduleResult（排期结果）                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 复合任务处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      复合任务处理流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  复合任务定义: 同时包含平面和后期工时的任务                       │
│                                                                  │
│  输入: Task { taskType: '复合', estimatedHoursGraphic: 4,        │
│               estimatedHoursPost: 8, subTaskDependencyMode }    │
│                                                                  │
│  Step 1: 任务拆分                                                │
│     ├──▶ 创建父任务（原任务）                                    │
│     ├──▶ 创建子任务1：平面任务                                   │
│     │      └── 工时 = estimatedHoursGraphic                     │
│     └──▶ 创建子任务2：后期任务                                   │
│            └── 工时 = estimatedHoursPost                        │
│                                                                  │
│  Step 2: 设置依赖关系                                            │
│     ├──▶ 并行模式 (parallel):                                    │
│     │      └── 两个子任务可同时进行                              │
│     └──▶ 串行模式 (serial):                                      │
│            └── 后期任务依赖平面任务完成                          │
│                                                                  │
│  Step 3: 资源分配                                                │
│     ├──▶ 平面子任务分配给平面资源                                │
│     └──▶ 后期子任务分配给后期资源                                │
│                                                                  │
│  Step 4: 时间计算                                                │
│     └──▶ 按依赖关系计算各子任务时间                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 飞书集成

### 6.1 飞书多维表结构

#### 人员表 (resources)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 人员ID | 文本 | 系统生成的唯一ID |
| 姓名 | 文本 | 人员姓名 |
| 工作类型 | 单选 | 平面设计/后期制作/物料 |
| 飞书用户ID | 文本 | 飞书用户ID（可选） |

#### 需求表1/需求表2 (requirements)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 任务ID | 文本 | 系统生成的唯一ID |
| 脚本名称 | 文本 | 任务名称 |
| 需求类目 | 文本 | 项目/需求分类 |
| 细分类 | 文本 | 任务细分类型 |
| 语言 | 文本 | 语言要求 |
| 配音 | 文本 | 配音要求 |
| 需求日期 | 日期 | 截止日期 |
| 商务月份 | 文本 | 商务月份 |
| 尺寸 | 文本 | 尺寸规格 |
| 项目进展 | 单选 | 任务状态 |
| 平面预估工时 | 数字 | 平面工时 |
| 后期预估工时 | 数字 | 后期工时 |
| 对接人 | 文本 | 负责人 |

#### 排期表 (schedules)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 任务ID | 文本 | 系统任务ID |
| 所属项目 | 文本 | 项目名称 |
| 任务类型 | 单选 | 平面/后期/物料 |
| 负责人 | 文本 | 分配的资源名称 |
| 开始时间 | 日期 | 排期开始时间 |
| 结束时间 | 日期 | 排期结束时间 |
| 截止日期 | 日期 | 任务截止日期 |
| 工时 | 数字 | 预估工时 |
| 状态 | 单选 | 任务状态 |

### 6.2 数据加载流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      飞书数据加载流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 获取 App Access Token                                       │
│     POST /auth/v3/app_access_token/internal                     │
│     └──▶ 使用 App ID 和 App Secret 获取访问令牌                 │
│                                                                  │
│  2. 分页读取数据（fetchAllRecordsByListApi）                     │
│     ├──▶ 使用 GET /bitable/v1/apps/{app_token}/tables/{table_id}/records
│     ├──▶ 设置 page_size=500                                     │
│     ├──▶ 使用 page_token 分页                                   │
│     └──▶ 循环直到无更多数据                                      │
│                                                                  │
│  3. 数据映射转换                                                 │
│     ├──▶ 飞书字段 → 系统字段                                    │
│     ├──▶ 单选值转换（平面设计→平面）                            │
│     └──▶ 日期格式转换                                           │
│                                                                  │
│  4. 存储到本地                                                   │
│     ├──▶ localStorage.setItem('complex-scenario-resources')     │
│     ├──▶ localStorage.setItem('complex-scenario-projects')      │
│     └──▶ localStorage.setItem('complex-scenario-tasks')         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 数据同步流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      飞书数据同步流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 准备同步数据                                                 │
│     ├──▶ 读取 localStorage 中的排期结果                         │
│     └──▶ 构建同步数据结构                                        │
│                                                                  │
│  2. 清空旧数据                                                   │
│     ├──▶ 循环获取所有记录ID                                     │
│     │      GET /bitable/v1/apps/{app_token}/tables/{table_id}/records
│     └──▶ 批量删除所有记录                                        │
│            POST /bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_delete
│                                                                  │
│  3. 批量创建新记录                                               │
│     POST /bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_create
│     ├──▶ 每批最多500条                                          │
│     └──▶ 返回成功/失败统计                                       │
│                                                                  │
│  4. 返回结果                                                     │
│     └──▶ { success: true, stats: { success: N, error: M } }     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 排期算法

### 7.1 核心算法说明

#### 工作时间计算

```typescript
// 默认工作时间配置
const DEFAULT_WORKING_HOURS = {
  startHour: 9.5,        // 上午 9:30
  endHour: 18.5,         // 下午 18:30
  workDays: [1,2,3,4,5], // 周一到周五
  lunchBreakStart: 12,   // 午休开始 12:00
  lunchBreakEnd: 13.5    // 午休结束 13:30
};

// 每天有效工作时间 = 4.5小时(上午) + 5小时(下午) = 9.5小时
```

#### 资源分配策略

```
资源分配优先级：
1. 被依赖数（越多越优先，避免阻塞后续任务）
2. 优先级（urgent > high > normal > low）
3. 工时（高工时优先）

分配规则：
1. 物料任务不分配资源
2. 任务类型匹配资源工作类型
3. 有指定资源(fixedResourceId)的任务优先使用指定资源
4. 负载均衡：优先选择当前负载最低的资源
```

#### 时间计算逻辑

```
1. 根据依赖关系确定最早开始时间
   - 无依赖：从项目开始时间计算
   - 有依赖：从所有前置任务的最晚结束时间开始

2. 跳过非工作时间
   - 跳过周末
   - 跳过午休时间（12:00-13:30）
   - 跨天时从下一个工作日 9:30 开始

3. 根据工时计算结束时间
   - 考虑每天有效工作时间
   - 精确到小时级别
```

### 7.2 关键函数

#### generateSchedule

```typescript
/**
 * 生成排期结果
 * @param tasks 任务列表
 * @param resources 资源列表
 * @param workingHoursConfig 工作时间配置
 * @returns ScheduleResult 排期结果
 */
function generateSchedule(
  tasks: Task[],
  resources: Resource[],
  workingHoursConfig?: WorkingHoursConfig
): ScheduleResult;
```

#### autoAssignResources

```typescript
/**
 * 自动分配资源
 * @param tasks 任务列表
 * @param resources 资源列表
 * @returns 分配后的任务列表
 */
function autoAssignResources(
  tasks: Task[],
  resources: Resource[]
): Task[];
```

#### adjustToWorkingTime

```typescript
/**
 * 将时间调整到下一个工作时间
 * @param date 输入时间
 * @param config 工作时间配置
 * @returns 调整后的工作时间
 */
function adjustToWorkingTime(
  date: Date,
  config?: WorkingHoursConfig
): Date;
```

---

## 8. 项目模板

### 8.1 预置模板

系统预置了以下项目模板：

#### 买量片项目模板

| 序号 | 任务名称 | 工时 | 类型 | 依赖 |
|------|---------|------|------|------|
| 1 | 创意策划 | 8h | 平面 | - |
| 2 | 分镜设计 | 16h | 平面 | 1 |
| 3 | 道具准备 | 4h | 物料 | 2 |
| 4 | 拍摄制作 | 24h | 后期 | 2,3 |
| 5 | 粗剪 | 16h | 后期 | 4 |
| 6 | 精剪 | 12h | 后期 | 5 |
| 7 | 特效制作 | 8h | 后期 | 6 |
| 8 | 配音配乐 | 4h | 后期 | 6 |
| 9 | 调色 | 4h | 后期 | 6 |
| 10 | 最终合成 | 4h | 后期 | 7,8,9 |
| 11 | 审片修改 | 8h | 后期 | 10 |

### 8.2 模板使用流程

```
1. 选择模板
   └──▶ 从模板列表选择合适的模板

2. 配置项目
   ├──▶ 输入项目名称
   ├──▶ 选择优先级
   └──▶ 选择资源池

3. 生成任务
   └──▶ 根据模板创建任务列表

4. 调整任务
   ├──▶ 修改任务属性
   ├──▶ 调整依赖关系
   └──▶ 设置负责人
```

### 8.3 复合任务模板

复合任务模板支持同时设置平面和后期工时：

```typescript
// 复合任务示例
{
  sequence: 3,
  name: '视频制作',
  taskType: '复合',
  estimatedHours: 12,           // 总工时
  estimatedHoursGraphic: 4,     // 平面工时
  estimatedHoursPost: 8,        // 后期工时
  subTaskDependencyMode: 'parallel'  // 并行或串行
}
```

---

## 9. API接口

### 9.1 飞书相关API

#### 加载数据

```
GET /api/feishu/load-data

参数:
- app_id: 飞书应用ID
- app_secret: 飞书应用密钥
- app_token: 多维表Token
- data_source_mode: 数据源模式 (new/legacy)
- resources_table_id: 人员表ID
- requirements1_table_id: 需求表1 ID（需求表模式）
- requirements2_table_id: 需求表2 ID（需求表模式）
- projects_table_id: 项目表ID（传统模式）
- tasks_table_id: 任务表ID（传统模式）

响应:
{
  "success": true,
  "data": {
    "resources": [...],
    "projects": [...],
    "tasks": [...]
  }
}
```

#### 同步排期

```
POST /api/feishu/sync-schedule

参数:
- app_id: 飞书应用ID
- app_secret: 飞书应用密钥
- app_token: 多维表Token
- schedules_table_id: 排期表ID
- resources_table_id: 人员表ID

请求体:
{
  "tasks": [
    {
      "id": "task-xxx",
      "name": "任务名称",
      "projectName": "项目名称",
      "assignedResourceId": "res-xxx",
      "assignedResourceName": "负责人",
      "startDate": "2024-01-01",
      "endDate": "2024-01-03",
      "estimatedHours": 16,
      ...
    }
  ]
}

响应:
{
  "success": true,
  "stats": {
    "success": 100,
    "error": 0
  }
}
```

#### 测试连接

```
GET /api/feishu/test-connection

参数:
- app_id: 飞书应用ID
- app_secret: 飞书应用密钥

响应:
{
  "success": true,
  "message": "连接成功"
}
```

### 9.2 配置管理API

#### 保存配置

```
POST /api/feishu/config

请求体:
{
  "appId": "xxx",
  "appSecret": "xxx",
  "dataSourceMode": "new",
  "newMode": {
    "appToken": "xxx",
    "tableIds": { ... }
  },
  ...
}
```

#### 读取配置

```
GET /api/feishu/config

响应:
{
  "success": true,
  "config": { ... }
}
```

---

## 10. 使用指南

### 10.1 快速开始

#### 1. 配置飞书集成

1. 点击右上角「飞书配置」按钮
2. 输入飞书应用信息：
   - App ID
   - App Secret
3. 选择数据源模式：
   - **需求表模式**：适用于从需求表加载任务
   - **传统模式**：适用于从项目表、任务表加载
4. 填写多维表和各表的ID
5. 点击「测试连接」验证配置

#### 2. 加载数据

1. 点击「从飞书加载」按钮
2. 系统自动分页读取所有数据
3. 数据加载完成后自动刷新页面

#### 3. 管理任务

1. 在任务列表中查看/编辑任务
2. 设置任务属性：
   - 任务类型（平面/后期/物料/复合）
   - 预估工时
   - 优先级
   - 截止日期
3. 设置任务依赖关系
4. 指定负责人（可选）

#### 4. 生成排期

1. 点击「生成排期」按钮
2. 系统自动：
   - 分配资源
   - 计算任务时间
   - 检测资源冲突
3. 查看排期结果：
   - 甘特图视图
   - 日历视图
   - 冲突列表

#### 5. 同步到飞书

1. 确认排期结果无误
2. 点击「同步到飞书」按钮
3. 等待同步完成
4. 查看同步结果统计

### 10.2 使用模板创建项目

1. 点击「从模板创建」按钮
2. 选择合适的模板
3. 填写项目信息：
   - 项目名称
   - 项目优先级
   - 开始日期
   - 资源池
4. 系统自动创建任务列表
5. 根据需要调整任务

### 10.3 处理复合任务

1. 创建任务时选择「复合」类型
2. 分别设置平面工时和后期工时
3. 选择子任务依赖模式：
   - **并行**：平面和后期同时进行
   - **串行**：平面完成后开始后期
4. 排期时系统自动拆分为子任务

### 10.4 常见问题

#### Q: 数据加载失败怎么办？
A: 
1. 检查飞书配置是否正确
2. 确认应用有多维表访问权限
3. 检查表ID是否正确
4. 查看控制台错误日志

#### Q: 排期结果不符合预期怎么办？
A:
1. 检查任务依赖关系是否正确
2. 确认资源工作类型匹配
3. 检查截止日期设置
4. 手动调整任务分配

#### Q: 同步到飞书失败怎么办？
A:
1. 确认排期表ID配置正确
2. 检查应用有创建记录权限
3. 查看同步错误详情
4. 检查数据格式是否符合要求

---

## 附录

### A. 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| COZE_WORKSPACE_PATH | 项目工作目录 | /workspace/projects/ |
| COZE_PROJECT_DOMAIN_DEFAULT | 对外访问域名 | https://xxx.dev.coze.site |
| DEPLOY_RUN_PORT | 服务监听端口 | 5000 |

### B. localStorage 键值

| 键名 | 说明 |
|------|------|
| feishu-config | 飞书配置信息 |
| complex-scenario-resources | 资源列表 |
| complex-scenario-projects | 项目列表 |
| complex-scenario-tasks | 任务列表 |
| complex-scenario-schedule-result | 排期结果 |

### C. 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 10001 | 参数错误 |
| 10002 | 认证失败 |
| 10003 | 权限不足 |
| 10004 | 资源不存在 |
| 10005 | 请求频率超限 |

---

*文档版本: 1.0*
*最后更新: 2024年*
