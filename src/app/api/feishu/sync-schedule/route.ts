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

/**
 * 同步排期结果到飞书排期表（增量同步）
 * 
 * 逻辑：
 * 1. 获取排期表中所有现有记录，建立 任务ID → record_id 映射
 * 2. 对比排期结果和现有记录：
 *    - 已存在 → 更新
 *    - 不存在 → 新增
 * 3. 排期表中多余的任务ID → 删除
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');

    log(`[飞书同步] ========== 开始增量同步排期 ==========`);
    log(`[飞书同步] 参数: appId=${appId?.substring(0, 8)}..., appToken=${appToken?.substring(0, 8)}...`);
    log(`[飞书同步] 排期表ID: ${schedulesTableId?.substring(0, 10)}...`);

    if (!appId || !appSecret) {
      return NextResponse.json({ success: false, error: '缺少 app_id 或 app_secret' }, { status: 400 });
    }

    if (!appToken) {
      return NextResponse.json({ success: false, error: '缺少 app_token' }, { status: 400 });
    }

    if (!schedulesTableId) {
      return NextResponse.json({ success: false, error: '缺少排期表 ID (schedules_table_id)' }, { status: 400 });
    }

    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      log(`[飞书同步] 没有任务需要同步`);
      return NextResponse.json({ 
        success: true, 
        stats: { created: 0, updated: 0, deleted: 0 },
        message: '没有任务需要同步'
      });
    }

    log(`[飞书同步] 排期结果任务数: ${tasks.length}`);

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

    // ===== 第一步：获取排期表中所有现有记录 =====
    log(`[飞书同步] 第一步：获取排期表现有记录`);
    
    const existingRecords = new Map<string, { record_id: string; fields: any }>(); // 任务ID -> { record_id, fields }
    
    try {
      let hasMore = true;
      let pageToken = '';
      
      while (hasMore) {
        const listResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              page_size: 500,
              page_token: pageToken || undefined 
            }),
          },
          30000
        );

        const listData = await listResponse.json();
        if (listData.code === 0 && listData.data?.items?.length > 0) {
          listData.data.items.forEach((item: any) => {
            const fields = item.fields;
            // 从记录中获取任务ID
            const taskId = fields['任务ID'] || '';
            if (taskId) {
              existingRecords.set(taskId, { record_id: item.record_id, fields });
            }
          });
          
          hasMore = listData.data.has_more;
          pageToken = listData.data.page_token || '';
        } else {
          hasMore = false;
        }
      }
      
      log(`[飞书同步] 现有记录数: ${existingRecords.size}`);
    } catch (error) {
      log(`[飞书同步] ⚠️ 获取现有记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // ===== 第二步：对比并分类 =====
    log(`[飞书同步] 第二步：对比并分类任务`);
    
    const tasksToCreate: any[] = []; // 需要新增的
    const tasksToUpdate: Array<{ record_id: string; fields: any }> = []; // 需要更新的
    const newTaskIds = new Set<string>(); // 排期结果中的所有任务ID
    
    for (const task of tasks) {
      const taskId = task.id || '';
      newTaskIds.add(taskId);
      
      const feishuPersonId = task.assignedResourceId ? 
        resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';

      // 判断任务类型
      const taskType = task.subTaskType || task.taskType || '';
      
      // 构建记录字段
      const fields: any = {
        '任务名称': task.name || '',
        '任务类型': taskType,
        '负责人': feishuPersonId ? [{ id: feishuPersonId }] : [],
        '开始时间': task.startDate ? Math.floor(new Date(task.startDate).getTime() / 1000) * 1000 : 0,
        '结束时间': task.endDate ? Math.floor(new Date(task.endDate).getTime() / 1000) * 1000 : 0,
        '预估工时': task.estimatedHours || 0,
        '平面工时': task.estimatedHoursGraphic || 0,
        '后期工时': task.estimatedHoursPost || 0,
        '状态': mapStatusToFeishu(task.status || 'pending'),
        '所属项目': task.projectName || '',
        '任务ID': taskId,
      };

      if (task.deadline) {
        fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
      }
      if (task.suggestedDeadline) {
        fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
      }
      if (task.parentTaskId) {
        fields['父任务ID'] = task.parentTaskId;
      }

      // 检查是否已存在
      const existing = existingRecords.get(taskId);
      if (existing) {
        // 已存在，检查是否需要更新
        const existingFields = existing.fields;
        const needsUpdate = 
          existingFields['开始时间'] !== fields['开始时间'] ||
          existingFields['结束时间'] !== fields['结束时间'] ||
          existingFields['状态'] !== fields['状态'] ||
          (existingFields['负责人']?.[0]?.id || '') !== (feishuPersonId || '') ||
          existingFields['预估工时'] !== fields['预估工时'];
        
        if (needsUpdate) {
          tasksToUpdate.push({ record_id: existing.record_id, fields });
        }
      } else {
        // 不存在，需要新增
        tasksToCreate.push({ fields });
      }
    }

    // 找出需要删除的记录（排期表中有但排期结果中没有的）
    const recordsToDelete: string[] = [];
    for (const [taskId, record] of existingRecords) {
      if (!newTaskIds.has(taskId)) {
        recordsToDelete.push(record.record_id);
      }
    }

    log(`[飞书同步] 分类结果: 新增 ${tasksToCreate.length}, 更新 ${tasksToUpdate.length}, 删除 ${recordsToDelete.length}`);

    // ===== 第三步：执行操作 =====
    log(`[飞书同步] 第三步：执行同步操作`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    const errors: string[] = [];

    // 3.1 批量删除
    if (recordsToDelete.length > 0) {
      log(`[飞书同步] 正在删除 ${recordsToDelete.length} 条记录...`);
      const batchSize = 500;
      for (let i = 0; i < recordsToDelete.length; i += batchSize) {
        const batch = recordsToDelete.slice(i, i + batchSize);
        try {
          const response = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_delete`,
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
            deletedCount += batch.length;
          } else {
            errors.push(`删除失败: ${data.msg}`);
          }
        } catch (error) {
          errors.push(`删除异常: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      log(`[飞书同步] ✅ 删除完成: ${deletedCount} 条`);
    }

    // 3.2 批量新增
    if (tasksToCreate.length > 0) {
      log(`[飞书同步] 正在新增 ${tasksToCreate.length} 条记录...`);
      const batchSize = 500;
      for (let i = 0; i < tasksToCreate.length; i += batchSize) {
        const batch = tasksToCreate.slice(i, i + batchSize);
        try {
          const response = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_create`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: batch }),
            },
            60000
          );
          const data = await response.json();
          if (data.code === 0 && data.data?.records) {
            createdCount += data.data.records.length;
          } else {
            errors.push(`新增失败: ${data.msg}`);
          }
        } catch (error) {
          errors.push(`新增异常: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      log(`[飞书同步] ✅ 新增完成: ${createdCount} 条`);
    }

    // 3.3 批量更新
    if (tasksToUpdate.length > 0) {
      log(`[飞书同步] 正在更新 ${tasksToUpdate.length} 条记录...`);
      const batchSize = 500;
      for (let i = 0; i < tasksToUpdate.length; i += batchSize) {
        const batch = tasksToUpdate.slice(i, i + batchSize);
        try {
          const response = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_update`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: batch }),
            },
            60000
          );
          const data = await response.json();
          if (data.code === 0 && data.data?.records) {
            updatedCount += data.data.records.length;
          } else {
            errors.push(`更新失败: ${data.msg}`);
          }
        } catch (error) {
          errors.push(`更新异常: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      log(`[飞书同步] ✅ 更新完成: ${updatedCount} 条`);
    }

    const elapsed = Date.now() - startTime;
    log(`[飞书同步] ========== 同步完成 ==========`);
    log(`[飞书同步] 耗时: ${elapsed}ms, 新增: ${createdCount}, 更新: ${updatedCount}, 删除: ${deletedCount}`);

    return NextResponse.json({
      success: true,
      stats: { 
        created: createdCount, 
        updated: updatedCount, 
        deleted: deletedCount,
        unchanged: tasks.length - tasksToCreate.length - tasksToUpdate.length
      },
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
