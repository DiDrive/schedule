import { NextRequest, NextResponse } from 'next/server';

// 测试使用用户令牌读取表格
export async function POST(request: NextRequest) {
  try {
    const { appToken, tableId } = await request.json();

    // 从 localStorage 读取用户令牌（前端传递）
    const userToken = request.headers.get('x-feishu-user-token');

    if (!userToken) {
      return NextResponse.json(
        { error: '未找到用户令牌，请先使用飞书登录' },
        { status: 401 }
      );
    }

    if (!appToken || !tableId) {
      return NextResponse.json(
        { error: '缺少 appToken 或 tableId' },
        { status: 400 }
      );
    }

    console.log('[飞书用户令牌] 正在读取表格记录...');
    console.log('[飞书用户令牌] App Token:', appToken);
    console.log('[飞书用户令牌] Table ID:', tableId);

    // 构造请求 URL
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;

    // 使用用户令牌读取记录
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    console.log('[飞书用户令牌] 响应状态:', response.status);
    console.log('[飞书用户令牌] 响应数据:', JSON.stringify(data, null, 2));

    if (!response.ok || data.code !== 0) {
      throw new Error(data.msg || '读取表格失败');
    }

    return NextResponse.json({
      success: true,
      data: {
        total: data.data.total,
        records: data.data.items?.slice(0, 5) || [], // 只返回前 5 条记录
      },
    });

  } catch (error) {
    console.error('[飞书用户令牌] 错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '读取表格失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
