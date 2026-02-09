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

    // 测试读取 App 信息
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      return NextResponse.json({
        success: false,
        code: data.code,
        message: data.msg || '读取 App 信息失败',
        error: data,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        appToken: config.appToken,
        app: data.data.app,
        tableCount: data.data.app?.tables?.length || 0,
        tables: data.data.app?.tables?.map((t: any) => ({
          id: t.table_id,
          name: t.name,
        })) || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
