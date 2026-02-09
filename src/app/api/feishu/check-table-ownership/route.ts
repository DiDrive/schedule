import { NextRequest, NextResponse } from 'next/server';
import { initFeishuClient, getAccessToken } from '@/lib/feishu-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, appSecret, appToken, tableId } = body;

    if (!appId || !appSecret || !appToken || !tableId) {
      return NextResponse.json({
        success: false,
        error: '请提供 App ID、App Secret、App Token 和 Table ID',
      });
    }

    console.log('[飞书验证] 检查 Table ID 是否属于 App Token:', {
      appToken,
      tableId,
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

    // 获取 Access Token
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: '获取 Access Token 失败',
        step: 'getAccessToken',
      });
    }

    // 尝试读取 App 信息
    const appResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const appResponseText = await appResponse.text();
    console.log('[飞书验证] App 信息响应文本:', appResponseText);

    let appData;
    try {
      appData = JSON.parse(appResponseText);
    } catch (parseError) {
      console.error('[飞书验证] JSON 解析失败:', parseError);
      console.error('[飞书验证] 响应内容:', appResponseText);
      return NextResponse.json({
        success: false,
        error: '飞书 API 返回的数据格式不正确',
        rawResponse: appResponseText,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
      });
    }

    if (appData.code !== 0) {
      return NextResponse.json({
        success: false,
        error: appData.msg || '读取 App 信息失败',
        code: appData.code,
        step: 'getAppInfo',
      });
    }

    const tables = appData.data.app?.tables || [];
    const tableIds = tables.map((t: any) => t.table_id);

    console.log('[飞书验证] App Token 中的表格:', tableIds);

    // 检查 Table ID 是否在列表中
    const tableExists = tableIds.includes(tableId);

    if (tableExists) {
      return NextResponse.json({
        success: true,
        data: {
          exists: true,
          message: 'Table ID 属于该 App Token',
          appToken: appToken,
          tableId: tableId,
          tableInfo: tables.find((t: any) => t.table_id === tableId),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Table ID 不属于该 App Token',
        data: {
          exists: false,
          message: 'Table ID 不属于该 App Token',
          appToken: appToken,
          tableId: tableId,
          availableTableIds: tableIds,
        },
      });
    }
  } catch (error: any) {
    console.error('[飞书验证] 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      rawError: error.message,
    });
  }
}
