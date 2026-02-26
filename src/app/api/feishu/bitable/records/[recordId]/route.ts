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

// 处理 PUT 请求 - 更新记录
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params;

    // 从 URL 参数获取配置
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const tableId = searchParams.get('table_id');

    if (!appToken || !tableId || !recordId) {
      log('[飞书多维表] ❌ 缺少 app_token、table_id 或 record_id');
      return NextResponse.json(
        { error: '缺少 app_token、table_id 或 record_id' },
        { status: 400 }
      );
    }

    // 获取应用访问令牌
    const appAccessToken = await getAppAccessToken();

    // 获取请求体（fields 字段是必需的）
    const requestBody = await request.json();

    if (!requestBody.fields || typeof requestBody.fields !== 'object') {
      log('[飞书多维表] ❌ 请求体缺少 fields 字段或格式不正确');
      return NextResponse.json(
        { error: '请求体必须包含 fields 字段' },
        { status: 400 }
      );
    }

    log(`[飞书多维表] 开始更新记录: app_token=${appToken.substring(0, 10)}..., table_id=${tableId.substring(0, 10)}..., record_id=${recordId}`);
    log(`[飞书多维表] 更新数据: ${JSON.stringify(requestBody.fields)}`);

    // 构建请求 URL
    const apiUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;

    log(`[飞书多维表] 请求 URL: ${apiUrl}`);

    // 调用飞书 API
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${appAccessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody),
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
        { error: data.msg || '更新记录失败', code: data.code },
        { status: response.status }
      );
    }

    log(`[飞书多维表] ✅ 成功更新记录`);

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

// 处理 DELETE 请求 - 删除记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params;

    // 从 URL 参数获取配置
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const tableId = searchParams.get('table_id');

    if (!appToken || !tableId || !recordId) {
      log('[飞书多维表] ❌ 缺少 app_token、table_id 或 record_id');
      return NextResponse.json(
        { error: '缺少 app_token、table_id 或 record_id' },
        { status: 400 }
      );
    }

    // 获取应用访问令牌
    const appAccessToken = await getAppAccessToken();

    log(`[飞书多维表] 开始删除记录: app_token=${appToken.substring(0, 10)}..., table_id=${tableId.substring(0, 10)}..., record_id=${recordId}`);

    // 构建请求 URL
    const apiUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`;

    log(`[飞书多维表] 请求 URL: ${apiUrl}`);

    // 调用飞书 API
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${appAccessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
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
        { error: data.msg || '删除记录失败', code: data.code },
        { status: response.status }
      );
    }

    log(`[飞书多维表] ✅ 成功删除记录`);

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
