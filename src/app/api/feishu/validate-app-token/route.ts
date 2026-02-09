import { NextRequest, NextResponse } from 'next/server';
import { initFeishuClient, getAccessToken } from '@/lib/feishu-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, appSecret, appToken } = body;

    if (!appId || !appSecret || !appToken) {
      return NextResponse.json({
        success: false,
        error: '请提供 App ID、App Secret 和 App Token',
      });
    }

    console.log('[飞书验证] 验证 App Token:', {
      appId,
      appToken,
    });

    // 初始化飞书客户端
    initFeishuClient({
      appId,
      appSecret,
      appToken,
      tableIds: {
        resources: '',
        projects: '',
        tasks: '',
        schedules: '',
      },
    });

    // 测试获取 Access Token
    console.log('[飞书验证] 获取 Access Token...');
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: '获取 Access Token 失败',
        step: 'getAccessToken',
      });
    }

    console.log('[飞书验证] Access Token 获取成功');

    // 测试读取 App 信息
    console.log('[飞书验证] 测试读取 App 信息...');
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const responseText = await response.text();
    console.log('[飞书验证] App 信息响应文本:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[飞书验证] JSON 解析失败:', parseError);
      console.error('[飞书验证] 响应内容:', responseText);
      return NextResponse.json({
        success: false,
        error: '飞书 API 返回的数据格式不正确',
        rawResponse: responseText,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
      });
    }

    console.log('[飞书验证] App 信息响应:', {
      code: data.code,
      msg: data.msg,
      hasData: !!data.data,
    });

    if (data.code !== 0) {
      return NextResponse.json({
        success: false,
        error: data.msg || '读取 App 信息失败',
        code: data.code,
        step: 'getAppInfo',
        details: data,
      });
    }

    const app = data.data.app;
    const tables = app?.tables || [];

    console.log('[飞书验证] App 信息获取成功:', {
      appName: app?.name,
      tableCount: tables.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        app: {
          name: app?.name,
          appToken: app?.app_token,
          url: app?.url,
        },
        tables: tables.map((t: any) => ({
          id: t.table_id,
          name: t.name,
          revision: t.revision,
        })),
      },
    });
  } catch (error: any) {
    console.error('[飞书验证] 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      rawError: error.message,
    });
  }
}
