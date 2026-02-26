# 飞书多维表 API 使用指南

## 概述

本系统提供了完整的飞书多维表 CRUD 操作接口，支持查询、新增、更新和删除记录。

## 接口列表

### 1. 查询记录

**接口地址**: `POST /api/feishu/bitable`

**请求头**:
```
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

**URL 参数**:
- `app_token`: 多维表格 App 的唯一标识
- `table_id`: 多维表格数据表的唯一标识

**请求体** (可选，用于筛选、排序等):
```json
{
  "page_size": 100,
  "page_token": "",
  "filter": {
    "conjunction": "and",
    "conditions": [
      {
        "field_name": "text_field",
        "operator": "is",
        "value": [
          "示例文本"
        ]
      }
    ]
  },
  "sort": [
    {
      "field_name": "created_time",
      "desc": true
    }
  ]
}
```

**响应示例**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "items": [
      {
        "record_id": "recpCsf4ME",
        "fields": {
          "text_field": "示例文本",
          "number_field": 123
        },
        "created_time": 1234567890000,
        "last_modified_time": 1234567890000
      }
    ],
    "total": 100,
    "page_token": "xxx",
    "has_more": true
  }
}
```

---

### 2. 新增记录

**接口地址**: `POST /api/feishu/bitable/records`

**请求头**:
```
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

**URL 参数**:
- `app_token`: 多维表格 App 的唯一标识
- `table_id`: 多维表格数据表的唯一标识

**请求体**:
```json
{
  "fields": {
    "text_field": "示例文本",
    "number_field": 123,
    "select_field": "选项1"
  }
}
```

**响应示例**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "record": {
      "record_id": "recpCsf4ME",
      "fields": {
        "text_field": "示例文本",
        "number_field": 123
      },
      "created_time": 1234567890000
    }
  }
}
```

---

### 3. 更新记录

**接口地址**: `PUT /api/feishu/bitable/records/{record_id}`

**请求头**:
```
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

**URL 参数**:
- `app_token`: 多维表格 App 的唯一标识
- `table_id`: 多维表格数据表的唯一标识
- `record_id`: 记录的唯一标识（在 URL 路径中）

**请求体**:
```json
{
  "fields": {
    "text_field": "更新的文本",
    "number_field": 456
  }
}
```

**响应示例**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "record": {
      "record_id": "recpCsf4ME",
      "fields": {
        "text_field": "更新的文本",
        "number_field": 456
      },
      "created_time": 1234567890000,
      "last_modified_time": 1234567895000
    }
  }
}
```

---

### 4. 删除记录

**接口地址**: `DELETE /api/feishu/bitable/records/{record_id}`

**请求头**:
```
Authorization: Bearer <user_access_token>
Content-Type: application/json
```

**URL 参数**:
- `app_token`: 多维表格 App 的唯一标识
- `table_id`: 多维表格数据表的唯一标识
- `record_id`: 记录的唯一标识（在 URL 路径中）

**请求体**: 无

**响应示例**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "deleted": true,
    "record_id": "recpCsf4ME"
  }
}
```

---

## 使用流程

### 1. 获取凭证

首先需要完成飞书扫码登录，获取 `user_access_token`：

```typescript
// 1. 访问 /feishu-oauth 页面进行扫码登录
// 2. 登录成功后，token 会保存在 localStorage 中
const userAccessToken = localStorage.getItem('feishu_user_access_token');
```

### 2. 获取多维表信息

从飞书多维表的 URL 中获取 `app_token` 和 `table_id`：

示例 URL:
```
https://xxxx.feishu.cn/base/bascnXXXXXX?table=tblXXXXXX
```

- `app_token`: `bascnXXXXXX` (base 后面的部分)
- `table_id`: `tblXXXXXX` (table 参数的值)

### 3. 调用 API

#### 查询记录

```typescript
const response = await fetch(
  `/api/feishu/bitable?app_token=${appToken}&table_id=${tableId}`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 100 }),
  }
);

const data = await response.json();
console.log(data.data.items); // 记录列表
```

#### 新增记录

```typescript
const response = await fetch(
  `/api/feishu/bitable/records?app_token=${appToken}&table_id=${tableId}`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        text_field: "示例文本",
        number_field: 123,
      },
    }),
  }
);

const data = await response.json();
console.log(data.data.record.record_id); // 新记录的 ID
```

#### 更新记录

```typescript
const response = await fetch(
  `/api/feishu/bitable/records/${recordId}?app_token=${appToken}&table_id=${tableId}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        text_field: "更新的文本",
      },
    }),
  }
);

const data = await response.json();
console.log(data.data.record); // 更新后的记录
```

#### 删除记录

```typescript
const response = await fetch(
  `/api/feishu/bitable/records/${recordId}?app_token=${appToken}&table_id=${tableId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
  }
);

const data = await response.json();
console.log(data.data.deleted); // 是否删除成功
```

---

## 前端演示页面

访问 `/feishu-bitable-demo` 页面可以使用图形界面演示所有 API 功能。

演示页面提供：
- ✅ 登录状态检查
- ✅ 输入 App Token 和 Table ID
- ✅ 查询记录列表
- ✅ 新增记录（JSON 格式）
- ✅ 编辑记录（JSON 格式）
- ✅ 删除记录
- ✅ 错误提示和成功提示

---

## 常见错误

### 401 Unauthorized
- 原因：缺少用户访问令牌或令牌已过期
- 解决：访问 `/feishu-oauth` 重新扫码登录

### 403 Permission denied
- 原因：当前用户没有多维表的访问权限
- 解决：在飞书网页端授予用户访问权限

### 1254036 Base is copying
- 原因：多维表格正在复制中
- 解决：稍后重试

### 1254291 Write conflict
- 原因：并发写入冲突
- 解决：避免对同一个表进行并发写操作

### 1254607 Data not ready
- 原因：数据尚未准备好或请求超时
- 解决：降低批量操作的数量，等待一段时间后重试

---

## 注意事项

1. **权限要求**：确保当前用户具有多维表的访问权限
2. **频率限制**：接口有频率限制（如查询接口 50 次/秒）
3. **并发写入**：同一个数据表不支持并发调用写接口
4. **数据一致性**：默认开启读写一致性检查，确保数据一致性
5. **高级权限**：如果表格开启了高级权限，需要具有相应的管理权限

---

## 日志查看

所有 API 调用都会记录到日志文件中：

```bash
tail -f /app/work/logs/bypass/feishu-bitable.log
```

日志格式：
```
[2025-01-09T10:30:00.000Z] [飞书多维表] 开始查询: app_token=bascnXXXXXX..., table_id=tblXXXXXX...
[2025-01-09T10:30:01.000Z] [飞书多维表] ✅ 成功获取 10 条记录，总计 100 条
```

---

## 相关文档

- [飞书开放平台 - 多维表 API](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/)
- [如何获取 app_token 和 table_id](https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1DN/bitable-overview)
- [字段类型说明](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/field-type)
