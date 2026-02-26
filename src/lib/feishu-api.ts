// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-api.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

let appAccessTokenCache: Map<string, { token: string; expireTime: number }> = new Map();

/**
 * 获取应用访问令牌
 * @param appId 应用 ID（可选，如果不传则从环境变量读取）
 * @param appSecret 应用密钥（可选，如果不传则从环境变量读取）
 */
export async function getAppAccessToken(appId?: string, appSecret?: string): Promise<string> {
  // 如果没有传入参数，从环境变量读取
  const FEISHU_APP_ID = appId || process.env.NEXT_PUBLIC_FEISHU_APP_ID || '';
  const FEISHU_APP_SECRET = appSecret || process.env.NEXT_PUBLIC_FEISHU_APP_SECRET || '';

  // 检查配置
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    log('[飞书API] ❌ 缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET');
    throw new Error('飞书应用配置不完整，请填写 App ID 和 App Secret');
  }

  // 生成缓存键
  const cacheKey = `${FEISHU_APP_ID}:${FEISHU_APP_SECRET.substring(0, 10)}`;

  // 检查缓存
  const cached = appAccessTokenCache.get(cacheKey);
  if (cached && cached.expireTime > Date.now()) {
    log('[飞书API] 使用缓存的 app_access_token');
    return cached.token;
  }

  log('[飞书API] 开始获取 app_access_token');

  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    });

    const data = await response.json();

    if (data.code !== 0) {
      log(`[飞书API] ❌ 获取 app_access_token 失败: ${data.msg}`);
      throw new Error(`获取应用访问令牌失败: ${data.msg}`);
    }

    // 缓存令牌（提前 5 分钟过期）
    const token = data.app_access_token;
    const expireTime = Date.now() + (data.expire - 300) * 1000;
    appAccessTokenCache.set(cacheKey, { token, expireTime });

    log('[飞书API] ✅ 成功获取 app_access_token');
    return token;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书API] ❌ 获取 app_access_token 异常: ${errorMessage}`);
    throw error;
  }
}

/**
 * 清除令牌缓存（用于测试或强制刷新）
 */
export function clearAccessTokenCache(): void {
  appAccessTokenCache.clear();
  log('[飞书API] 清除令牌缓存');
}
