import { NextRequest, NextResponse } from 'next/server';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-api.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

/**
 * 测试飞书连接配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, appSecret, appToken } = body;

    if (!appId || !appSecret || !appToken) {
      log('[飞书连接测试] ❌ 缺少必要参数');
      return NextResponse.json(
        { success: false, error: '缺少 appId、appSecret 或 appToken' },
        { status: 400 }
      );
    }

    log(`[飞书连接测试] 开始测试: app_id=${appId.substring(0, 10)}..., app_token=${appToken.substring(0, 10)}...`);

    // 步骤 1：获取 app_access_token
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.code !== 0) {
      log(`[飞书连接测试] ❌ 获取 app_access_token 失败: ${tokenData.msg}`);
      return NextResponse.json(
        {
          success: false,
          error: `获取应用访问令牌失败: ${tokenData.msg}`,
          code: tokenData.code,
        },
        { status: 400 }
      );
    }

    log('[飞书连接测试] ✅ 成功获取 app_access_token');

    const appAccessToken = tokenData.app_access_token;

    // 步骤 2：测试访问多维表
    const tableResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${appAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const tableData = await tableResponse.json();

    if (tableData.code !== 0) {
      log(`[飞书连接测试] ❌ 访问多维表失败: ${tableData.msg}`);
      return NextResponse.json(
        {
          success: false,
          error: `访问多维表失败: ${tableData.msg}`,
          code: tableData.code,
        },
        { status: 400 }
      );
    }

    log(`[飞书连接测试] ✅ 成功访问多维表，发现 ${tableData.data?.items?.length || 0} 个数据表`);

    return NextResponse.json({
      success: true,
      message: '连接成功',
      data: {
        tables: tableData.data?.items?.length || 0,
        tableNames: tableData.data?.items?.map((t: any) => t.name) || [],
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书连接测试] ❌ 异常: ${errorMessage}`);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
