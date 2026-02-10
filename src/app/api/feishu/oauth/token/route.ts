import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 飞书 OAuth 配置
const FEISHU_APP_ID = 'cli_a90ff12d93635bc4';
const FEISHU_APP_SECRET = 'n2rCClUbnOVZoOMMsBDyxfGwtZd1oFO5';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync('/app/work/logs/bypass/feishu-oauth.log', logMessage);
};

export async function POST(request: NextRequest) {
  try {
    const { code, state, appId: requestAppId } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: '缺少授权码' },
        { status: 400 }
      );
    }

    log('[飞书 OAuth] 正在用授权码换取访问令牌...');
    log('[飞书 OAuth] 授权码: ' + code.substring(0, 10) + '...');
    log('[飞书 OAuth] 请求 App ID: ' + (requestAppId || '未提供'));
    log('[飞书 OAuth] 使用 App ID: ' + FEISHU_APP_ID);

    // 先获取 tenant_access_token
    log('[飞书 OAuth] 步骤 1: 获取 tenant_access_token');
    const tenantTokenUrl = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

    const tenantTokenResponse = await fetch(tenantTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    });

    const tenantTokenData = await tenantTokenResponse.json();

    log('[飞书 OAuth] tenant_access_token 响应: ' + JSON.stringify({
      code: tenantTokenData.code,
      msg: tenantTokenData.msg,
      has_token: !!tenantTokenData.tenant_access_token
    }));

    if (!tenantTokenResponse.ok || tenantTokenData.code !== 0) {
      const errorMsg = tenantTokenData.msg || '获取 tenant_access_token 失败';
      log('[飞书 OAuth] ❌ 获取 tenant_access_token 失败: ' + errorMsg);
      throw new Error('获取应用凭证失败: ' + errorMsg);
    }

    const tenantAccessToken = tenantTokenData.tenant_access_token;
    log('[飞书 OAuth] ✅ 成功获取 tenant_access_token');

    // 步骤 2: 使用授权码换取 user_access_token（套件授权流程）
    log('[飞书 OAuth] 步骤 2: 使用授权码换取 user_access_token');
    const userTokenUrl = 'https://open.feishu.cn/open-apis/authen/v1/access_token';

    const requestBody = {
      grant_type: 'authorization_code',
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
      code: code,
    };

    log('[飞书 OAuth] 请求 URL: ' + userTokenUrl);
    log('[飞书 OAuth] 请求参数: ' + JSON.stringify({
      grant_type: requestBody.grant_type,
      app_id: requestBody.app_id,
      app_secret: FEISHU_APP_SECRET.substring(0, 5) + '***',
      code: requestBody.code.substring(0, 10) + '...'
    }, null, 2));

    const response = await fetch(userTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    log('[飞书 OAuth] 响应状态: ' + response.status);
    log('[飞书 OAuth] 响应数据: ' + JSON.stringify(data, null, 2));

    if (!response.ok || data.code !== 0) {
      const errorMsg = data.msg || '获取访问令牌失败';
      log('[飞书 OAuth] ❌ 错误: ' + errorMsg);
      throw new Error(errorMsg);
    }

    log('[飞书 OAuth] ✅ 成功获取访问令牌');

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });

  } catch (error) {
    log('[飞书 OAuth] ❌ 异常: ' + (error instanceof Error ? error.message : String(error)));
    if (error instanceof Error) {
      log('[飞书 OAuth] 堆栈: ' + error.stack);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '授权失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
