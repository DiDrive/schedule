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

// 状态映射函数：系统状态 -> 飞书状态
function mapStatusToFeishu(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待处理',
    'in-progress': '进行中',
    'completed': '已完成',
    'blocked': '阻塞',
  };
  return statusMap[status] || '待处理';
}

/**
 * 同步排期结果到飞书多维表
 *
 * 请求参数（通过 URL 传递）:
 * - app_id: 飞书应用 ID
 * - app_secret: 飞书应用密钥
 * - app_token: 多维表格 App Token
 * - schedules_table_id: 排期表 Table ID
 * - data_source_mode: 数据源模式 (traditional | requirement)
 * - requirement_table_id: 需求表 ID（需求表模式下使用）
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
    const dataSourceMode = searchParams.get('data_source_mode') || 'traditional';
    const requirementTableId = searchParams.get('requirement_table_id');

    if (!appId || !appSecret) {
      log('[飞书同步] ❌ 缺少 app_id 或 app_secret');
      return NextResponse.json(
        { error: '缺少 app_id 或 app_secret' },
        { status: 400 }
      );
    }

    if (!appToken) {
      log('[飞书同步] ❌ 缺少 app_token');
      return NextResponse.json(
        { error: '缺少 app_token' },
        { status: 400 }
      );
    }

    // 根据数据源模式判断需要的 table_id
    const isRequirementMode = dataSourceMode === 'requirement';
    const targetTableId = isRequirementMode ? requirementTableId : schedulesTableId;

    if (!targetTableId) {
      log('[飞书同步] ❌ 缺少目标表格 ID');
      return NextResponse.json(
        { error: '缺少目标表格 ID' },
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
    log(`[飞书同步] 开始同步排期结果: mode=${dataSourceMode}, app_token=${appToken.substring(0, 10)}..., table_id=${targetTableId.substring(0, 10)}...`);
    log(`[飞书同步] 待同步任务数: ${tasks.length}`);

    // 创建资源ID到飞书人员ID的映射表
    // 需要先从人员表加载资源数据，获取 feishuPersonId
    let resourceIdToFeishuPersonIdMap = new Map<string, string>();
    try {
      const resourcesTableId = searchParams.get('resources_table_id');
      if (resourcesTableId) {
        const resourcesResponse = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${resourcesTableId}/records/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 100 }),
          }
        );

        const resourcesData = await resourcesResponse.json();
        if (resourcesData.code === 0 && resourcesData.data) {
          const {
            parseStringField,
            parsePersonId,
          } = require('@/lib/feishu-field-parser');

          resourcesData.data.items.forEach((item: any) => {
            const fields = item.fields;
            const resourceId = parseStringField(fields['人员ID'] || fields['id'] || fields['ID']) || `res_${item.record_id.substring(0, 8)}`;
            const feishuPersonId = parsePersonId(fields['姓名'] || fields['name'] || fields['人员']);

            if (resourceId && feishuPersonId) {
              resourceIdToFeishuPersonIdMap.set(resourceId, feishuPersonId);
              log(`[飞书同步] 映射资源: ${resourceId} -> ${feishuPersonId}`);
            }
          });
          log(`[飞书同步] ✅ 加载了 ${resourceIdToFeishuPersonIdMap.size} 个资源映射`);
        }
      }
    } catch (error) {
      log(`[飞书同步] ⚠️ 加载资源映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 清空现有的排期记录（仅在传统模式下）
    if (!isRequirementMode) {
      try {
        const listResponse = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/search`,
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
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/${item.record_id}`,
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
    } // end if (!isRequirementMode)

    // 同步每个任务的排期信息
    for (const task of tasks) {
      try {
        // 将资源ID映射回飞书人员ID
        const feishuPersonId = task.assignedResourceId ? resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || task.assignedResourceId : '';

        // 准备排期记录数据
        // 字段名需要与飞书多维表的字段名一致
        const scheduleRecord: any = {
          fields: {
            // 任务名称（文本型）：可以写入
            '任务名称': task.name || '',

            // 任务类型（单选/关联型）
            '任务类型': task.taskType || '',

            // 负责人（成员型）：传人员的 open_id
            '负责人': feishuPersonId ? [{ id: feishuPersonId }] : [],

            // 开始时间（日期时间型）：传时间戳（毫秒）
            '开始时间': task.startDate ? Math.floor(new Date(task.startDate).getTime() / 1000) * 1000 : 0,

            // 结束时间（日期时间型）：传时间戳（毫秒）
            '结束时间': task.endDate ? Math.floor(new Date(task.endDate).getTime() / 1000) * 1000 : 0,

            // 预估工时（数值型）：传数字
            '预估工时': task.estimatedHours || 0,

            // 平面工时和后期工时
            '平面工时': task.estimatedHoursGraphic || 0,
            '后期工时': task.estimatedHoursPost || 0,

            // 子任务依赖模式
            '子任务依赖': task.subTaskDependencyMode === 'serial' ? '串行' : '并行',

            // 状态（单选型）：映射为中文
            '状态': mapStatusToFeishu(task.status || 'pending'),
          },
        };

        // 如果有截止日期，添加该字段
        if (task.deadline) {
          scheduleRecord.fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
        }

        // 如果有建议截止日期（从排期算法计算得出），添加该字段
        if (task.suggestedDeadline) {
          scheduleRecord.fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
        }

        // 如果有项目名称，添加该字段
        if (task.projectName) {
          scheduleRecord.fields['所属项目'] = task.projectName;
        }

        log(`[飞书同步] 同步任务: ${task.name}`);
        log(`[飞书同步]   - 任务名称: ${task.name || '(无)'}`);
        log(`[飞书同步]   - 系统资源ID: ${task.assignedResourceId || '(无)'}`);
        log(`[飞书同步]   - 飞书人员ID: ${feishuPersonId || '(无)'}`);
        log(`[飞书同步]   - 负责人名称: ${task.assignedResourceName || '(无)'}`);
        log(`[飞书同步]   - 任务类型: ${task.taskType || '(无)'}`);
        log(`[飞书同步]   - 状态: ${task.status || 'pending'} -> ${mapStatusToFeishu(task.status || 'pending')}`);
        log(`[飞书同步]   - 开始时间: ${task.startDate || '(无)'}`);
        log(`[飞书同步]   - 结束时间: ${task.endDate || '(无)'}`);
        log(`[飞书同步]   - 预估工时: ${task.estimatedHours || 0}`);
        log(`[飞书同步]   - 建议截止日期: ${task.suggestedDeadline || '(无)'}`);
        log(`[飞书同步]   - 记录数据: ${JSON.stringify(scheduleRecord)}`);

        // 根据模式选择同步方式
        let response;
        if (isRequirementMode && task.feishuRecordId) {
          // 需求表模式：更新现有记录
          response = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/${task.feishuRecordId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(scheduleRecord),
            }
          );
        } else {
          // 传统模式：创建新记录
          response = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(scheduleRecord),
            }
          );
        }

        const data = await response.json();

        log(`[飞书同步] API响应: ${JSON.stringify(data)}`);

        if (data.code === 0) {
          successCount++;
          log(`[飞书同步] ✅ 同步任务成功: ${task.name}`);
        } else {
          errorCount++;
          const errorMsg = `任务 "${task.name}" 同步失败: ${data.msg} (code: ${data.code})`;
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
