import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/feishu-client';
import { initFeishuClient } from '@/lib/feishu-client';
import { createFeishuRecord } from '@/lib/feishu-client';

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

    // 初始化飞书客户端
    initFeishuClient(config);

    // 查找第一个有 Table ID 的表格
    let targetTableId: string | null = null;
    let targetTableName: string = '';

    const tableNames: { [key: string]: string } = {
      resources: '人员表',
      projects: '项目表',
      tasks: '任务表',
      schedules: '排期表',
    };

    for (const [key, name] of Object.entries(tableNames)) {
      const tableId = config.tableIds[key as keyof typeof tableNames];
      if (tableId) {
        targetTableId = tableId;
        targetTableName = name;
        break;
      }
    }

    if (!targetTableId) {
      return NextResponse.json({
        success: false,
        error: '未找到可用的 Table ID，请先配置至少一个表格',
      });
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Access Token 获取失败',
      });
    }

    // 创建一条测试记录（会立即删除）
    const testData = {
      name: `测试记录_${Date.now()}`,
      description: '这是一条测试记录，将被自动删除',
    };

    const record = await createFeishuRecord(
      accessToken,
      config.appToken,
      targetTableId,
      testData
    );

    // 立即删除测试记录
    if (record.record?.record_id) {
      try {
        await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${targetTableId}/records/${record.record.record_id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        // 删除失败不影响结果
        console.warn('测试记录删除失败:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tableId: targetTableId,
        tableName: targetTableName,
        recordId: record.record?.record_id,
        testData,
        message: '测试记录创建成功并已删除',
      },
    });
  } catch (error: any) {
    // 尝试解析飞书API错误
    let feishuError = null;
    try {
      if (error.message) {
        const parsed = JSON.parse(error.message);
        if (parsed.code || parsed.msg) {
          feishuError = parsed;
        }
      }
    } catch (e) {
      // 忽略解析错误
    }

    return NextResponse.json({
      success: false,
      error: error.message,
      code: feishuError?.code,
      message: feishuError?.msg,
    });
  }
}
