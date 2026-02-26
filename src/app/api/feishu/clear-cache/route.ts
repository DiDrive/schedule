import { NextRequest, NextResponse } from 'next/server';
import { clearAccessTokenCache } from '@/lib/feishu-api';

export async function POST(request: NextRequest) {
  try {
    clearAccessTokenCache();
    return NextResponse.json({
      success: true,
      message: '令牌缓存已清除',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '清除缓存失败',
      },
      { status: 500 }
    );
  }
}
