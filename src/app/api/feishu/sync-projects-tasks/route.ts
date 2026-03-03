/**
 * 同步项目和任务数据到飞书多维表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';
import { projectToFeishuRecord, taskToFeishuRecord, FEISHU_FIELD_IDS } from '@/lib/feishu-data-mapper';
import type { Project, Task } from '@/types/schedule';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[飞书同步] ${message}`);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-sync.log', `[${timestamp}] ${message}\n`);
  } catch (error) {
    // 忽略日志写入错误
  }
};

/**
 * POST /api/feishu/sync-projects-tasks
 * 同步项目和任务到飞书
 * 
 * 请求体:
 * - projects: 项目数组
 * - tasks: 任务数组
 * - projectsMap: 项目ID到项目名称的映射（用于任务同步时转换项目ID为名称）
 * - config: 飞书配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projects, tasks, projectsMap, config } = body;

    if (!config) {
      return NextResponse.json(
        { success: false, message: '缺少飞书配置' },
        { status: 400 }
      );
    }

    const { appId, appSecret, appToken, tableIds } = config;

    log(`接收到的 tableIds: ${JSON.stringify(tableIds)}`);

    if (!appId || !appSecret || !appToken || !tableIds) {
      return NextResponse.json(
        { success: false, message: '飞书配置不完整，请检查appId、appSecret、appToken和tableIds' },
        { status: 400 }
      );
    }

    if (!tableIds.projects || !tableIds.tasks) {
      return NextResponse.json(
        { success: false, message: '缺少项目表或任务表的Table ID' },
        { status: 400 }
      );
    }

    if (!tableIds.resources) {
      log('⚠️ tableIds.resources 为空，无法映射资源ID到飞书人员ID');
    }

    // 获取飞书访问令牌
    const appAccessToken = await getAppAccessToken(appId, appSecret);
    log('成功获取飞书访问令牌');

    const stats = {
      projects: { created: 0, updated: 0, failed: 0, deleted: 0 },
      tasks: { created: 0, updated: 0, failed: 0, deleted: 0 },
    };
    const errors: string[] = [];

    // 1. 同步项目数据
    if (projects && Array.isArray(projects) && projects.length > 0) {
      log(`开始同步 ${projects.length} 个项目`);
      
      // 先获取飞书中的现有项目记录
      const existingProjectsMap = new Map<string, string>(); // projectId -> record_id
      
      try {
        // 使用 records/list 接口获取所有记录
        let allRecords: any[] = [];
        let pageToken = '';
        
        do {
          const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.projects}/records?page_size=500${pageToken ? `&page_token=${pageToken}` : ''}`;
          
          const listResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
          });

          const listData = await listResponse.json();
          log(`获取项目记录响应: code=${listData.code}, has_data=${!!listData.data}, items=${listData.data?.items?.length || 0}`);
          
          if (listData.code === 0 && listData.data && listData.data.items) {
            allRecords = allRecords.concat(listData.data.items);
            pageToken = listData.data.page_token || '';
          } else {
            log(`获取项目记录失败: ${JSON.stringify(listData)}`);
            break;
          }
        } while (pageToken);
        
        log(`总共获取到 ${allRecords.length} 个项目记录`);
        
        allRecords.forEach((item: any) => {
          log(`项目记录 - record_id=${item.record_id}, fields=${JSON.stringify(item.fields).substring(0, 200)}`);
          const projectId = item.fields[FEISHU_FIELD_IDS.projects.id];
          if (projectId) {
            existingProjectsMap.set(projectId, item.record_id);
            log(`✅ 映射项目: ${projectId} -> ${item.record_id}`);
          } else {
            log(`⚠️ 项目记录缺少 ID 字段: ${item.record_id}, 可用字段: ${Object.keys(item.fields).join(', ')}`);
          }
        });
        log(`飞书中已有 ${existingProjectsMap.size} 个项目记录`);
      } catch (error) {
        log(`获取现有项目记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 收集系统中所有项目的ID
      const systemProjectIds = new Set(projects.map(p => p.id));
      log(`系统中共有 ${systemProjectIds.size} 个项目`);

      // 同步每个项目
      for (const project of projects) {
        try {
          const projectRecord = projectToFeishuRecord(project);
          const existingRecordId = existingProjectsMap.get(project.id);

          if (existingRecordId) {
            // 更新现有记录
            await fetch(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.projects}/records/${existingRecordId}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${appAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields: projectRecord }),
              }
            );
            stats.projects.updated++;
            log(`✅ 更新项目: ${project.name}`);
          } else {
            // 创建新记录
            await fetch(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.projects}/records`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${appAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields: projectRecord }),
              }
            );
            stats.projects.created++;
            log(`✅ 创建项目: ${project.name}`);
          }
        } catch (error) {
          stats.projects.failed++;
          const errorMsg = `项目 "${project.name}" 同步失败: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMsg);
          log(`❌ ${errorMsg}`);
        }
      }

      // 删除飞书中多余的项目记录（只在同步项目数据时执行删除）
      for (const [projectId, recordId] of existingProjectsMap.entries()) {
        if (!systemProjectIds.has(projectId)) {
          try {
            await fetch(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.projects}/records/${recordId}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${appAccessToken}`,
                },
              }
            );
            stats.projects.deleted = (stats.projects.deleted || 0) + 1;
            log(`🗑️ 删除多余项目: ${projectId}`);
          } catch (error) {
            log(`❌ 删除项目失败: ${projectId}, 错误: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }
      }
    } else {
      log('跳过项目同步：没有项目数据或项目数组为空');
    }

    // 2. 同步任务数据
    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      log(`开始同步 ${tasks.length} 个任务`);
      
      // 加载资源ID到飞书人员ID的映射
      const resourceIdToFeishuPersonIdMap = new Map<string, string>();
      
      if (tableIds.resources) {
        try {
          const resourcesResponse = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.resources}/records?page_size=500`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const resourcesData = await resourcesResponse.json();
          
          if (resourcesData.code === 0 && resourcesData.data && resourcesData.data.items) {
            resourcesData.data.items.forEach((item: any) => {
              const fields = item.fields;
              // 从多个可能的字段名中获取资源ID
              const resourceId = fields['人员ID'] || fields['id'] || fields['ID'] || fields['Id'] || fields['resourceId'];
              
              // 从姓名字段提取飞书人员ID
              const nameField = fields['姓名'] || fields['name'] || fields['人员'];
              const feishuPersonId = Array.isArray(nameField) && nameField.length > 0 ? nameField[0].id : null;

              if (resourceId && feishuPersonId) {
                resourceIdToFeishuPersonIdMap.set(String(resourceId), String(feishuPersonId));
                log(`映射资源: ${resourceId} -> ${feishuPersonId}`);
              } else {
                log(`⚠️ 资源记录缺少必要字段: recordId=${item.record_id}, resourceId=${resourceId}, feishuPersonId=${feishuPersonId}`);
              }
            });
            log(`✅ 加载了 ${resourceIdToFeishuPersonIdMap.size} 个资源映射`);
          } else {
            log(`⚠️ 获取资源数据失败: ${JSON.stringify(resourcesData)}`);
          }
        } catch (error) {
          log(`⚠️ 加载资源映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      } else {
        log('⚠️ 未配置资源表，无法映射资源ID到飞书人员ID');
      }
      
      // 先获取飞书中的现有任务记录
      const existingTasksMap = new Map<string, string>(); // taskId -> record_id
      
      try {
        // 使用 records/list 接口获取所有记录
        let allRecords: any[] = [];
        let pageToken = '';
        
        do {
          const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.tasks}/records?page_size=500${pageToken ? `&page_token=${pageToken}` : ''}`;
          
          const listResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
          });

          const listData = await listResponse.json();
          log(`获取任务记录响应: code=${listData.code}, has_data=${!!listData.data}, items=${listData.data?.items?.length || 0}`);
          
          if (listData.code === 0 && listData.data && listData.data.items) {
            allRecords = allRecords.concat(listData.data.items);
            pageToken = listData.data.page_token || '';
          } else {
            log(`获取任务记录失败: ${JSON.stringify(listData)}`);
            break;
          }
        } while (pageToken);
        
        log(`总共获取到 ${allRecords.length} 个任务记录`);
        
        allRecords.forEach((item: any) => {
          log(`任务记录 - record_id=${item.record_id}, fields=${JSON.stringify(item.fields).substring(0, 200)}`);
          const taskId = item.fields[FEISHU_FIELD_IDS.tasks.id];
          if (taskId) {
            existingTasksMap.set(taskId, item.record_id);
            log(`✅ 映射任务: ${taskId} -> ${item.record_id}`);
          } else {
            log(`⚠️ 任务记录缺少 ID 字段: ${item.record_id}, 可用字段: ${Object.keys(item.fields).join(', ')}`);
          }
        });
        log(`飞书中已有 ${existingTasksMap.size} 个任务记录`);
      } catch (error) {
        log(`获取现有任务记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 收集系统中所有任务的ID
      const systemTaskIds = new Set(tasks.map(t => t.id));
      log(`系统中共有 ${systemTaskIds.size} 个任务`);

      // 同步每个任务
      for (const task of tasks) {
        try {
          // 如果任务有 projectName 字段（前端已处理），直接使用
          // 否则使用 projectsMap 将 projectId 转换为项目名称
          const taskForSync = task.projectName 
            ? task 
            : { 
                ...task, 
                projectName: (task.projectId && projectsMap) ? projectsMap[task.projectId] || '' : '' 
              };
          
          // 调试：输出任务的原始资源信息
          log(`[任务同步] 任务名称: ${taskForSync.name}, assignedResources: ${JSON.stringify(taskForSync.assignedResources)}, fixedResourceId: ${taskForSync.fixedResourceId}`);
          
          const taskRecord = taskToFeishuRecord(taskForSync, resourceIdToFeishuPersonIdMap);
          const existingRecordId = existingTasksMap.get(task.id);

          if (existingRecordId) {
            // 更新现有记录
            await fetch(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.tasks}/records/${existingRecordId}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${appAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields: taskRecord }),
              }
            );
            stats.tasks.updated++;
            log(`✅ 更新任务: ${task.name}`);
          } else {
            // 创建新记录
            await fetch(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.tasks}/records`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${appAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fields: taskRecord }),
              }
            );
            stats.tasks.created++;
            log(`✅ 创建任务: ${task.name}`);
          }
        } catch (error) {
          stats.tasks.failed++;
          const errorMsg = `任务 "${task.name}" 同步失败: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMsg);
          log(`❌ ${errorMsg}`);
        }
      }

      // 删除飞书中多余的任务记录
      for (const [taskId, recordId] of existingTasksMap.entries()) {
        if (!systemTaskIds.has(taskId)) {
          try {
            await fetch(
              `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.tasks}/records/${recordId}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${appAccessToken}`,
                },
              }
            );
            stats.tasks.deleted = (stats.tasks.deleted || 0) + 1;
            log(`🗑️ 删除多余任务: ${taskId}`);
          } catch (error) {
            log(`❌ 删除任务失败: ${taskId}, 错误: ${error instanceof Error ? error.message : '未知错误'}`);
          }
        }
      }
    } else {
      log('跳过任务同步：没有任务数据或任务数组为空');
    }

    log(`同步完成: ${JSON.stringify(stats)}`);

    return NextResponse.json({
      success: true,
      message: '同步完成',
      stats,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '同步失败',
        stats: null,
        errors: [error instanceof Error ? error.message : '未知错误'],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
