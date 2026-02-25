# 飞书多维表数据获取指南

## 一、前置条件

### 1. 获取多维表信息

在飞书多维表中：
1. 打开你的多维表
2. 点击右上角"..."
3. 选择"设置" → "开发设置"
4. 记录以下信息：
   - **app_token**: 应用令牌（格式：`bascn...`）
   - **table_id**: 表格ID（格式：`tbl...`）

### 2. 获取字段ID

在开发设置中，你可以看到所有字段的 field_id：
```
任务ID -> field_1
所属项目 -> field_2
任务类型 -> field_3
负责人 -> field_4
开始时间 -> field_5
结束时间 -> field_6
截止日期 -> field_7
```

---

## 二、API 接口信息

### 获取多维表数据

**API 端点**：
```
GET https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
```

**请求头**：
```
Authorization: Bearer {user_access_token}
```

**请求参数**：
- `page_size`: 每页数量（最大100）
- `page_token`: 分页令牌（首次请求不需要）
- `field_names`: 指定返回的字段（可选）

**响应示例**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "items": [
      {
        "record_id": "recxxxxxx",
        "fields": {
          "任务ID": "T001",
          "所属项目": "项目A",
          "任务类型": "开发",
          "负责人": [
            {
              "id": "ou_xxxxxx",
              "name": "张三"
            }
          ],
          "开始时间": 1716144000000,
          "结束时间": 1716172800000,
          "截止日期": 1716144000000
        },
        "created_time": 1716057600000,
        "last_modified_time": 1716057600000
      }
    ],
    "page_token": "xxx",
    "total": 1
  }
}
```

---

## 三、字段类型说明

| 字段名 | API 字段类型 | 数据格式 |
|--------|-------------|----------|
| 任务ID | Text | 字符串 |
| 所属项目 | SingleSelect | 字符串 |
| 任务类型 | SingleSelect | 字符串 |
| 负责人 | Person | 数组，包含用户信息 |
| 开始时间 | DateTime | 毫秒时间戳 |
| 结束时间 | DateTime | 毫秒时间戳 |
| 截止日期 | Date | 毫秒时间戳 |

**时间戳转换**：
```javascript
// 毫秒时间戳转日期
const date = new Date(1716144000000);
// -> Mon May 20 2024 00:00:00 GMT+0800
```

---

## 四、实现方案

### 后端 API 路由

创建 `src/app/api/feishu/bitable/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 从 URL 参数获取配置
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const tableId = searchParams.get('table_id');

    if (!appToken || !tableId) {
      return NextResponse.json(
        { error: '缺少 app_token 或 table_id' },
        { status: 400 }
      );
    }

    // 从 cookie 或 localStorage 获取用户令牌
    const userAccessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!userAccessToken) {
      return NextResponse.json(
        { error: '需要登录' },
        { status: 401 }
      );
    }

    // 调用飞书 API
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=100`,
      {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.msg || '获取数据失败', code: data.code },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
```

---

## 五、使用步骤

### 1. 配置多维表信息

在飞书 OAuth 登录页面添加配置：
```typescript
const [appToken, setAppToken] = useState(''); // 从开发设置获取
const [tableId, setTableId] = useState('');   // 从开发设置获取
```

### 2. 获取数据

```typescript
const fetchBitableData = async () => {
  const token = localStorage.getItem('feishu-user-token');
  const response = await fetch(
    `/api/feishu/bitable?app_token=${appToken}&table_id=${tableId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  console.log('多维表数据:', data);
};
```

### 3. 显示数据

```typescript
{data.data.items.map((item: any) => (
  <div key={item.record_id}>
    <h3>{item.fields['任务ID']}</h3>
    <p>项目: {item.fields['所属项目']}</p>
    <p>类型: {item.fields['任务类型']}</p>
    <p>负责人: {item.fields['负责人']?.[0]?.name}</p>
  </div>
))}
```

---

## 六、权限要求

### 用户访问令牌（user_access_token）

- 必须通过 OAuth 2.0 流程获取
- 用户需要拥有多维表的访问权限
- 令牌有效期约 2 小时

### 应用访问令牌（app_access_token）

- 使用 App ID 和 App Secret 获取
- 适用于应用级别的操作
- 权限更大，但可能访问不到用户个人数据

---

## 七、常见问题

### Q1: 返回错误 code 99991663？

**原因**: 没有多维表的访问权限

**解决**:
1. 将用户添加到多维表的成员列表
2. 或者使用应用访问令牌（需要应用有足够权限）

### Q2: 时间戳如何转换？

```javascript
// 毫秒时间戳转日期字符串
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('zh-CN');
};

// 毫秒时间戳转日期时间字符串
const formatDateTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};
```

### Q3: 如何分页获取所有数据？

```typescript
const fetchAllData = async () => {
  let allData: any[] = [];
  let pageToken = '';

  do {
    const response = await fetch(
      `/api/feishu/bitable?app_token=${appToken}&table_id=${tableId}&page_size=100&page_token=${pageToken}`
    );
    const data = await response.json();
    allData = [...allData, ...data.data.items];
    pageToken = data.data.page_token;
  } while (pageToken);

  return allData;
};
```

---

## 八、完整示例

访问飞书开放平台文档查看更多示例：
https://open.feishu.cn/document/server-docs/docs/bitable-v1/app/record/list
