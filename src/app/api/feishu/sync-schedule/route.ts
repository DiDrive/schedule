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
    'to-confirm': '待确认',
  };
  return statusMap[status] || '待处理';
}

// 带超时的 fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 批量删除记录（每批最多500条，带重试）
async function batchDeleteRecords(
  appToken: string,
  tableId: string,
  appAccessToken: string,
  recordIds: string[]
): Promise<{ success: number; failed: number }> {
  const batchSize = 500;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    try {
      const response = await fetchWithTimeout(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: batch }),
        },
        30000
      );
      const data = await response.json();
      if (data.code === 0) {
        success += batch.length;
        log(`[飞书同步] 批量删除成功: ${batch.length} 条`);
      } else {
        failed += batch.length;
        log(`[飞书同步] ⚠️ 批量删除失败: ${data.msg}`);
      }
    } catch (error) {
      failed += batch.length;
      log(`[飞书同步] ⚠️ 批量删除异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  return { success, failed };
}

// 批量创建记录（每批最多500条，带重试）
async function batchCreateRecords(
  appToken: string,
  tableId: string,
  appAccessToken: string,
  records: any[]
): Promise<{ success: number; failed: number }> {
  const batchSize = 500;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      log(`[飞书同步] 正在创建第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 条记录`);
      
      const response = await fetchWithTimeout(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records: batch }),
        },
        60000 // 增加超时时间到60秒
      );
      const data = await response.json();
      if (data.code === 0 && data.data?.records) {
        success += data.data.records.length;
        log(`[飞书同步] 批量创建成功: ${data.data.records.length} 条`);
      } else {
        failed += batch.length;
        log(`[飞书同步] ⚠️ 批量创建失败: ${data.msg}, code: ${data.code}`);
      }
    } catch (error) {
      failed += batch.length;
      log(`[飞书同步] ⚠️ 批量创建异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  return { success, failed };
}

/**
 * 同步排期结果到飞书多维表
 * 优化版本：使用批量 API，增加超时处理
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');
    const dataSourceMode = searchParams.get('data_source_mode') || 'legacy';
    const requirementTableId = searchParams.get('requirement_table_id');

    log(`[飞书同步] ========== 开始同步 ==========`);
    log(`[飞书同步] 参数: appId=${appId?.substring(0, 8)}..., appToken=${appToken?.substring(0, 8)}...`);
    log(`[飞书同步] 数据源模式: ${dataSourceMode}`);
    log(`[飞书同步] 排期表ID: ${schedulesTableId?.substring(0, 8)}...`);

    if (!appId || !appSecret) {
      return NextResponse.json({ success: false, error: '缺少 app_id 或 app_secret' }, { status: 400 });
    }

    if (!appToken) {
      return NextResponse.json({ success: false, error: '缺少 app_token' }, { status: 400 });
    }

    // 判断是否为需求表模式
    const isRequirementMode = dataSourceMode === 'new' || dataSourceMode === 'requirement';
    const targetTableId = isRequirementMode ? (requirementTableId || schedulesTableId) : schedulesTableId;

    if (!targetTableId) {
      return NextResponse.json({ success: false, error: '缺少目标表格 ID' }, { status: 400 });
    }

    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      log(`[飞书同步] 没有任务需要同步`);
      return NextResponse.json({ 
        success: true, 
        stats: { success: 0, error: 0 },
        message: '没有任务需要同步'
      });
    }

    log(`[飞书同步] 待同步任务数: ${tasks.length}`);

    // 获取 access token
    let appAccessToken: string;
    try {
      appAccessToken = await getAppAccessToken(appId, appSecret);
      log(`[飞书同步] 获取 access token 成功`);
    } catch (error) {
      log(`[飞书同步] 获取 access token 失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return NextResponse.json({ 
        success: false, 
        error: `获取飞书访问令牌失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }, { status: 500 });
    }

    // 创建资源ID到飞书人员ID的映射表
    const resourceIdToFeishuPersonIdMap = new Map<string, string>();
    const resourcesTableId = searchParams.get('resources_table_id');
    
    if (resourcesTableId) {
      try {
        log(`[飞书同步] 正在加载人员映射...`);
        const resourcesResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${resourcesTableId}/records/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 500 }),
          },
          30000
        );

        const resourcesData = await resourcesResponse.json();
        if (resourcesData.code === 0 && resourcesData.data) {
          const { parseStringField, parsePersonId } = require('@/lib/feishu-field-parser');

          resourcesData.data.items.forEach((item: any) => {
            const fields = item.fields;
            const resourceId = parseStringField(fields['人员ID'] || fields['id'] || fields['ID']) || `res_${item.record_id.substring(0, 8)}`;
            const feishuPersonId = parsePersonId(fields['姓名'] || fields['name'] || fields['人员']);

            if (resourceId && feishuPersonId) {
              resourceIdToFeishuPersonIdMap.set(resourceId, feishuPersonId);
            }
          });
          log(`[飞书同步] ✅ 加载了 ${resourceIdToFeishuPersonIdMap.size} 个人员映射`);
        }
      } catch (error) {
        log(`[飞书同步] ⚠️ 加载人员映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 需求表模式：逐个更新记录
    if (isRequirementMode) {
      log(`[飞书同步] 需求表模式：逐个更新记录`);
      
      for (const task of tasks) {
        if (!task.feishuRecordId) {
          log(`[飞书同步] 跳过无 record_id 的任务: ${task.name}`);
          continue;
        }

        try {
          const feishuPersonId = task.assignedResourceId ? 
            resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';

          const scheduleRecord: any = {
            fields: {
              '需求项目': task.name || '',
              '需求名称': task.name || '',
              '所属': feishuPersonId ? [{ id: feishuPersonId }] : [],
              '项目进展': mapStatusToFeishu(task.status || 'pending'),
              '平面预估工时': task.estimatedHoursGraphic || 0,
              '后期预估工时': task.estimatedHoursPost || 0,
              '子任务依赖模式': task.subTaskDependencyMode === 'serial' ? '串行' : '并行',
            },
          };

          if (task.startDate) {
            scheduleRecord.fields['开始时间'] = Math.floor(new Date(task.startDate).getTime() / 1000) * 1000;
          }
          if (task.endDate) {
            scheduleRecord.fields['结束时间'] = Math.floor(new Date(task.endDate).getTime() / 1000) * 1000;
          }
          if (task.suggestedDeadline) {
            scheduleRecord.fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
          }

          const response = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/${task.feishuRecordId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(scheduleRecord),
            },
            15000
          );

          const data = await response.json();
          if (data.code === 0) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`任务 "${task.name}" 更新失败: ${data.msg}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`任务 "${task.name}" 更新异常: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
    } else {
      // 传统模式：先清空再批量创建
      log(`[飞书同步] 传统模式：先清空再批量创建`);
      
      try {
        // 获取所有现有记录
        const listResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 500 }),
          },
          30000
        );

        const listData = await listResponse.json();
        if (listData.code === 0 && listData.data?.items?.length > 0) {
          const recordIds = listData.data.items.map((item: any) => item.record_id);
          log(`[飞书同步] 清空 ${recordIds.length} 条旧记录`);
          await batchDeleteRecords(appToken, targetTableId, appAccessToken, recordIds);
        }
      } catch (error) {
        log(`[飞书同步] ⚠️ 清空旧记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 批量创建新记录
      const recordsToCreate = tasks.map((task: any) => {
        const feishuPersonId = task.assignedResourceId ? 
          resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';

        const fields: any = {
          '任务名称': task.name || '',
          '任务类型': task.taskType || '',
          '负责人': feishuPersonId ? [{ id: feishuPersonId }] : [],
          '开始时间': task.startDate ? Math.floor(new Date(task.startDate).getTime() / 1000) * 1000 : 0,
          '结束时间': task.endDate ? Math.floor(new Date(task.endDate).getTime() / 1000) * 1000 : 0,
          '预估工时': task.estimatedHours || 0,
          '平面工时': task.estimatedHoursGraphic || 0,
          '后期工时': task.estimatedHoursPost || 0,
          '子任务依赖': task.subTaskDependencyMode === 'serial' ? '串行' : '并行',
          '状态': mapStatusToFeishu(task.status || 'pending'),
        };

        if (task.deadline) {
          fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
        }
        if (task.suggestedDeadline) {
          fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
        }
        if (task.projectName) {
          fields['所属项目'] = task.projectName;
        }

        return { fields };
      });

      if (recordsToCreate.length > 0) {
        log(`[飞书同步] 开始批量创建 ${recordsToCreate.length} 条记录`);
        const result = await batchCreateRecords(appToken, targetTableId, appAccessToken, recordsToCreate);
        successCount = result.success;
        errorCount = result.failed;
      }
    }

    const elapsed = Date.now() - startTime;
    log(`[飞书同步] ========== 同步完成 ==========`);
    log(`[飞书同步] 耗时: ${elapsed}ms, 成功: ${successCount}, 失败: ${errorCount}`);

    return NextResponse.json({
      success: true,
      stats: { success: successCount, error: errorCount },
      errors: errors.length > 0 ? errors : undefined,
      elapsed,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书同步] ❌ 同步异常: ${errorMessage}`);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
