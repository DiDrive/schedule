import { NextRequest, NextResponse } from 'next/server';

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

    // 检查必要字段
    const requiredFields = ['appId', 'appSecret', 'appToken'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `配置不完整，缺少字段: ${missingFields.join(', ')}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        appId: config.appId,
        appSecret: config.appSecret,
        appToken: config.appToken,
        tableIds: config.tableIds,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}

// GET 方法用于检查前端是否有配置
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '请使用 POST 方法发送配置',
  });
}
