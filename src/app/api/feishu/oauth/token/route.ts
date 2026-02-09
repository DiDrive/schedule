import { NextRequest, NextResponse } from 'next/server';

// 飞书 OAuth 配置
const FEISHU_APP_ID = 'cli_a90f3ef5a393900b';
const FEISHU_APP_SECRET = 'RQGkC8vU4d2lL3K6Y9mN2pQ5rT8vW1zX';
const REDIRECT_URI = ''; // 会在运行时动态获取

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: '缺少授权码' },
        { status: 400 }
      );
    }

    // 构造请求 URL
    const baseUrl = request.nextUrl.origin;
    const redirectUri = `${baseUrl}/feishu-oauth-callback`;

    // 调用飞书 API 获取 access_token
    const tokenUrl = 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token';

    const requestBody = {
      grant_type: 'authorization_code',
      client_id: FEISHU_APP_ID,
      client_secret: FEISHU_APP_SECRET,
      code: code,
      redirect_uri: redirectUri,
    };

    console.log('[飞书 OAuth] 正在获取访问令牌...');
    console.log('[飞书 OAuth] 请求 URL:', tokenUrl);
    console.log('[飞书 OAuth] 重定向 URI:', redirectUri);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    console.log('[飞书 OAuth] 响应状态:', response.status);
    console.log('[飞书 OAuth] 响应数据:', JSON.stringify(data, null, 2));

    if (!response.ok || data.code !== 0) {
      throw new Error(data.msg || '获取访问令牌失败');
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });

  } catch (error) {
    console.error('[飞书 OAuth] 错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '授权失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
