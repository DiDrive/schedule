import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

/**
 * 检查飞书表的字段信息
 *
 * 请求参数：
 * - app_id: 飞书应用 ID
 * - app_secret: 飞书应用密钥
 * - app_token: 多维表 App Token
 * - table_id: 表格 ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const tableId = searchParams.get('table_id');

    if (!appId || !appSecret || !appToken || !tableId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const appAccessToken = await getAppAccessToken(appId, appSecret);

    // 获取表格信息
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}`,
      {
        headers: {
          'Authorization': `Bearer ${appAccessToken}`,
        },
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      return NextResponse.json(
        { error: data.msg, code: data.code },
        { status: 400 }
      );
    }

    // 提取字段信息
    const fields = data.data.fields || [];
    const fieldInfo = fields.map((field: any) => ({
      name: field.field_name,
      type: field.type,
      description: field.description || '',
    }));

    return NextResponse.json({
      success: true,
      table: {
        id: tableId,
        name: data.data.name,
      },
      fields: fieldInfo,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
