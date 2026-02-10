import { NextRequest, NextResponse } from 'next/server';
import { setUserAccessToken } from '@/lib/feishu-client';

export async function GET(request: NextRequest) {
  try {
    // 从 Cookie 或 Header 获取用户令牌
    const userToken = request.cookies.get('feishu-user-token')?.value ||
                     request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!userToken) {
      return NextResponse.json({
        code: 401,
        msg: '用户未登录，请先使用飞书扫码登录',
        data: null
      }, { status: 401 });
    }

    // 设置用户令牌到客户端
    setUserAccessToken(userToken);

    // 调用飞书 API 获取用户可见的多维表应用列表
    const response = await fetch(
      'https://open.feishu.cn/open-apis/bitable/v1/apps?page_size=50',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      return NextResponse.json({
        code: data.code,
        msg: `获取多维表列表失败: ${data.msg}`,
        data: null
      }, { status: 400 });
    }

    // 返回应用列表
    return NextResponse.json({
      code: 0,
      msg: 'success',
      data: {
        items: data.data?.items || [],
        total: data.data?.total || 0,
        has_more: data.data?.has_more || false
      }
    });

  } catch (error: any) {
    console.error('[飞书多维表列表] 错误:', error);
    return NextResponse.json({
      code: 500,
      msg: error.message || '服务器错误',
      data: null
    }, { status: 500 });
  }
}
