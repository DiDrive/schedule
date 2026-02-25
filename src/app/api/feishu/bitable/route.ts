import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync('/app/work/logs/bypass/feishu-bitable.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

export async function GET(request: NextRequest) {
  try {
    // 从 URL 参数获取配置
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const tableId = searchParams.get('table_id');
    const pageSize = parseInt(searchParams.get('page_size') || '100', 10);
    const pageToken = searchParams.get('page_token') || '';

    if (!appToken || !tableId) {
      log('[飞书多维表] ❌ 缺少 app_token 或 table_id');
      return NextResponse.json(
        { error: '缺少 app_token 或 table_id' },
        { status: 400 }
      );
    }

    // 从请求头获取用户令牌
    const userAccessToken = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!userAccessToken) {
      log('[飞书多维表] ❌ 缺少用户访问令牌');
      return NextResponse.json(
        { error: '需要登录，请先完成飞书扫码登录' },
        { status: 401 }
      );
    }

    log(`[飞书多维表] 开始获取数据: app_token=${appToken.substring(0, 10)}..., table_id=${tableId.substring(0, 10)}...`);

    // 构建请求 URL
    let apiUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=${pageSize}`;
    if (pageToken) {
      apiUrl += `&page_token=${encodeURIComponent(pageToken)}`;
    }

    log(`[飞书多维表] 请求 URL: ${apiUrl}`);

    // 调用飞书 API
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    log(`[飞书多维表] 响应状态: ${response.status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      log(`[飞书多维表] ❌ JSON 解析失败: ${responseText.substring(0, 200)}`);
      throw new Error(`服务器返回无效的 JSON 格式`);
    }

    if (!response.ok) {
      log(`[飞书多维表] ❌ API 错误: code=${data.code}, msg=${data.msg}`);
      return NextResponse.json(
        { error: data.msg || '获取数据失败', code: data.code },
        { status: response.status }
      );
    }

    log(`[飞书多维表] ✅ 成功获取 ${data.data?.items?.length || 0} 条记录`);

    return NextResponse.json(data);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书多维表] ❌ 异常: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
