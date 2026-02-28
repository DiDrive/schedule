import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-sync-all.log', logMessage);
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

// 优先级映射函数
function mapPriorityToFeishu(priority: string): string {
  const priorityMap: Record<string, string> = {
    'urgent': '紧急',
    'high': '高',
    'normal': '普通',
    'low': '低',
  };
  return priorityMap[priority] || '普通';
}

// 资源类型映射
function mapResourceTypeToFeishu(type: string): string {
  const typeMap: Record<string, string> = {
    'human': '人员',
    'material': '物料',
    'equipment': '设备',
  };
  return typeMap[type] || '人员';
}

// 资源等级映射
function mapResourceLevelToFeishu(level?: string): string {
  if (!level) return '';
  const levelMap: Record<string, string> = {
    'assistant': '助理',
    'junior': '初级',
    'senior': '高级',
  };
  return levelMap[level] || '';
}

/**
 * 同步所有数据（人员、项目、任务、排期）到飞书多维表
 *
 * 请求参数（通过 URL 传递）:
 * - app_id: 飞书应用 ID
 * - app_secret: 飞书应用密钥
 * - app_token: 多维表格 App Token
 * - resources_table_id: 人员表 Table ID
 * - projects_table_id: 项目表 Table ID
 * - tasks_table_id: 任务表 Table ID
 * - schedules_table_id: 排期表 Table ID
 *
 * 请求体:
 * - resources: 人员列表
 * - projects: 项目列表
 * - tasks: 任务列表（包含排期信息）
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const resourcesTableId = searchParams.get('resources_table_id');
    const projectsTableId = searchParams.get('projects_table_id');
    const tasksTableId = searchParams.get('tasks_table_id');
    const schedulesTableId = searchParams.get('schedules_table_id');

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

    const body = await request.json();
    const { resources, projects, tasks } = body;

    const appAccessToken = await getAppAccessToken(appId, appSecret);
    log('[飞书同步] 开始全量同步');
    log(`[飞书同步] Table ID 配置: resources=${resourcesTableId || '未配置'}, projects=${projectsTableId || '未配置'}, tasks=${tasksTableId || '未配置'}, schedules=${schedulesTableId || '未配置'}`);
    log(`[飞书同步] 待同步数据: resources=${resources?.length || 0}, projects=${projects?.length || 0}, tasks=${tasks?.length || 0}`);

    const stats = {
      resources: { success: 0, error: 0 },
      projects: { success: 0, error: 0 },
      tasks: { success: 0, error: 0 },
      schedules: { success: 0, error: 0 },
    };

    const allErrors: string[] = [];

    // 1. 同步人员数据
    if (resourcesTableId && resourcesTableId.trim() !== '' && resources && Array.isArray(resources)) {
      log(`[飞书同步] ✅ 开始同步人员数据: ${resources.length} 条`);
      const { success, error, errors } = await syncResources(
        appToken,
        appAccessToken,
        resourcesTableId,
        resources
      );
      stats.resources.success = success;
      stats.resources.error = error;
      allErrors.push(...errors);
    } else {
      log(`[飞书同步] ⏭️  跳过人员数据同步: ${!resourcesTableId ? '未配置 Table ID' : !resources ? '无数据' : '数据格式错误'}`);
    }

    // 2. 同步项目数据
    if (projectsTableId && projectsTableId.trim() !== '' && projects && Array.isArray(projects)) {
      log(`[飞书同步] ✅ 开始同步项目数据: ${projects.length} 条`);
      const { success, error, errors } = await syncProjects(
        appToken,
        appAccessToken,
        projectsTableId,
        projects
      );
      stats.projects.success = success;
      stats.projects.error = error;
      allErrors.push(...errors);
    } else {
      log(`[飞书同步] ⏭️  跳过项目数据同步: ${!projectsTableId ? '未配置 Table ID' : !projects ? '无数据' : '数据格式错误'}`);
    }

    // 3. 同步任务数据
    if (tasksTableId && tasksTableId.trim() !== '' && tasks && Array.isArray(tasks)) {
      log(`[飞书同步] ✅ 开始同步任务数据: ${tasks.length} 条`);

      // 创建资源ID到飞书人员ID的映射表
      let resourceIdToFeishuPersonIdMap = new Map<string, string>();
      if (resourcesTableId && resources) {
        try {
          const resourcesData = await fetch(
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

          const resourcesResponse = await resourcesData.json();
          if (resourcesResponse.code === 0 && resourcesResponse.data) {
            const { parseStringField, parsePersonId } = require('@/lib/feishu-field-parser');
            resourcesResponse.data.items.forEach((item: any) => {
              const fields = item.fields;
              const resourceId = parseStringField(fields['人员ID'] || fields['id'] || fields['ID']) || `res_${item.record_id.substring(0, 8)}`;
              const feishuPersonId = parsePersonId(fields['姓名'] || fields['name'] || fields['人员']);

              if (resourceId && feishuPersonId) {
                resourceIdToFeishuPersonIdMap.set(resourceId, feishuPersonId);
              }
            });
          }
        } catch (error) {
          log(`[飞书同步] ⚠️ 加载资源映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      // 创建项目名称映射
      let projectIdToNameMap = new Map<string, string>();
      if (projects && Array.isArray(projects)) {
        projects.forEach((project: any) => {
          if (project.id && project.name) {
            projectIdToNameMap.set(project.id, project.name);
          }
        });
      }

      const { success, error, errors } = await syncTasks(
        appToken,
        appAccessToken,
        tasksTableId,
        tasks,
        resourceIdToFeishuPersonIdMap,
        projectIdToNameMap
      );
      stats.tasks.success = success;
      stats.tasks.error = error;
      allErrors.push(...errors);
    } else {
      log(`[飞书同步] ⏭️  跳过任务数据同步: ${!tasksTableId ? '未配置 Table ID' : !tasks ? '无数据' : '数据格式错误'}`);
    }

    // 4. 同步排期数据
    if (schedulesTableId && schedulesTableId.trim() !== '' && tasks && Array.isArray(tasks)) {
      log(`[飞书同步] ✅ 开始同步排期数据: ${tasks.length} 条`);

      // 创建资源ID到飞书人员ID的映射表（从已同步的人员表）
      let resourceIdToFeishuPersonIdMap = new Map<string, string>();
      if (resourcesTableId) {
        try {
          const resourcesData = await fetch(
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

          const resourcesResponse = await resourcesData.json();
          if (resourcesResponse.code === 0 && resourcesResponse.data) {
            const { parseStringField, parsePersonId } = require('@/lib/feishu-field-parser');
            resourcesResponse.data.items.forEach((item: any) => {
              const fields = item.fields;
              const resourceId = parseStringField(fields['人员ID'] || fields['id'] || fields['ID']) || `res_${item.record_id.substring(0, 8)}`;
              const feishuPersonId = parsePersonId(fields['姓名'] || fields['name'] || fields['人员']);

              if (resourceId && feishuPersonId) {
                resourceIdToFeishuPersonIdMap.set(resourceId, feishuPersonId);
              }
            });
          }
        } catch (error) {
          log(`[飞书同步] ⚠️ 加载资源映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      const { success, error, errors } = await syncSchedules(
        appToken,
        appAccessToken,
        schedulesTableId,
        tasks,
        resourceIdToFeishuPersonIdMap
      );
      stats.schedules.success = success;
      stats.schedules.error = error;
      allErrors.push(...errors);
    }

    log(`[飞书同步] ✅ 全量同步完成: ${JSON.stringify(stats)}`);

    return NextResponse.json({
      success: true,
      stats,
      errors: allErrors,
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

// 清空表格记录
async function clearTable(appToken: string, appAccessToken: string, tableId: string) {
  const listResponse = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
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
    log(`[飞书同步] 清空 ${listData.data.items.length} 条旧记录`);

    // 删除所有旧记录
    for (const item of listData.data.items) {
      await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${item.record_id}`,
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
}

// 同步人员数据
async function syncResources(
  appToken: string,
  appAccessToken: string,
  tableId: string,
  resources: any[]
) {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // 先清空
  await clearTable(appToken, appAccessToken, tableId);

  for (const resource of resources) {
    try {
      const record: any = {
        fields: {
          '人员ID': resource.id,
          '姓名': resource.name || '',
          '类型': mapResourceTypeToFeishu(resource.type),
          '工作类型': resource.workType || '',
          '等级': mapResourceLevelToFeishu(resource.level),
          '效率': resource.efficiency || 1.0,
          '可用性': resource.availability || 1.0,
        },
      };

      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record),
        }
      );

      const data = await response.json();
      if (data.code === 0) {
        successCount++;
        log(`[飞书同步] ✅ 同步人员成功: ${resource.name}`);
      } else {
        errorCount++;
        errors.push(`人员 "${resource.name}" 同步失败: ${data.msg} (code: ${data.code})`);
        log(`[飞书同步] ❌ 人员 "${resource.name}" 同步失败: ${data.msg}`);
      }
    } catch (error) {
      errorCount++;
      const errorMsg = `人员 "${resource.name}" 同步异常: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      log(`[飞书同步] ❌ ${errorMsg}`);
    }
  }

  return { success: successCount, error: errorCount, errors };
}

// 同步项目数据
async function syncProjects(
  appToken: string,
  appAccessToken: string,
  tableId: string,
  projects: any[]
) {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // 先清空
  await clearTable(appToken, appAccessToken, tableId);

  for (const project of projects) {
    try {
      const record: any = {
        fields: {
          '项目ID': project.id,
          '项目名称': project.name || '',
          '描述': project.description || '',
          '优先级': mapPriorityToFeishu(project.priority),
        },
      };

      if (project.deadline) {
        record.fields['截止日期'] = Math.floor(new Date(project.deadline).getTime() / 1000) * 1000;
      }

      if (project.startDate) {
        record.fields['开始日期'] = Math.floor(new Date(project.startDate).getTime() / 1000) * 1000;
      }

      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record),
        }
      );

      const data = await response.json();
      if (data.code === 0) {
        successCount++;
        log(`[飞书同步] ✅ 同步项目成功: ${project.name}`);
      } else {
        errorCount++;
        errors.push(`项目 "${project.name}" 同步失败: ${data.msg} (code: ${data.code})`);
        log(`[飞书同步] ❌ 项目 "${project.name}" 同步失败: ${data.msg}`);
      }
    } catch (error) {
      errorCount++;
      const errorMsg = `项目 "${project.name}" 同步异常: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      log(`[飞书同步] ❌ ${errorMsg}`);
    }
  }

  return { success: successCount, error: errorCount, errors };
}

// 同步任务数据
async function syncTasks(
  appToken: string,
  appAccessToken: string,
  tableId: string,
  tasks: any[],
  resourceIdToFeishuPersonIdMap: Map<string, string>,
  projectIdToNameMap: Map<string, string>
) {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // 先清空
  await clearTable(appToken, appAccessToken, tableId);

  for (const task of tasks) {
    try {
      const feishuPersonId = task.assignedResources?.[0] ? resourceIdToFeishuPersonIdMap.get(task.assignedResources[0]) || task.assignedResources[0] : '';
      const projectName = task.projectId ? projectIdToNameMap.get(task.projectId) || '' : '';

      const record: any = {
        fields: {
          '任务ID': task.id,
          '任务名称': task.name || '',
          '描述': task.description || '',
          '任务类型': task.taskType || '',
          '预估工时': task.estimatedHours || 0,
          '负责人': feishuPersonId ? [{ id: feishuPersonId }] : [],
          '所属项目': projectName,
          '优先级': mapPriorityToFeishu(task.priority),
          '状态': mapStatusToFeishu(task.status || 'pending'),
        },
      };

      if (task.deadline) {
        record.fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
      }

      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record),
        }
      );

      const data = await response.json();
      if (data.code === 0) {
        successCount++;
        log(`[飞书同步] ✅ 同步任务成功: ${task.name}`);
      } else {
        errorCount++;
        errors.push(`任务 "${task.name}" 同步失败: ${data.msg} (code: ${data.code})`);
        log(`[飞书同步] ❌ 任务 "${task.name}" 同步失败: ${data.msg}`);
      }
    } catch (error) {
      errorCount++;
      const errorMsg = `任务 "${task.name}" 同步异常: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      log(`[飞书同步] ❌ ${errorMsg}`);
    }
  }

  return { success: successCount, error: errorCount, errors };
}

// 同步排期数据
async function syncSchedules(
  appToken: string,
  appAccessToken: string,
  tableId: string,
  tasks: any[],
  resourceIdToFeishuPersonIdMap: Map<string, string>
) {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // 先清空
  await clearTable(appToken, appAccessToken, tableId);

  for (const task of tasks) {
    try {
      const feishuPersonId = task.assignedResources?.[0] ? resourceIdToFeishuPersonIdMap.get(task.assignedResources[0]) || task.assignedResources[0] : '';

      const record: any = {
        fields: {
          '任务名称': task.name || '',
          '任务类型': task.taskType || '',
          '负责人': feishuPersonId ? [{ id: feishuPersonId }] : [],
          '开始时间': task.startDate ? Math.floor(new Date(task.startDate).getTime() / 1000) * 1000 : 0,
          '结束时间': task.endDate ? Math.floor(new Date(task.endDate).getTime() / 1000) * 1000 : 0,
          '预估工时': task.estimatedHours || 0,
          '状态': mapStatusToFeishu(task.status || 'pending'),
        },
      };

      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record),
        }
      );

      const data = await response.json();
      if (data.code === 0) {
        successCount++;
        log(`[飞书同步] ✅ 同步排期成功: ${task.name}`);
      } else {
        errorCount++;
        errors.push(`排期 "${task.name}" 同步失败: ${data.msg} (code: ${data.code})`);
        log(`[飞书同步] ❌ 排期 "${task.name}" 同步失败: ${data.msg}`);
      }
    } catch (error) {
      errorCount++;
      const errorMsg = `排期 "${task.name}" 同步异常: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      log(`[飞书同步] ❌ ${errorMsg}`);
    }
  }

  return { success: successCount, error: errorCount, errors };
}
