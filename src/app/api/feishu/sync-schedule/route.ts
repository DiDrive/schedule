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
};

// 生成任务唯一标识：任务名称|所属项目|细分类|语言
function getTaskUniqueKey(task: any): string {
  const name = task.name || '';
  const project = task.projectName || '';
  const subType = task.subType || '';
  const language = task.language || '';
  return `${name}|${project}|${subType}|${language}`;
}

// 构建任务记录字段
function buildTaskFields(task: any, feishuPersonId: string): any {
  const taskType = task.subTaskType || task.taskType || '';
  
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
    '细分类': task.subType || '',
    '语言': task.language || '',
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

  return fields;
}

/**
 * 同步排期结果到飞书排期表（智能增量同步）
 * 
 * 逻辑：
 * 1. 获取排期表中现有记录数量
 * 2. 如果排期表为空 → 直接全部新增
 * 3. 如果排期表有数据：
 *    - 尝试按"任务ID"匹配进行增量同步
 *    - 如果没有"任务ID"字段，提示用户需要添加
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');

    log(`[飞书同步] ========== 开始同步排期 ==========`);
    log(`[飞书同步] 排期表ID: ${schedulesTableId?.substring(0, 10)}...`);

    if (!appId || !appSecret) {
      return NextResponse.json({ success: false, error: '缺少 app_id 或 app_secret' }, { status: 400 });
    }

    if (!appToken || !schedulesTableId) {
      return NextResponse.json({ success: false, error: '缺少 app_token 或排期表ID' }, { status: 400 });
    }

    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
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
    } catch (error) {
      return NextResponse.json({ 
        success: false, 
        error: `获取飞书访问令牌失败` 
      }, { status: 500 });
    }

    // 创建资源ID到飞书人员ID的映射表
    const resourceIdToFeishuPersonIdMap = new Map<string, string>();
    const resourcesTableId = searchParams.get('resources_table_id');
    
    if (resourcesTableId) {
      try {
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
          log(`[飞书同步] 加载了 ${resourceIdToFeishuPersonIdMap.size} 个人员映射`);
        }
      } catch (error) {
        log(`[飞书同步] 加载人员映射失败: ${error}`);
      }
    }

    // ===== 获取排期表中现有记录 =====
    log(`[飞书同步] 检查排期表现有记录...`);
    
    const existingRecords = new Map<string, { record_id: string; fields: any }>();
    
    try {
      const listResponse = await fetchWithTimeout(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/search`,
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
        log(`[飞书同步] 现有记录数: ${listData.data.items.length}`);
        
        // 调试：打印第一条记录的所有字段名
        if (listData.data.items[0]) {
          const firstFields = listData.data.items[0].fields;
          log(`[飞书同步] 排期表字段名: ${Object.keys(firstFields).join(', ')}`);
        }
        
        // 用"任务名称|所属项目|细分类|语言"建立映射
        listData.data.items.forEach((item: any) => {
          const fields = item.fields;
          const name = fields['任务名称'] || '';
          const project = fields['所属项目'] || '';
          const subType = fields['细分类'] || '';
          const language = fields['语言'] || '';
          const key = `${name}|${project}|${subType}|${language}`;
          
          if (name) {
            existingRecords.set(key, { record_id: item.record_id, fields });
          }
        });
        log(`[飞书同步] 已建立 ${existingRecords.size} 个任务映射`);
      } else {
        log(`[飞书同步] 排期表为空`);
      }
    } catch (error) {
      log(`[飞书同步] 获取现有记录失败: ${error}`);
    }

    // ===== 执行同步 =====
    const isEmpty = existingRecords.size === 0;
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    const errors: string[] = [];

    if (isEmpty) {
      // ===== 空表：直接全部新增 =====
      log(`[飞书同步] 空表模式：全部新增`);
      
      const recordsToCreate = tasks.map((task: any) => {
        const feishuPersonId = task.assignedResourceId ? 
          resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';
        return { fields: buildTaskFields(task, feishuPersonId) };
      });
      
      log(`[飞书同步] 准备创建 ${recordsToCreate.length} 条记录`);
      if (recordsToCreate.length > 0) {
        log(`[飞书同步] 第一条记录字段: ${JSON.stringify(recordsToCreate[0].fields).substring(0, 500)}`);
      }

      // 批量创建
      const batchSize = 500;
      for (let i = 0; i < recordsToCreate.length; i += batchSize) {
        const batch = recordsToCreate.slice(i, i + batchSize);
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
            log(`[飞书同步] 批量创建成功: ${data.data.records.length} 条`);
          } else {
            log(`[飞书同步] 批量创建失败: code=${data.code}, msg=${data.msg}`);
            errors.push(`创建失败: ${data.msg}`);
          }
        } catch (error) {
          log(`[飞书同步] 批量创建异常: ${error}`);
          errors.push(`创建异常: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
    } else {
      // ===== 增量同步 =====
      log(`[飞书同步] 增量模式：新增/更新/删除`);
      
      const tasksToCreate: any[] = [];
      const tasksToUpdate: Array<{ record_id: string; fields: any }> = [];
      const newTaskKeys = new Set<string>();
      
      for (const task of tasks) {
        const key = getTaskUniqueKey(task);
        newTaskKeys.add(key);
        
        const feishuPersonId = task.assignedResourceId ? 
          resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';
        
        const fields = buildTaskFields(task, feishuPersonId);
        
        const existing = existingRecords.get(key);
        if (existing) {
          // 已存在，检查是否需要更新
          const oldFields = existing.fields;
          const needsUpdate = 
            oldFields['开始时间'] !== fields['开始时间'] ||
            oldFields['结束时间'] !== fields['结束时间'] ||
            oldFields['状态'] !== fields['状态'] ||
            (oldFields['负责人']?.[0]?.id || '') !== (feishuPersonId || '') ||
            oldFields['预估工时'] !== fields['预估工时'];
          
          if (needsUpdate) {
            tasksToUpdate.push({ record_id: existing.record_id, fields });
          }
        } else {
          tasksToCreate.push({ fields });
        }
      }

      // 需要删除的记录（排期表中有，但排期结果中没有）
      const recordsToDelete: string[] = [];
      for (const [key, record] of existingRecords) {
        if (!newTaskKeys.has(key)) {
          recordsToDelete.push(record.record_id);
        }
      }

      log(`[飞书同步] 新增: ${tasksToCreate.length}, 更新: ${tasksToUpdate.length}, 删除: ${recordsToDelete.length}`);

      // 批量删除
      if (recordsToDelete.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < recordsToDelete.length; i += batchSize) {
          const batch = recordsToDelete.slice(i, i + batchSize);
          try {
            const response = await fetchWithTimeout(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_delete`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${appAccessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: batch }),
              },
              30000
            );
            const data = await response.json();
            if (data.code === 0) deletedCount += batch.length;
          } catch (error) { /* ignore */ }
        }
      }

      // 批量新增
      if (tasksToCreate.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < tasksToCreate.length; i += batchSize) {
          const batch = tasksToCreate.slice(i, i + batchSize);
          try {
            const response = await fetchWithTimeout(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_create`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${appAccessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: batch }),
              },
              60000
            );
            const data = await response.json();
            if (data.code === 0 && data.data?.records) createdCount += data.data.records.length;
          } catch (error) { /* ignore */ }
        }
      }

      // 批量更新
      if (tasksToUpdate.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < tasksToUpdate.length; i += batchSize) {
          const batch = tasksToUpdate.slice(i, i + batchSize);
          try {
            const response = await fetchWithTimeout(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_update`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${appAccessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: batch }),
              },
              60000
            );
            const data = await response.json();
            if (data.code === 0 && data.data?.records) updatedCount += data.data.records.length;
          } catch (error) { /* ignore */ }
        }
      }
    }

    const elapsed = Date.now() - startTime;
    log(`[飞书同步] 完成: 新增 ${createdCount}, 更新 ${updatedCount}, 删除 ${deletedCount}, 耗时 ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      stats: { created: createdCount, updated: updatedCount, deleted: deletedCount },
      errors: errors.length > 0 ? errors : undefined,
      elapsed,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书同步] 异常: ${errorMessage}`);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
