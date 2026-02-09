import { NextRequest, NextResponse } from 'next/server';

// 飞书 OAuth 配置
const FEISHU_APP_ID = 'cli_a90f3ef5a393900b';
const FEISHU_APP_SECRET = 'RQGkC8vU4d2lL3K6Y9mN2pQ5rT8vW1zX';

export async function POST(request: NextRequest) {
  try {
    const { ticket } = await request.json();

    if (!ticket) {
      return NextResponse.json(
        { error: '缺少 ticket 参数' },
        { status: 400 }
      );
    }

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

    // 查询扫码状态
    const statusResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/qr_code/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket: ticket,
      }),
    });

    const statusData = await statusResponse.json();

    console.log('[飞书 OAuth] 扫码状态:', statusData.data?.status);

    if (statusData.code !== 0) {
      throw new Error(`查询扫码状态失败: ${statusData.msg}`);
    }

    const status = statusData.data?.status;

    if (status === 'WaitingForConfirm') {
      // 等待确认
      return NextResponse.json({ status: 'waiting' });
    } else if (status === 'WaitingForScan') {
      // 等待扫码
      return NextResponse.json({ status: 'waiting_scan' });
    } else if (status === 'Confirmed') {
      // 已确认，需要获取用户信息
      const userAccessToken = statusData.data?.user_access_token;

      if (!userAccessToken) {
        throw new Error('未获取到用户访问令牌');
      }

      // 获取用户信息
      const userInfoResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const userInfoData = await userInfoResponse.json();

      if (userInfoData.code !== 0) {
        throw new Error(`获取用户信息失败: ${userInfoData.msg}`);
      }

      console.log('[飞书 OAuth] 用户信息获取成功:', userInfoData.data.name);

      return NextResponse.json({
        status: 'success',
        access_token: userAccessToken,
        user_info: userInfoData.data,
      });
    } else if (status === 'Expired') {
      // 二维码过期
      return NextResponse.json({ status: 'expired' });
    } else if (status === 'Canceled') {
      // 用户取消
      return NextResponse.json({ status: 'canceled' });
    } else {
      // 未知状态
      return NextResponse.json({ status: 'unknown', raw: statusData });
    }

  } catch (error) {
    console.error('[飞书 OAuth] 错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '查询扫码状态失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
