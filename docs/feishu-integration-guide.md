# 飞书多维表集成使用指南

## 概述

本系统已完全重构，**不再需要飞书扫码登录**，直接使用应用身份（app_access_token）访问飞书多维表。系统可以从飞书多维表读取项目数据，并将排期结果同步回飞书。

## 主要变化

### ✅ 已移除
- 飞书扫码登录功能
- 用户身份认证（user_access_token）
- 个人多维表访问

### ✅ 新增
- 应用身份认证（app_access_token）
- 直接从多维表加载数据
- 排期结果同步到多维表

---

## 配置步骤

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用
3. 记录 **App ID** 和 **App Secret**

### 2. 创建多维表格

创建一个多维表格，包含以下数据表：

#### 人员表
用于存储人员信息和技能。

**字段配置**：
- `name` (文本)：姓名
- `skills` (多选)：技能
- `availability` (数字)：可用性（0-100%）
- `hourlyRate` (数字)：时薪
- `email` (文本)：邮箱

#### 项目表
用于存储项目信息。

**字段配置**：
- `name` (文本)：项目名称
- `description` (多行文本)：项目描述
- `priority` (单选)：优先级（high/medium/low）
- `startDate` (日期)：开始日期
- `endDate` (日期)：结束日期
- `status` (单选)：状态（pending/in_progress/completed）

#### 任务表
用于存储任务信息。

**字段配置**：
- `name` (文本)：任务名称
- `projectId` (文本)：项目ID
- `assignedResourceId` (文本)：负责人ID
- `estimatedHours` (数字)：预估工时
- `priority` (单选)：优先级（high/medium/low）
- `dependencies` (多选)：依赖项
- `status` (单选)：状态（pending/in_progress/completed）
- `deadline` (日期)：截止日期

#### 排期表（可选，用于存储排期结果）
用于存储排期结果。

**字段配置**：
- `taskName` (文本)：任务名称
- `taskId` (文本)：任务ID
- `resourceName` (文本)：负责人姓名
- `resourceId` (文本)：负责人ID
- `plannedStartDate` (日期)：计划开始日期
- `plannedEndDate` (日期)：计划结束日期
- `plannedHours` (数字)：计划工时
- `status` (单选)：状态
- `priority` (单选)：优先级

### 3. 配置权限

在飞书开放平台，为应用添加以下权限：

- `bitable:app` - 多维表操作权限

### 4. 授予应用访问权限

1. 在飞书网页端打开多维表格
2. 点击右上角「...」->「...更多」->「添加文档应用」
3. 选择你创建的应用
4. 授予可管理权限

---

## 使用流程

### 第一步：配置系统

1. 打开项目排期系统
2. 点击右上角「飞书集成」按钮
3. 填写配置信息：
   - App ID
   - App Secret
   - App Token（从多维表 URL 获取）
   - 人员表 Table ID
   - 项目表 Table ID
   - 任务表 Table ID
   - 排期表 Table ID（可选）

4. 点击「测试连接」验证配置
5. 点击「保存配置」

### 第二步：加载数据

1. 点击「立即同步」按钮
2. 系统将从飞书多维表读取人员、项目、任务数据
3. 数据加载完成后自动刷新页面

### 第三步：进行排期

1. 在「复杂场景」标签页查看加载的项目和任务
2. 点击「生成排期」按钮
3. 系统自动计算最优排期方案

### 第四步：同步排期结果

1. 排期完成后，在排期结果页面查看排期详情
2. 将排期结果数据复制到飞书多维表的排期表中

---

## API 接口说明

### 加载数据

**接口**: `GET /api/feishu/load-data`

**参数**:
- `app_token`: 多维表 App Token
- `resources_table_id`: 人员表 Table ID
- `projects_table_id`: 项目表 Table ID
- `tasks_table_id`: 任务表 Table ID

**响应**:
```json
{
  "success": true,
  "data": {
    "resources": [],
    "projects": [],
    "tasks": []
  }
}
```

### 同步排期结果

**接口**: `POST /api/feishu/sync-schedule`

**参数**:
- `app_token`: 多维表 App Token
- `schedules_table_id`: 排期表 Table ID

**请求体**:
```json
{
  "tasks": [
    {
      "id": "task-id",
      "name": "任务名称",
      "assignedResourceId": "resource-id",
      "assignedResourceName": "负责人姓名",
      "plannedStartDate": "2024-01-01",
      "plannedEndDate": "2024-01-05",
      "plannedHours": 40,
      "status": "pending",
      "priority": "medium"
    }
  ],
  "startDate": "2024-01-01"
}
```

**响应**:
```json
{
  "success": true,
  "stats": {
    "success": 10,
    "error": 0
  },
  "errors": []
}
```

---

## 环境变量配置

在 `.env.local` 文件中配置（可选）：

```env
# 飞书应用配置
NEXT_PUBLIC_FEISHU_APP_ID=your_app_id
NEXT_PUBLIC_FEISHU_APP_SECRET=your_app_secret
```

如果不配置环境变量，可以在飞书集成配置中直接填写。

---

## 注意事项

1. **应用权限**: 确保应用具有多维表的访问权限
2. **表格字段**: 多维表的字段名称需要严格按照要求配置
3. **数据格式**: 日期字段使用 ISO 格式（YYYY-MM-DD）
4. **同步冲突**: 系统会清空排期表后再写入新数据

---

## 常见问题

### Q: 如何获取 App Token？
A: 从飞书多维表的 URL 中获取。例如：`https://xxx.feishu.cn/base/bascnXXXXXX?table=tblXXXXXX`，App Token 就是 `bascnXXXXXX`。

### Q: 如何获取 Table ID？
A: 从飞书多维表的 URL 中获取。例如：`https://xxx.feishu.cn/base/bascnXXXXXX?table=tblXXXXXX`，Table ID 就是 `tblXXXXXX`。

### Q: 测试连接失败怎么办？
A: 检查以下事项：
- App ID 和 App Secret 是否正确
- App Token 是否正确
- 应用是否具有多维表的访问权限
- 应用是否在飞书开放平台配置了正确的权限

### Q: 加载数据失败怎么办？
A: 检查以下事项：
- Table ID 是否正确
- 表格字段是否按照要求配置
- 表格是否有数据

---

## 技术实现

### 认证方式

使用应用身份认证（app_access_token），无需用户登录。

```typescript
const appAccessToken = await getAppAccessToken();
```

### 数据加载

从飞书多维表读取数据并转换为系统格式。

```typescript
const response = await fetch(
  `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 100 }),
  }
);
```

### 数据同步

将排期结果写入飞书多维表。

```typescript
const response = await fetch(
  `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: scheduleData }),
  }
);
```

---

## 总结

新的飞书集成方式更加简洁高效：

✅ 无需用户扫码登录
✅ 直接使用应用身份访问
✅ 自动加载多维表数据
✅ 支持排期结果同步
✅ 配置简单，易于使用

开始使用吧！
