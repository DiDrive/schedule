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
  try {
    fs.appendFileSync('/app/work/logs/bypass/feishu-oauth.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code) {
      log('[飞书 OAuth] ❌ 缺少授权码');
      return NextResponse.json(
        { error: '缺少授权码' },
        { status: 400 }
      );
    }

    log('[飞书 OAuth] 正在用授权码换取访问令牌...');
    log('[飞书 OAuth] 授权码: ' + code.substring(0, 10) + '...');
    log('[飞书 OAuth] State: ' + (state || '未提供'));
    log('[飞书 OAuth] App ID: ' + FEISHU_APP_ID);

    // 步骤 1: 获取 app_access_token
    log('[飞书 OAuth] 步骤 1: 获取 app_access_token');
    const appTokenUrl = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

    const appTokenResponse = await fetch(appTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    });

    const appTokenData = await appTokenResponse.json();

    log('[飞书 OAuth] app_access_token 响应: ' + JSON.stringify({
      code: appTokenData.code,
      msg: appTokenData.msg,
      has_token: !!appTokenData.tenant_access_token
    }));

    if (!appTokenResponse.ok || appTokenData.code !== 0) {
      const errorMsg = appTokenData.msg || '获取 app_access_token 失败';
      log('[飞书 OAuth] ❌ 获取 app_access_token 失败: ' + errorMsg);
      throw new Error('获取应用凭证失败: ' + errorMsg);
    }

    const appAccessToken = appTokenData.tenant_access_token;
    log('[飞书 OAuth] ✅ 成功获取 app_access_token');

    // 步骤 2: 使用授权码换取 user_access_token（标准 OIDC 流程）
    log('[飞书 OAuth] 步骤 2: 使用授权码换取 user_access_token');
    const userTokenUrl = 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token';

    const requestBody = {
      grant_type: 'authorization_code',
      code: code,
    };

    log('[飞书 OAuth] 请求 URL: ' + userTokenUrl);
    log('[飞书 OAuth] 请求参数: ' + JSON.stringify({
      grant_type: requestBody.grant_type,
      code: requestBody.code.substring(0, 10) + '...'
    }, null, 2));

    const response = await fetch(userTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    log('[飞书 OAuth] 响应状态: ' + response.status);
    log('[飞书 OAuth] 响应原始数据: ' + responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      log('[飞书 OAuth] ❌ JSON 解析失败: ' + responseText);
      throw new Error('服务器返回无效的数据格式');
    }

    log('[飞书 OAuth] 解析后数据: ' + JSON.stringify({
      code: data.code,
      msg: data.msg,
      has_access_token: !!data.access_token,
      has_refresh_token: !!data.refresh_token,
      expires_in: data.expires_in,
    }));

    if (!response.ok || data.code !== 0) {
      const errorMsg = data.msg || '获取访问令牌失败';
      log('[飞书 OAuth] ❌ 错误: ' + errorMsg);
      log('[飞书 OAuth] 错误代码: ' + data.code);
      throw new Error(errorMsg);
    }

    log('[飞书 OAuth] ✅ 成功获取访问令牌');
    log('[飞书 OAuth] 令牌有效期: ' + (data.expires_in || '未知') + ' 秒');

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
