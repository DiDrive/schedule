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

    console.log('[飞书验证] 验证 Table ID:', {
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

    // 测试读取表格信息
    console.log('[飞书验证] 测试读取表格信息...');
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    console.log('[飞书验证] 表格信息响应:', {
      code: data.code,
      msg: data.msg,
      hasData: !!data.data,
    });

    if (data.code !== 0) {
      return NextResponse.json({
        success: false,
        error: data.msg || '读取表格信息失败',
        code: data.code,
        step: 'getTableInfo',
        details: data,
      });
    }

    const table = data.data.table;
    console.log('[飞书验证] 表格信息获取成功:', {
      tableName: table?.name,
      fieldCount: table?.fields?.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        table: {
          name: table?.name,
          tableId: table?.table_id,
          revision: table?.revision,
        },
        fields: (table?.fields || []).map((f: any) => ({
          id: f.field_id,
          name: f.field_name,
          type: f.type,
          isPrimary: f.is_primary,
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
