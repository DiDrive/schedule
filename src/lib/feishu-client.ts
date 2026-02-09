/**
 * 飞书 API 客户端
 * 封装飞书开放平台的 API 调用
 * 注意：不使用 @larksuiteoapi/node-sdk，因为它依赖 Node.js 的 fs 模块
 */

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableIds: {
    resources: string;
    projects: string;
    tasks: string;
    schedules: string;
  };
}

export interface FeishuRecord {
  record_id: string;
  fields: Record<string, any>;
  created_time: number;
  last_modified_time: number;
}

export interface FeishuListResponse {
  items: FeishuRecord[];
  total: number;
  has_more: boolean;
  page_token?: string;
}

let accessToken: string | null = null;
let tokenExpireTime: number = 0;
let configCache: FeishuConfig | null = null;
let userAccessToken: string | null = null; // 用户令牌（通过 OAuth 获取）

/**
 * 设置用户访问令牌
 */
export function setUserAccessToken(token: string) {
  userAccessToken = token;
  console.log('[飞书客户端] 用户令牌已设置');
}

/**
 * 清除用户访问令牌
 */
export function clearUserAccessToken() {
  userAccessToken = null;
  console.log('[飞书客户端] 用户令牌已清除');
}

/**
 * 初始化飞书客户端
 */
export function initFeishuClient(config: FeishuConfig) {
  configCache = config;
  console.log('[飞书客户端] 初始化完成');
}

/**
 * 获取访问令牌
 */
export async function getAccessToken(): Promise<string> {
  if (!configCache) {
    throw new Error('飞书客户端未初始化，请先调用 initFeishuClient');
  }

  // 检查 token 是否有效
  if (accessToken && tokenExpireTime > Date.now()) {
    return accessToken;
  }

  // 使用原生 HTTP 请求获取 tenant_access_token
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: configCache.appId,
      app_secret: configCache.appSecret,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`获取飞书访问令牌失败: ${data.msg}`);
  }

  accessToken = data.tenant_access_token || '';
  tokenExpireTime = Date.now() + ((data.expire || 7200) - 60) * 1000; // 提前1分钟过期

  return accessToken || '';
}

/**
 * 获取飞书记录列表
 * @param appToken 多维表 Token
 * @param tableId 表格 ID
 * @param options 选项
 * @param useUserToken 是否使用用户令牌（通过 OAuth 获取）
 */
export async function listFeishuRecords(
  appToken: string,
  tableId: string,
  options?: {
    pageSize?: number;
    pageToken?: string;
    filter?: any;
  },
  useUserToken: boolean = false
): Promise<FeishuListResponse> {
  // 优先使用用户令牌，如果没有则使用应用令牌
  const token = useUserToken ? userAccessToken : await getAccessToken();

  if (!token) {
    throw new Error(useUserToken ? '用户令牌未设置，请先使用飞书登录' : '获取访问令牌失败');
  }

  // 构建请求参数
  const requestBody: any = {};

  // 只有在有值的情况下才添加参数
  if (options?.pageSize && options.pageSize > 0) {
    requestBody.page_size = Math.min(options.pageSize, 500);
  }

  if (options?.pageToken) {
    requestBody.page_token = options.pageToken;
  }

  // filter 参数需要特殊处理，只有在明确提供时才添加
  if (options?.filter && Object.keys(options.filter).length > 0) {
    requestBody.filter = options.filter;
  }

  console.log('[飞书API] 获取记录列表:', {
    appToken,
    tableId,
    body: requestBody
  });

  // 飞书API要求必须包含 fields 参数
  if (!requestBody.fields) {
    requestBody.fields = []; // 如果没有指定 fields，默认为空数组
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  const data = await response.json();

  console.log('[飞书API] 响应:', {
    code: data.code,
    msg: data.msg,
    hasData: !!data.data,
    hasItems: data.data?.items ? true : false,
    itemsCount: data.data?.items?.length || 0
  });

  if (data.code !== 0) {
    console.error('[飞书API] 错误详情:', JSON.stringify(data, null, 2));
    throw new Error(`获取飞书记录失败: ${data.msg}`);
  }

  return {
    items: data.data.items || [],
    total: data.data.total || 0,
    has_more: data.data.has_more || false,
    page_token: data.data.page_token,
  };
}

/**
 * 获取单条飞书记录
 */
export async function getFeishuRecord(
  appToken: string,
  tableId: string,
  recordId: string
): Promise<FeishuRecord> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`获取飞书记录失败: ${data.msg}`);
  }

  return data.data;
}

/**
 * 创建飞书记录
 */
export async function createFeishuRecord(
  appToken: string,
  tableId: string,
  fields: Record<string, any>
): Promise<FeishuRecord> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`创建飞书记录失败: ${data.msg}`);
  }

  return data.data.record;
}

/**
 * 批量创建飞书记录
 */
export async function batchCreateFeishuRecords(
  appToken: string,
  tableId: string,
  records: Record<string, any>[]
): Promise<FeishuRecord[]> {
  const token = await getAccessToken();

  console.log('[飞书API] 批量创建记录:', {
    appToken,
    tableId,
    recordCount: records.length,
    firstRecord: records[0] ? JSON.stringify(records[0]) : null
  });

  const requestBody = {
    records: records.map(r => ({ fields: r }))
  };

  console.log('[飞书API] 请求体:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  const data = await response.json();

  console.log('[飞书API] 批量创建响应:', {
    code: data.code,
    msg: data.msg,
    hasData: !!data.data
  });

  if (data.code !== 0) {
    console.error('[飞书API] 批量创建错误详情:', JSON.stringify(data, null, 2));
    throw new Error(`批量创建飞书记录失败: ${data.msg}`);
  }

  return data.data.records || [];
}

/**
 * 更新飞书记录
 */
export async function updateFeishuRecord(
  appToken: string,
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<FeishuRecord> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`更新飞书记录失败: ${data.msg}`);
  }

  return data.data.record;
}

/**
 * 批量更新飞书记录
 */
export async function batchUpdateFeishuRecords(
  appToken: string,
  tableId: string,
  records: { record_id: string; fields: Record<string, any> }[]
): Promise<FeishuRecord[]> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`批量更新飞书记录失败: ${data.msg}`);
  }

  return data.data.records || [];
}

/**
 * 删除飞书记录
 */
export async function deleteFeishuRecord(
  appToken: string,
  tableId: string,
  recordId: string
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`删除飞书记录失败: ${data.msg}`);
  }
}

/**
 * 测试连接
 */
export async function testConnection(config: FeishuConfig): Promise<boolean> {
  try {
    initFeishuClient(config);
    await getAccessToken();
    return true;
  } catch (error) {
    console.error('测试飞书连接失败:', error);
    return false;
  }
}

/**
 * 获取飞书配置（从 localStorage）
 * 注意：这个函数只能在客户端调用
 */
export function getFeishuConfig(): FeishuConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      return null;
    }

    const config = JSON.parse(configStr);

    // 验证配置格式
    if (!config.appId || !config.appSecret || !config.appToken || !config.tableIds) {
      return null;
    }

    return config as FeishuConfig;
  } catch (error) {
    console.error('读取飞书配置失败:', error);
    return null;
  }
}
