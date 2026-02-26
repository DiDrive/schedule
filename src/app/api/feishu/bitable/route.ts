import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-bitable.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

// 处理 GET 请求（向后兼容，但推荐使用 POST）
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: '请使用 POST 方法查询记录。POST 请求体示例：{ "page_size": 100 }' },
    { status: 400 }
  );
}

// 处理 POST 请求（官方推荐方式）
export async function POST(request: NextRequest) {
  try {
    // 从 URL 参数获取配置
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const tableId = searchParams.get('table_id');

    if (!appToken || !tableId) {
      log('[飞书多维表] ❌ 缺少 app_token 或 table_id');
      return NextResponse.json(
        { error: '缺少 app_token 或 table_id' },
        { status: 400 }
      );
    }

    // 获取应用访问令牌
    const appAccessToken = await getAppAccessToken();

    // 获取请求体（可选，用于筛选、排序等）
    let requestBody = {};
    try {
      requestBody = await request.json().catch(() => ({}));
    } catch (e) {
      requestBody = {};
    }

    log(`[飞书多维表] 开始查询: app_token=${appToken.substring(0, 10)}..., table_id=${tableId.substring(0, 10)}...`);

    // 构建请求 URL - 使用官方推荐的 search 接口
    const apiUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`;

    log(`[飞书多维表] 请求 URL: ${apiUrl}`);
    log(`[飞书多维表] 请求体: ${JSON.stringify(requestBody)}`);

    // 调用飞书 API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 100,
        ...requestBody,
      }),
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

    log(`[飞书多维表] ✅ 成功获取 ${data.data?.items?.length || 0} 条记录，总计 ${data.data?.total || 0} 条`);

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
