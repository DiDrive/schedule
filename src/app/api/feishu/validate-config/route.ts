import { NextResponse } from 'next/server';

/**
 * 测试 API - 用于验证配置保存和读取
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json({
        success: false,
        error: '配置未提供',
      });
    }

    // 验证配置结构
    const requiredFields = ['appId', 'appSecret', 'appToken'];
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `配置不完整，缺少字段: ${missingFields.join(', ')}`,
        missingFields,
      });
    }

    // 验证 App ID 格式
    if (!config.appId.startsWith('cli_')) {
      return NextResponse.json({
        success: false,
        error: 'App ID 格式不正确，应以 "cli_" 开头',
      });
    }

    // 验证 App Secret 长度
    if (config.appSecret.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'App Secret 长度不足',
      });
    }

    // 验证 App Token
    if (config.appToken.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'App Token 长度不足',
      });
    }

    // 返回验证结果
    return NextResponse.json({
      success: true,
      message: '配置验证通过',
      data: {
        appId: `${config.appId.substring(0, 8)}...`,
        appSecret: `${config.appSecret.substring(0, 8)}...`,
        appToken: config.appToken,
        tableCount: config.tableIds ? Object.keys(config.tableIds).filter(k => config.tableIds[k]).length : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
