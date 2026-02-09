import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/feishu-client';
import { initFeishuClient } from '@/lib/feishu-client';
import { listFeishuRecords } from '@/lib/feishu-client';

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

    console.log('[飞书测试] 测试读取记录:', {
      appToken: config.appToken,
      tableId: targetTableId,
      tableName: targetTableName,
    });

    // 测试读取记录
    const records = await listFeishuRecords(config.appToken, targetTableId, { pageSize: 1 });

    console.log('[飞书测试] 读取记录成功:', {
      recordCount: records.total,
      hasRecords: records.items && records.items.length > 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        tableId: targetTableId,
        tableName: targetTableName,
        recordCount: records.total,
        hasRecords: records.items && records.items.length > 0,
        sampleRecord: records.items && records.items.length > 0 ? records.items[0] : null,
      },
    });
  } catch (error: any) {
    console.error('[飞书测试] 读取记录失败:', error);

    // 尝试解析飞书API错误
    let feishuError = null;
    try {
      if (error.message) {
        // 检查是否是 JSON 格式的错误
        if (error.message.startsWith('{')) {
          const parsed = JSON.parse(error.message);
          if (parsed.code || parsed.msg) {
            feishuError = parsed;
          }
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
      rawError: error.message,
    });
  }
}
