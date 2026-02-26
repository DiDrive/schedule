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
 * 从飞书多维表加载排期系统数据
 *
 * 请求参数（通过 URL 传递）:
 * - app_token: 多维表格 App Token
 * - resources_table_id: 人员表 Table ID
 * - projects_table_id: 项目表 Table ID
 * - tasks_table_id: 任务表 Table ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('app_token');
    const resourcesTableId = searchParams.get('resources_table_id');
    const projectsTableId = searchParams.get('projects_table_id');
    const tasksTableId = searchParams.get('tasks_table_id');

    if (!appToken) {
      log('[飞书加载] ❌ 缺少 app_token');
      return NextResponse.json(
        { error: '缺少 app_token' },
        { status: 400 }
      );
    }

    const appAccessToken = await getAppAccessToken();
    log(`[飞书加载] 开始从多维表加载数据: app_token=${appToken.substring(0, 10)}...`);

    const result: any = {
      resources: [],
      projects: [],
      tasks: [],
    };

    // 加载人员数据
    if (resourcesTableId) {
      log(`[飞书加载] 加载人员数据: table_id=${resourcesTableId}`);
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
        result.resources = resourcesData.data.items.map((item: any) => ({
          id: item.record_id,
          name: item.fields.name || item.fields['姓名'] || item.fields['人员姓名'] || '',
          skills: item.fields.skills || item.fields['技能'] || [],
          availability: item.fields.availability ?? item.fields['可用性'] ?? 100,
          hourlyRate: item.fields.hourlyRate || item.fields['时薪'] || 0,
          email: item.fields.email || item.fields['邮箱'] || '',
        }));
        log(`[飞书加载] ✅ 加载了 ${result.resources.length} 个人员`);
      }
    }

    // 加载项目数据
    if (projectsTableId) {
      log(`[飞书加载] 加载项目数据: table_id=${projectsTableId}`);
      const projectsResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${projectsTableId}/records/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 100 }),
        }
      );

      const projectsData = await projectsResponse.json();
      if (projectsData.code === 0 && projectsData.data) {
        result.projects = projectsData.data.items.map((item: any) => ({
          id: item.record_id,
          name: item.fields.name || item.fields['项目名称'] || '',
          description: item.fields.description || item.fields['项目描述'] || '',
          priority: item.fields.priority || item.fields['优先级'] || 'medium',
          startDate: item.fields.startDate || item.fields['开始日期'],
          endDate: item.fields.endDate || item.fields['结束日期'],
          status: item.fields.status || item.fields['状态'] || 'pending',
        }));
        log(`[飞书加载] ✅ 加载了 ${result.projects.length} 个项目`);
      }
    }

    // 加载任务数据
    if (tasksTableId) {
      log(`[飞书加载] 加载任务数据: table_id=${tasksTableId}`);
      const tasksResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tasksTableId}/records/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 500 }),
        }
      );

      const tasksData = await tasksResponse.json();
      if (tasksData.code === 0 && tasksData.data) {
        result.tasks = tasksData.data.items.map((item: any) => ({
          id: item.record_id,
          name: item.fields.name || item.fields['任务名称'] || '',
          projectId: item.fields.projectId || item.fields['项目ID'] || '',
          assignedResourceId: item.fields.assignedResourceId || item.fields['负责人ID'] || '',
          estimatedHours: item.fields.estimatedHours || item.fields['预估工时'] || 8,
          priority: item.fields.priority || item.fields['优先级'] || 'medium',
          dependencies: item.fields.dependencies || item.fields['依赖项'] || [],
          status: item.fields.status || item.fields['状态'] || 'pending',
          deadline: item.fields.deadline || item.fields['截止日期'],
        }));
        log(`[飞书加载] ✅ 加载了 ${result.tasks.length} 个任务`);
      }
    }

    log('[飞书加载] ✅ 数据加载完成');

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书加载] ❌ 异常: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
