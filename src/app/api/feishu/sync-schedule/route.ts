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
 * - app_id: 飞书应用 ID
 * - app_secret: 飞书应用密钥
 * - app_token: 多维表格 App Token
 * - schedules_table_id: 排期表 Table ID
 *
 * 请求体:
 * - tasks: 任务列表（包含排期信息）
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');

    if (!appId || !appSecret) {
      log('[飞书同步] ❌ 缺少 app_id 或 app_secret');
      return NextResponse.json(
        { error: '缺少 app_id 或 app_secret' },
        { status: 400 }
      );
    }

    if (!appToken || !schedulesTableId) {
      log('[飞书同步] ❌ 缺少 app_token 或 schedules_table_id');
      return NextResponse.json(
        { error: '缺少 app_token 或 schedules_table_id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks)) {
      log('[飞书同步] ❌ 请求体缺少 tasks 或格式不正确');
      return NextResponse.json(
        { error: '请求体必须包含 tasks 数组' },
        { status: 400 }
      );
    }

    const appAccessToken = await getAppAccessToken(appId, appSecret);
    log(`[飞书同步] 开始同步排期结果: app_token=${appToken.substring(0, 10)}..., table_id=${schedulesTableId.substring(0, 10)}...`);
    log(`[飞书同步] 待同步任务数: ${tasks.length}`);

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
        log(`[飞书同步] ✅ 清空完成`);
      }
    } catch (error) {
      log(`[飞书同步] ⚠️ 清空旧记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // 同步每个任务的排期信息
    for (const task of tasks) {
      try {
        // 准备排期记录数据
        // 字段名需要与飞书多维表的字段名一致
        const scheduleRecord = {
          fields: {
            // 任务基本信息
            '任务名称': task.name || '',
            '任务ID': task.id || '',
            '项目名称': task.projectName || '',

            // 负责人信息
            '负责人ID': task.assignedResourceId || '',
            '负责人': task.assignedResourceName || '',

            // 排期时间信息（使用时间戳）
            '计划开始时间': task.startDate ? new Date(task.startDate).getTime() : 0,
            '计划结束时间': task.endDate ? new Date(task.endDate).getTime() : 0,

            // 工时信息
            '预估工时': task.estimatedHours || 0,

            // 状态和优先级
            '状态': task.status || 'pending',
            '优先级': task.priority || 'normal',

            // 其他信息
            '任务类型': task.taskType || '',
          },
        };

        log(`[飞书同步] 同步任务: ${task.name}, 负责人: ${task.assignedResourceName}, 开始时间: ${task.startDate}`);

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
          const errorMsg = `任务 "${task.name}" 同步失败: ${data.msg}`;
          errors.push(errorMsg);
          log(`[飞书同步] ❌ ${errorMsg}`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `任务 "${task.name}" 同步异常: ${error instanceof Error ? error.message : '未知错误'}`;
        errors.push(errorMsg);
        log(`[飞书同步] ❌ ${errorMsg}`);
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
