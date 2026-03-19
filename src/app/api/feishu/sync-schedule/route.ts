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

// 批量更新记录（飞书批量更新 API）
async function batchUpdateRecords(
  appToken: string,
  tableId: string,
  appAccessToken: string,
  records: Array<{ record_id: string; fields: any }>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const batchSize = 500;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      // 飞书批量更新 API
      const response = await fetchWithTimeout(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
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
        success += data.data.records.length;
        log(`[飞书同步] 批量更新成功: ${data.data.records.length} 条`);
      } else {
        failed += batch.length;
        const errorMsg = data.msg || '未知错误';
        errors.push(`批量更新失败: ${errorMsg}`);
        log(`[飞书同步] ⚠️ 批量更新失败: ${errorMsg}, code: ${data.code}`);
      }
    } catch (error) {
      failed += batch.length;
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      errors.push(`批量更新异常: ${errorMsg}`);
      log(`[飞书同步] ⚠️ 批量更新异常: ${errorMsg}`);
    }
  }

  return { success, failed, errors };
}

/**
 * 同步排期结果到飞书多维表
 * 需求表模式：更新现有记录的排期信息
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

    if (isRequirementMode) {
      // ===== 需求表模式：批量更新现有记录 =====
      log(`[飞书同步] 需求表模式：准备批量更新记录`);
      
      // 构建更新记录列表
      const recordsToUpdate: Array<{ record_id: string; fields: any }> = [];
      const tasksWithoutRecordId: string[] = [];
      
      // 先收集父任务的 feishuRecordId 映射（用于子任务）
      const parentRecordIdMap = new Map<string, string>();
      tasks.forEach((task: any) => {
        if (task.feishuRecordId && !task.parentTaskId) {
          parentRecordIdMap.set(task.id, task.feishuRecordId);
        }
      });
      
      for (const task of tasks) {
        // 获取 feishuRecordId：
        // 1. 任务自己有 feishuRecordId
        // 2. 子任务使用父任务的 feishuRecordId
        let feishuRecordId = task.feishuRecordId;
        
        if (!feishuRecordId && task.parentTaskId) {
          // 子任务：尝试使用父任务的 record_id
          feishuRecordId = parentRecordIdMap.get(task.parentTaskId);
        }
        
        if (!feishuRecordId) {
          tasksWithoutRecordId.push(task.name);
          continue;
        }

        const feishuPersonId = task.assignedResourceId ? 
          resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';

        const fields: any = {
          '开始时间': task.startDate ? Math.floor(new Date(task.startDate).getTime() / 1000) * 1000 : 0,
          '结束时间': task.endDate ? Math.floor(new Date(task.endDate).getTime() / 1000) * 1000 : 0,
          '项目进展': mapStatusToFeishu(task.status || 'pending'),
        };

        // 只有非子任务才更新负责人（子任务的负责人是分开的）
        if (!task.parentTaskId && feishuPersonId) {
          fields['所属'] = [{ id: feishuPersonId }];
        }
        
        // 子任务更新对应的工时字段
        if (task.subTaskType === '平面' || task.taskType === '平面') {
          fields['平面预估工时'] = task.estimatedHours || task.estimatedHoursGraphic || 0;
        } else if (task.subTaskType === '后期' || task.taskType === '后期') {
          fields['后期预估工时'] = task.estimatedHours || task.estimatedHoursPost || 0;
        }
        
        if (task.suggestedDeadline) {
          fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
        }

        recordsToUpdate.push({ record_id: feishuRecordId, fields });
      }

      if (tasksWithoutRecordId.length > 0) {
        log(`[飞书同步] ⚠️ 有 ${tasksWithoutRecordId.length} 个任务没有 feishuRecordId，将跳过`);
        log(`[飞书同步] 跳过的任务: ${tasksWithoutRecordId.slice(0, 5).join(', ')}${tasksWithoutRecordId.length > 5 ? '...' : ''}`);
      }

      if (recordsToUpdate.length > 0) {
        log(`[飞书同步] 准备批量更新 ${recordsToUpdate.length} 条记录`);
        
        // 每批最多更新500条
        const batchSize = 500;
        for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
          const batch = recordsToUpdate.slice(i, i + batchSize);
          log(`[飞书同步] 正在更新第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 条`);
          
          try {
            const response = await fetchWithTimeout(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/batch_update`,
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
              successCount += data.data.records.length;
              log(`[飞书同步] ✅ 批量更新成功: ${data.data.records.length} 条`);
            } else {
              errorCount += batch.length;
              errors.push(`批量更新失败: ${data.msg}`);
              log(`[飞书同步] ⚠️ 批量更新失败: ${data.msg}, code: ${data.code}`);
            }
          } catch (error) {
            errorCount += batch.length;
            errors.push(`批量更新异常: ${error instanceof Error ? error.message : '未知错误'}`);
            log(`[飞书同步] ⚠️ 批量更新异常: ${error instanceof Error ? error.message : '未知错误'}`);
          }
          
          // 批次间等待100ms
          if (i + batchSize < recordsToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        log(`[飞书同步] ⚠️ 没有需要更新的记录`);
      }
      
    } else {
      // ===== 传统模式：清空并重新创建 =====
      log(`[飞书同步] 传统模式：清空并重新创建`);
      
      // 先获取所有现有记录
      try {
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
          
          // 批量删除
          const deleteResponse = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/batch_delete`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: recordIds }),
            },
            30000
          );
          log(`[飞书同步] 清空完成`);
        }
      } catch (error) {
        log(`[飞书同步] ⚠️ 清空旧记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 准备批量创建的记录
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
          '状态': mapStatusToFeishu(task.status || 'pending'),
        };

        if (task.deadline) {
          fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
        }
        if (task.projectName) {
          fields['所属项目'] = task.projectName;
        }

        return { fields };
      });

      if (recordsToCreate.length > 0) {
        log(`[飞书同步] 开始批量创建 ${recordsToCreate.length} 条记录`);
        
        const batchSize = 500;
        for (let i = 0; i < recordsToCreate.length; i += batchSize) {
          const batch = recordsToCreate.slice(i, i + batchSize);
          log(`[飞书同步] 正在创建第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 条`);
          
          try {
            const response = await fetchWithTimeout(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${targetTableId}/records/batch_create`,
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
              successCount += data.data.records.length;
              log(`[飞书同步] ✅ 批量创建成功: ${data.data.records.length} 条`);
            } else {
              errorCount += batch.length;
              errors.push(`批量创建失败: ${data.msg}`);
              log(`[飞书同步] ⚠️ 批量创建失败: ${data.msg}, code: ${data.code}`);
            }
          } catch (error) {
            errorCount += batch.length;
            errors.push(`批量创建异常: ${error instanceof Error ? error.message : '未知错误'}`);
            log(`[飞书同步] ⚠️ 批量创建异常: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }
      }
    }

    const elapsed = Date.now() - startTime;
    log(`[飞书同步] ========== 同步完成 ==========`);
    log(`[飞书同步] 耗时: ${elapsed}ms, 成功: ${successCount}, 失败: ${errorCount}`);

    return NextResponse.json({
      success: true,
      stats: { success: successCount, error: errorCount, skipped: tasks.length - successCount - errorCount },
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
