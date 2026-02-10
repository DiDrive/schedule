import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 飞书 OAuth 配置（使用与前端相同的 App ID）
const FEISHU_APP_ID = 'cli_a90f3ef5a393900b';
const FEISHU_APP_SECRET = 'RQGkC8vU4d2lL3K6Y9mN2pQ5rT8vW1zX'; // TODO: 需要用户提供正确的 App Secret

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

    // 调用飞书 API 获取 user_access_token
    const tokenUrl = 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token';

    const requestBody = {
      grant_type: 'authorization_code',
      client_id: FEISHU_APP_ID,
      client_secret: FEISHU_APP_SECRET,
      code: code,
    };

    log('[飞书 OAuth] 请求 URL: ' + tokenUrl);
    log('[飞书 OAuth] 请求体: ' + JSON.stringify({
      grant_type: requestBody.grant_type,
      client_id: requestBody.client_id,
      client_secret: '***已隐藏***',
      code: requestBody.code.substring(0, 10) + '...'
    }, null, 2));

    const response = await fetch(tokenUrl, {
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
