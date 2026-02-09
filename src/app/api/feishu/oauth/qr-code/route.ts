import { NextRequest, NextResponse } from 'next/server';

// 飞书 OAuth 配置
const FEISHU_APP_ID = 'cli_a90f3ef5a393900b';
const FEISHU_APP_SECRET = 'RQGkC8vU4d2lL3K6Y9mN2pQ5rT8vW1zX';

export async function POST(request: NextRequest) {
  try {
    // 获取应用令牌
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.code !== 0) {
      throw new Error(`获取应用令牌失败: ${tokenData.msg}`);
    }

    const tenantAccessToken = tokenData.tenant_access_token;

    console.log('[飞书 OAuth] 应用令牌获取成功');

    // 生成扫码登录二维码
    const qrCodeResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/qr_code/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        width: 430,
      }),
    });

    const qrCodeData = await qrCodeResponse.json();

    console.log('[飞书 OAuth] 二维码生成响应:', JSON.stringify(qrCodeData, null, 2));

    if (qrCodeData.code !== 0) {
      throw new Error(`生成二维码失败: ${qrCodeData.msg}`);
    }

    return NextResponse.json({
      success: true,
      qr_code_url: qrCodeData.qr_code_url,
      qr_code_ticket: qrCodeData.qr_code_ticket,
      qr_code_key: qrCodeData.qr_code_key,
    });

  } catch (error) {
    console.error('[飞书 OAuth] 错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '生成二维码失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
