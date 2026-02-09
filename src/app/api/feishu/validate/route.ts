import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/feishu-client';
import { initFeishuClient } from '@/lib/feishu-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json({
        success: false,
        error: '配置未找到',
      });
    }

    // 初始化飞书客户端
    initFeishuClient(config);

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Access Token 获取失败',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        access_token: accessToken,
        // Access Token 默认有效期 2 小时
        expire: 7200,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
