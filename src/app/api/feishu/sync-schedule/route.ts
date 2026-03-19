import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken, clearAccessTokenCache } from '@/lib/feishu-api';

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
  const fields: any = {
    '任务名称': task.name || '',
  };

  // 单选字段：直接传字符串（飞书会自动创建或匹配选项）
  const taskType = task.subTaskType || task.taskType || '';
  if (taskType) {
    fields['任务类型'] = taskType;
  }
  
  // 人员字段
  if (feishuPersonId) {
    fields['负责人'] = [{ id: feishuPersonId }];
  }
  
  // 日期字段：Unix 时间戳（毫秒）
  if (task.startDate) {
    fields['开始时间'] = Math.floor(new Date(task.startDate).getTime() / 1000) * 1000;
  }
  if (task.endDate) {
    fields['结束时间'] = Math.floor(new Date(task.endDate).getTime() / 1000) * 1000;
  }
  
  // 数字字段
  fields['预估工时'] = task.estimatedHours || 0;
  fields['平面工时'] = task.estimatedHoursGraphic || 0;
  fields['后期工时'] = task.estimatedHoursPost || 0;
  
  // 状态单选
  fields['状态'] = mapStatusToFeishu(task.status || 'pending');
  
  // 单选字段：直接传字符串
  if (task.projectName) {
    fields['所属项目'] = task.projectName;
  }
  if (task.subType) {
    fields['细分类'] = task.subType;
  }
  if (task.language) {
    fields['语言'] = task.language;
  }
  
  // 截止日期
  if (task.deadline) {
    fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
  }
  if (task.suggestedDeadline) {
    fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
  }
  
  // 父任务ID
  if (task.parentTaskId) {
    fields['父任务ID'] = task.parentTaskId;
  }

  return fields;
}

// 需要的字段定义 - 单选字段不预定义选项，让飞书从数据中自动创建
function buildRequiredFields(existingOptions: {
  taskTypes: string[],
  projects: string[],
  subTypes: string[],
  languages: string[]
}) {
  return [
    { field_name: '任务名称', type: 1 }, // 1=文本
    { field_name: '任务类型', type: 3 }, // 3=单选，不预定义选项
    { field_name: '负责人', type: 11 }, // 11=人员
    { field_name: '开始时间', type: 4 }, // 4=日期
    { field_name: '结束时间', type: 4 },
    { field_name: '预估工时', type: 2 }, // 2=数字
    { field_name: '平面工时', type: 2 },
    { field_name: '后期工时', type: 2 },
    { field_name: '状态', type: 3, property: { options: [ // 状态选项固定
      { name: '待处理' },
      { name: '进行中' },
      { name: '已完成' },
      { name: '阻塞' },
      { name: '待确认' }
    ]}},
    { field_name: '所属项目', type: 3 }, // 3=单选，不预定义选项
    { field_name: '细分类', type: 3 }, // 3=单选，不预定义选项
    { field_name: '语言', type: 3 }, // 3=单选，不预定义选项
    { field_name: '截止日期', type: 4 }, // 4=日期
    { field_name: '建议截止日期', type: 4 },
    { field_name: '父任务ID', type: 1 },
  ];
}

// 收集任务中的选项值
function collectTaskOptions(tasks: any[]): {
  taskTypes: string[],
  projects: string[],
  subTypes: string[],
  languages: string[]
} {
  const taskTypes = new Set<string>();
  const projects = new Set<string>();
  const subTypes = new Set<string>();
  const languages = new Set<string>();

  tasks.forEach(task => {
    if (task.taskType) taskTypes.add(task.taskType);
    if (task.subTaskType) taskTypes.add(task.subTaskType);
    if (task.projectName) projects.add(task.projectName);
    if (task.subType) subTypes.add(task.subType);
    if (task.language) languages.add(task.language);
  });

  return {
    taskTypes: Array.from(taskTypes).filter(Boolean),
    projects: Array.from(projects).filter(Boolean),
    subTypes: Array.from(subTypes).filter(Boolean),
    languages: Array.from(languages).filter(Boolean),
  };
}

// 确保排期表有必要的字段
async function ensureTableFields(
  appToken: string, 
  tableId: string, 
  accessToken: string,
  tasks: any[]
): Promise<{ createdCount: number }> {
  log(`[飞书同步] 检查排期表字段...`);
  
  // 收集选项值
  const options = collectTaskOptions(tasks);
  log(`[飞书同步] 收集到选项 - 任务类型: ${options.taskTypes.length}, 项目: ${options.projects.length}, 细分类: ${options.subTypes.length}, 语言: ${options.languages.length}`);
  
  const REQUIRED_FIELDS = buildRequiredFields(options);
  
  // 获取现有字段
  const fieldsResponse = await fetchWithTimeout(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
    30000
  );
  
  const fieldsData = await fieldsResponse.json();
  const existingFieldNames = new Set<string>();
  
  if (fieldsData.code === 0 && fieldsData.data?.items) {
    fieldsData.data.items.forEach((field: any) => {
      existingFieldNames.add(field.field_name);
    });
    log(`[飞书同步] 现有字段(${existingFieldNames.size}个): ${Array.from(existingFieldNames).slice(0, 10).join(', ')}...`);
  } else {
    log(`[飞书同步] 获取字段失败: code=${fieldsData.code}, msg=${fieldsData.msg}`);
  }
  
  // 创建缺失的字段
  let createdCount = 0;
  for (const field of REQUIRED_FIELDS) {
    if (!existingFieldNames.has(field.field_name)) {
      log(`[飞书同步] 创建字段: ${field.field_name}`);
      try {
        const createResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(field),
          },
          10000
        );
        const result = await createResponse.json();
        if (result.code === 0) {
          log(`[飞书同步] ✅ 字段创建成功: ${field.field_name}`);
          createdCount++;
        } else {
          log(`[飞书同步] ⚠️ 字段创建失败: ${field.field_name}, ${result.msg}`);
        }
      } catch (error) {
        log(`[飞书同步] ⚠️ 字段创建异常: ${field.field_name}`);
      }
    }
  }
  
  // 如果创建了新字段，等待一小段时间让飞书生效
  if (createdCount > 0) {
    log(`[飞书同步] 等待 2 秒让新字段生效...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return { createdCount };
}

/**
 * 同步排期结果到飞书排期表（智能增量同步）
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

    // 强制刷新 token（解决权限刚开通但缓存了旧 token 的问题）
    clearAccessTokenCache();
    log(`[飞书同步] 已清除 token 缓存，重新获取`);

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

    // 确保排期表有必要的字段
    const { createdCount: newFieldCount } = await ensureTableFields(appToken, schedulesTableId, appAccessToken, tasks);
    log(`[飞书同步] 字段检查完成，新建 ${newFieldCount} 个字段`);

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
    const allExistingRecordIds: string[] = [];
    
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
          allExistingRecordIds.push(item.record_id);
          
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
        
        if (existingRecords.size === 0 && allExistingRecordIds.length > 0) {
          log(`[飞书同步] 检测到 ${allExistingRecordIds.length} 条旧记录（无任务名称字段），将清理后重建`);
        }
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

    // 清理无法匹配的旧记录
    if (isEmpty && allExistingRecordIds.length > 0) {
      log(`[飞书同步] 清理 ${allExistingRecordIds.length} 条旧记录...`);
      try {
        const deleteResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_delete`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${appAccessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: allExistingRecordIds }),
          },
          30000
        );
        const result = await deleteResponse.json();
        if (result.code === 0) {
          deletedCount = allExistingRecordIds.length;
          log(`[飞书同步] ✅ 已清理 ${deletedCount} 条旧记录`);
        } else {
          log(`[飞书同步] ⚠️ 清理旧记录失败: code=${result.code}, msg=${result.msg}`);
        }
      } catch (error) {
        log(`[飞书同步] ⚠️ 清理旧记录异常: ${error}`);
      }
    }

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
        log(`[飞书同步] 正在创建第 ${i + 1}-${Math.min(i + batchSize, recordsToCreate.length)} 条记录...`);
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
          log(`[飞书同步] 批量创建响应: code=${data.code}, msg=${data.msg}, records=${data.data?.records?.length || 0}`);
          if (data.code === 0 && data.data?.records) {
            createdCount += data.data.records.length;
            log(`[飞书同步] ✅ 批量创建成功: ${data.data.records.length} 条`);
          } else {
            log(`[飞书同步] ❌ 批量创建失败: code=${data.code}, msg=${data.msg}`);
            errors.push(`创建失败: ${data.msg}`);
          }
        } catch (error) {
          log(`[飞书同步] ❌ 批量创建异常: ${error}`);
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
