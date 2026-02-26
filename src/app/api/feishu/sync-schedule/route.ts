import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-sync.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

/**
 * 同步排期结果到飞书多维表
 *
 * 请求参数（通过 URL 传递）:
 * - app_token: 多维表格 App Token
 * - schedules_table_id: 排期表 Table ID
 *
 * 请求体:
 * - tasks: 任务列表（包含排期信息）
 * - startDate: 项目开始日期
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');

    if (!appToken || !schedulesTableId) {
      log('[飞书同步] ❌ 缺少 app_token 或 schedules_table_id');
      return NextResponse.json(
        { error: '缺少 app_token 或 schedules_table_id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tasks, startDate } = body;

    if (!tasks || !Array.isArray(tasks)) {
      log('[飞书同步] ❌ 请求体缺少 tasks 或格式不正确');
      return NextResponse.json(
        { error: '请求体必须包含 tasks 数组' },
        { status: 400 }
      );
    }

    const appAccessToken = await getAppAccessToken();
    log(`[飞书同步] 开始同步排期结果: app_token=${appToken.substring(0, 10)}..., table_id=${schedulesTableId.substring(0, 10)}...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 先清空现有的排期记录
    try {
      const listResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 500 }),
        }
      );

      const listData = await listResponse.json();
      if (listData.code === 0 && listData.data && listData.data.items.length > 0) {
        log(`[飞书同步] 清空 ${listData.data.items.length} 条旧排期记录`);

        // 删除所有旧记录
        for (const item of listData.data.items) {
          await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/${item.record_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
        }
      }
    } catch (error) {
      log(`[飞书同步] ⚠️ 清空旧记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 同步每个任务的排期信息
    for (const task of tasks) {
      try {
        const scheduleRecord = {
          fields: {
            taskName: task.name || task['任务名称'] || '',
            taskId: task.id || task['任务ID'] || '',
            resourceName: task.assignedResourceName || task['负责人'] || '',
            resourceId: task.assignedResourceId || task['负责人ID'] || '',
            plannedStartDate: task.plannedStartDate || task['计划开始日期'] || '',
            plannedEndDate: task.plannedEndDate || task['计划结束日期'] || '',
            plannedHours: task.plannedHours || task['计划工时'] || 0,
            status: task.status || task['状态'] || 'pending',
            priority: task.priority || task['优先级'] || 'medium',
          },
        };

        const response = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(scheduleRecord),
          }
        );

        const data = await response.json();

        if (data.code === 0) {
          successCount++;
          log(`[飞书同步] ✅ 同步任务成功: ${task.name}`);
        } else {
          errorCount++;
          errors.push(`任务 "${task.name}" 同步失败: ${data.msg}`);
          log(`[飞书同步] ❌ 同步任务失败: ${task.name}, 错误: ${data.msg}`);
        }
      } catch (error) {
        errorCount++;
        errors.push(`任务 "${task.name}" 同步异常: ${error instanceof Error ? error.message : '未知错误'}`);
        log(`[飞书同步] ❌ 同步任务异常: ${task.name}, 错误: ${error}`);
      }
    }

    log(`[飞书同步] ✅ 同步完成: 成功 ${successCount}, 失败 ${errorCount}`);

    return NextResponse.json({
      success: true,
      stats: {
        success: successCount,
        error: errorCount,
      },
      errors,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书同步] ❌ 异常: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
