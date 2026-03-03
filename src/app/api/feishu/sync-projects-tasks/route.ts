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
 * - config: 飞书配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projects, tasks, config } = body;

    if (!config) {
      return NextResponse.json(
        { success: false, message: '缺少飞书配置' },
        { status: 400 }
      );
    }

    const { appId, appSecret, appToken, tableIds } = config;

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

    // 获取飞书访问令牌
    const appAccessToken = await getAppAccessToken(appId, appSecret);
    log('成功获取飞书访问令牌');

    const stats = {
      projects: { created: 0, updated: 0, failed: 0 },
      tasks: { created: 0, updated: 0, failed: 0 },
    };
    const errors: string[] = [];

    // 1. 同步项目数据
    if (projects && Array.isArray(projects)) {
      log(`开始同步 ${projects.length} 个项目`);
      
      // 先获取飞书中的现有项目记录
      const existingProjectsMap = new Map<string, string>(); // projectId -> record_id
      
      try {
        const listResponse = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.projects}/records/search`,
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
        if (listData.code === 0 && listData.data) {
          listData.data.items.forEach((item: any) => {
            const projectId = item.fields[FEISHU_FIELD_IDS.projects.id];
            if (projectId) {
              existingProjectsMap.set(projectId, item.record_id);
            }
          });
          log(`飞书中已有 ${existingProjectsMap.size} 个项目记录`);
        }
      } catch (error) {
        log(`获取现有项目记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

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
    }

    // 2. 同步任务数据
    if (tasks && Array.isArray(tasks)) {
      log(`开始同步 ${tasks.length} 个任务`);
      
      // 先获取飞书中的现有任务记录
      const existingTasksMap = new Map<string, string>(); // taskId -> record_id
      
      try {
        const listResponse = await fetch(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableIds.tasks}/records/search`,
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
        if (listData.code === 0 && listData.data) {
          listData.data.items.forEach((item: any) => {
            const taskId = item.fields[FEISHU_FIELD_IDS.tasks.id];
            if (taskId) {
              existingTasksMap.set(taskId, item.record_id);
            }
          });
          log(`飞书中已有 ${existingTasksMap.size} 个任务记录`);
        }
      } catch (error) {
        log(`获取现有任务记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 同步每个任务
      for (const task of tasks) {
        try {
          const taskRecord = taskToFeishuRecord(task);
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
