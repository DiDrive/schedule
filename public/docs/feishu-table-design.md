# 飞书多维表结构设计

## 概述
本文档描述了与项目排期系统集成的飞书多维表结构设计，包括人员、项目、任务、排期四个核心表。

---

## 1. 人员表（resources）

| 字段名称 | 字段类型 | 字段ID | 说明 | 系统字段映射 |
|---------|---------|--------|------|------------|
| 人员ID | 单行文本 | id | 人员唯一标识（系统自动生成） | `id` |
| 姓名 | 单行文本 | name | 人员姓名 | `name` |
| 类型 | 单选 | type | 人员类型：平面设计、后期制作 | `resourceType` |
| 效率系数 | 数字 | efficiency | 效率系数（0.5 - 2.0） | `efficiency` |
| 飞书用户ID | 人员 | feishu_user | 对应的飞书用户 | `feishuUserId` |
| 累计工时 | 数字 | total_hours | 累计工作小时数 | `totalHours` |
| 创建时间 | 日期 | created_at | 记录创建时间 | `createdAt` |
| 更新时间 | 日期 | updated_at | 记录更新时间 | `updatedAt` |

**类型选项**：
- 平面设计
- 后期制作
- 物料（可选）

---

## 2. 项目表（projects）

| 字段名称 | 字段类型 | 字段ID | 说明 | 系统字段映射 |
|---------|---------|--------|------|------------|
| 项目ID | 单行文本 | id | 项目唯一标识（系统自动生成） | `id` |
| 项目名称 | 单行文本 | name | 项目名称 | `name` |
| 描述 | 多行文本 | description | 项目描述 | `description` |
| 开始日期 | 日期 | start_date | 项目开始日期 | `startDate` |
| 结束日期 | 日期 | end_date | 项目结束日期 | `endDate` |
| 状态 | 单选 | status | 项目状态 | `status` |
| 创建时间 | 日期 | created_at | 记录创建时间 | `createdAt` |
| 更新时间 | 日期 | updated_at | 记录更新时间 | `updatedAt` |

**状态选项**：
- 未开始
- 进行中
- 已完成
- 已暂停

---

## 3. 任务表（tasks）

| 字段名称 | 字段类型 | 字段ID | 说明 | 系统字段映射 |
|---------|---------|--------|------|------------|
| 任务ID | 单行文本 | id | 任务唯一标识（系统自动生成） | `id` |
| 任务名称 | 单行文本 | name | 任务名称 | `name` |
| 项目 | 关联记录 | project | 关联项目表 | `projectId` |
| 类型 | 单选 | type | 任务类型 | `taskType` |
| 预估工时 | 数字 | estimated_hours | 预估工作小时数 | `estimatedHours` |
| 实际工时 | 数字 | actual_hours | 实际工作小时数 | `actualHours` |
| 开始时间 | 日期 | start_time | 任务开始时间 | `startDate` |
| 结束时间 | 日期 | end_time | 任务结束时间 | `endDate` |
| 截止日期 | 日期 | deadline | 任务截止日期 | `deadline` |
| 优先级 | 单选 | priority | 任务优先级 | `priority` |
| 负责人 | 人员 | assignee | 任务负责人（支持多人） | `assignedResources` |
| 依赖任务 | 关联记录 | dependencies | 依赖的其他任务（自关联） | `dependencies` |
| 状态 | 单选 | status | 任务状态 | `status` |
| 是否超期 | 复选框 | is_overdue | 是否超期 | `isOverdue` |
| 飞书记录版本 | 数字 | feishu_version | 飞书记录版本号（冲突检测用） | `feishuVersion` |
| 系统记录版本 | 数字 | system_version | 系统记录版本号（冲突检测用） | `systemVersion` |
| 最后同步时间 | 日期 | last_synced_at | 最后同步时间 | `lastSyncedAt` |
| 同步来源 | 单选 | sync_source | 最后同步来源 | `syncSource` |
| 创建时间 | 日期 | created_at | 记录创建时间 | `createdAt` |
| 更新时间 | 日期 | updated_at | 记录更新时间 | `updatedAt` |

**类型选项**：
- 平面设计
- 后期制作
- 物料

**优先级选项**：
- 高
- 中
- 低

**状态选项**：
- 未开始
- 进行中
- 已完成
- 已暂停
- 已超期

**同步来源选项**：
- 系统
- 飞书
- 手动

---

## 4. 排期表（schedules）

| 字段名称 | 字段类型 | 字段ID | 说明 | 系统字段映射 |
|---------|---------|--------|------|------------|
| 排期ID | 单行文本 | id | 排期唯一标识（系统自动生成） | `id` |
| 项目 | 关联记录 | project | 关联项目表 | `projectId` |
| 排期名称 | 单行文本 | name | 排期名称 | `name` |
| 排期版本 | 数字 | version | 排期版本号 | `version` |
| 任务总数 | 数字 | task_count | 任务总数 | `taskCount` |
| 总工时 | 数字 | total_hours | 总工时 | `totalHours` |
| 资源利用率 | 百分比 | utilization | 资源利用率 | `utilization` |
| 关键路径数量 | 数字 | critical_path_count | 关键路径任务数量 | `criticalPathCount` |
| 排期开始时间 | 日期 | start_time | 排期开始时间 | `startTime` |
| 排期结束时间 | 日期 | end_time | 排期结束时间 | `endTime` |
| 生成时间 | 日期 | generated_at | 排期生成时间 | `generatedAt` |
| 创建时间 | 日期 | created_at | 记录创建时间 | `createdAt` |
| 更新时间 | 日期 | updated_at | 记录更新时间 | `updatedAt` |

---

## 字段说明

### 系统字段映射规则
- 系统字段名采用 camelCase（如 `estimatedHours`）
- 飞书字段ID采用 snake_case（如 `estimated_hours`）
- 飞书字段名称支持中文，便于业务人员理解

### 版本控制字段
- **飞书记录版本**（`feishu_version`）：每次飞书修改时递增
- **系统记录版本**（`system_version`）：每次系统修改时递增
- **最后同步时间**（`last_synced_at`）：记录最后同步时间
- **同步来源**（`sync_source`）：记录最后同步来源（系统/飞书/手动）

### 冲突检测规则
- 比较两个版本号：
  - 如果 `feishu_version > system_version`：以飞书为准
  - 如果 `system_version > feishu_version`：提示用户确认（按照用户要求，最终以飞书为准）
  - 如果 `feishu_version == system_version`：无冲突

---

## 飞书多维表创建步骤

1. 在飞书中创建一个新的多维表应用
2. 创建以下数据表（按顺序）：
   - 人员表（resources）
   - 项目表（projects）
   - 任务表（tasks）
   - 排期表（schedules）

3. 设置关联关系：
   - 任务表关联项目表（`project` 字段）
   - 任务表自关联依赖任务（`dependencies` 字段）
   - 排期表关联项目表（`project` 字段）

4. 获取表格信息：
   - App Token：在飞书应用 URL 中获取
   - Table ID：在飞书应用设置中查看

---

## 数据同步规则

### 定时同步
- **同步频率**：每5分钟一次
- **同步方向**：双向同步
- **冲突处理**：以多维表数据为准

### 手动同步
- 用户可以手动触发同步
- 支持选择同步方向：
  - 系统到飞书
  - 飞书到系统
  - 双向同步

### 实时同步（Webhook）
- 飞书多维表变更时通过 Webhook 通知系统
- 系统接收后立即处理更新

---

## 注意事项

1. **字段ID必须严格按照文档设置**，否则同步会失败
2. **日期字段需要包含时间**，而不仅仅是日期
3. **关联记录需要先创建关联的目标记录**
4. **人员字段建议使用飞书人员类型**，方便消息推送
5. **版本号字段设置为隐藏**，避免用户误修改
