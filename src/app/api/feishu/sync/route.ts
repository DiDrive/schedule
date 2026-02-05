/**
 * 飞书同步 API 接口
 * 提供手动同步和定时同步功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncToFeishu, type SyncOptions, type SyncResult } from '@/lib/feishu-sync-service';
import { type FeishuConfig } from '@/lib/feishu-client';
import { type Resource, type Project, type Task, type ScheduleResult } from '@/types/schedule';

// 模拟获取系统数据（实际应该从数据库获取）
function getSystemData(): {
  resources: Resource[];
  projects: Project[];
  tasks: Task[];
  schedules: ScheduleResult[];
} {
  // 从 localStorage 获取数据（通过前端传递）
  // 这里返回空数组，实际应该从数据库或状态管理中获取
  return {
    resources: [],
    projects: [],
    tasks: [],
    schedules: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 获取配置
    const config: FeishuConfig = {
      appId: body.config?.appId || '',
      appSecret: body.config?.appSecret || '',
      appToken: body.config?.appToken || '',
      tableIds: body.config?.tableIds || {
        resources: '',
        projects: '',
        tasks: '',
        schedules: '',
      },
    };

    // 获取系统数据
    const systemData = body.systemData || {
      resources: [],
      projects: [],
      tasks: [],
      schedules: [],
    };

    // 同步选项
    const options: SyncOptions = {
      conflictResolution: body.options?.conflictResolution || 'feishu',
      syncResources: body.options?.syncResources !== false,
      syncProjects: body.options?.syncProjects !== false,
      syncTasks: body.options?.syncTasks !== false,
      syncSchedules: body.options?.syncSchedules !== false,
    };

    // 执行同步
    const result: SyncResult = await syncToFeishu(
      config,
      systemData.resources,
      systemData.projects,
      systemData.tasks,
      systemData.schedules,
      options
    );

    // 更新同步状态到 localStorage（通过前端处理）
    // API Route 无法直接访问 localStorage

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: result.stats,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('同步失败:', error);
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

// GET 请求返回同步状态
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Feishu sync endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
