import { NextRequest, NextResponse } from 'next/server';
import { getFeishuConfig } from '@/lib/feishu-client';

export async function GET() {
  try {
    const config = getFeishuConfig();

    if (!config) {
      return NextResponse.json({
        success: false,
        error: '配置未找到',
      });
    }

    // 检查必要字段
    const requiredFields = ['appId', 'appSecret', 'appToken'];
    const missingFields = requiredFields.filter(field => !config[field as keyof typeof config]);

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
