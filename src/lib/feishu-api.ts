// 飞书 API 配置
const FEISHU_APP_ID = process.env.NEXT_PUBLIC_FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = process.env.NEXT_PUBLIC_FEISHU_APP_SECRET || '';

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

let appAccessTokenCache: string | null = null;
let appAccessTokenExpireTime: number = 0;

/**
 * 获取应用访问令牌
 */
export async function getAppAccessToken(): Promise<string> {
  // 检查配置
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    log('[飞书API] ❌ 缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量');
    throw new Error('飞书应用配置不完整，请检查环境变量');
  }

  // 检查缓存
  if (appAccessTokenCache && appAccessTokenExpireTime > Date.now()) {
    log('[飞书API] 使用缓存的 app_access_token');
    return appAccessTokenCache;
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
    appAccessTokenCache = data.app_access_token;
    appAccessTokenExpireTime = Date.now() + (data.expire - 300) * 1000;

    log('[飞书API] ✅ 成功获取 app_access_token');
    return data.app_access_token;

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
  appAccessTokenCache = null;
  appAccessTokenExpireTime = 0;
  log('[飞书API] 清除令牌缓存');
}
