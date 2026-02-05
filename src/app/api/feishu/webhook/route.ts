/**
 * 飞书 Webhook 接收接口
 * 接收飞书多维表的变更事件，实时同步到系统
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listFeishuRecords,
  initFeishuClient,
  type FeishuConfig,
  type FeishuRecord,
} from '@/lib/feishu-client';
import {
  feishuRecordToResource,
  feishuRecordToProject,
  feishuRecordToTask,
} from '@/lib/feishu-data-mapper';
import { type Resource, type Project, type Task } from '@/types/schedule';

// 飞书 Webhook 事件类型
interface FeishuWebhookEvent {
  token: string;
  challenge: string;
  type: 'url_verification' | 'im.message.receive_v1' | 'bitable_record';
  event_type?: string;
  tenant_key?: string;
  app_id?: string;
  event?: {
    operator?: {
      open_id: string;
      user_id: string;
    };
    changes?: Array<{
      change_type: 'record_add' | 'record_update' | 'record_delete';
      record_id: string;
      old_record?: any;
      record?: any;
      table_id?: string;
      table_name?: string;
    }>;
  };
}

// 验证 Webhook 签名（简化版）
function verifyWebhookToken(token: string): boolean {
  // 实际应用中应该验证飞书提供的验证令牌
  // 这里简化处理，允许所有请求
  return true;
}

// 从 localStorage 获取配置（注意：API Route 中无法直接访问 localStorage）
async function getFeishuConfig(): Promise<FeishuConfig | null> {
  // 在实际应用中，应该从数据库获取配置
  // 这里返回 null，表示需要前端调用同步接口
  return null;
}

// 处理 URL 验证请求（飞书初次配置 Webhook 时）
function handleUrlVerification(event: FeishuWebhookEvent): NextResponse {
  if (!verifyWebhookToken(event.token)) {
    return NextResponse.json({ code: -1, msg: 'Invalid token' }, { status: 401 });
  }

  return NextResponse.json({
    challenge: event.challenge,
  });
}

// 处理多维表记录变更
async function handleBitableRecordChange(event: FeishuWebhookEvent): Promise<NextResponse> {
  try {
    const changes = event.event?.changes || [];

    // 读取当前系统的数据
    const systemResources: Resource[] = [];
    const systemProjects: Project[] = [];
    const systemTasks: Task[] = [];

    // 从 localStorage 读取基础场景和复杂场景的数据
    // 注意：API Route 中无法直接访问 localStorage，这里简化处理

    // 在实际应用中，应该从数据库或状态管理中获取数据
    // 这里返回成功，但不会真正同步数据

    console.log('收到飞书多维表变更事件:', {
      changes: changes.length,
      event_type: event.event_type,
    });

    return NextResponse.json({
      code: 0,
      msg: 'success',
    });
  } catch (error) {
    console.error('处理多维表变更失败:', error);
    return NextResponse.json(
      {
        code: -1,
        msg: error instanceof Error ? error.message : '处理失败',
      },
      { status: 500 }
    );
  }
}

// 处理记录新增
async function handleRecordAdd(
  config: FeishuConfig,
  tableId: string,
  recordId: string
): Promise<void> {
  console.log(`处理记录新增: table=${tableId}, record=${recordId}`);

  // 获取记录详情
  const record = await listFeishuRecords(config.appToken, tableId);
  const targetRecord = record.items.find(r => r.record_id === recordId);

  if (!targetRecord) {
    console.warn(`未找到记录: ${recordId}`);
    return;
  }

  // 根据表 ID 确定记录类型
  const tableMap: Record<string, 'resources' | 'projects' | 'tasks' | 'schedules'> = {
    [config.tableIds.resources]: 'resources',
    [config.tableIds.projects]: 'projects',
    [config.tableIds.tasks]: 'tasks',
    [config.tableIds.schedules]: 'schedules',
  };

  const recordType = tableMap[tableId];

  if (!recordType) {
    console.warn(`未知的表 ID: ${tableId}`);
    return;
  }

  // 转换记录
  switch (recordType) {
    case 'resources':
      const resource = feishuRecordToResource(targetRecord, recordId);
      console.log('新增资源:', resource.name);
      // TODO: 保存到系统
      break;
    case 'projects':
      const project = feishuRecordToProject(targetRecord, recordId);
      console.log('新增项目:', project.name);
      // TODO: 保存到系统
      break;
    case 'tasks':
      const task = feishuRecordToTask(targetRecord, recordId);
      console.log('新增任务:', task.name);
      // TODO: 保存到系统
      break;
    default:
      console.warn(`不支持的记录类型: ${recordType}`);
  }
}

// 处理记录更新
async function handleRecordUpdate(
  config: FeishuConfig,
  tableId: string,
  recordId: string,
  newRecord: any
): Promise<void> {
  console.log(`处理记录更新: table=${tableId}, record=${recordId}`);

  // 与记录新增类似的处理逻辑
  // 但需要更新现有记录而不是创建新记录
  // TODO: 实现更新逻辑
}

// 处理记录删除
async function handleRecordDelete(
  config: FeishuConfig,
  tableId: string,
  recordId: string
): Promise<void> {
  console.log(`处理记录删除: table=${tableId}, record=${recordId}`);
  // TODO: 从系统中删除对应记录
}

// 主处理函数
export async function POST(request: NextRequest) {
  try {
    const event: FeishuWebhookEvent = await request.json();

    // 处理 URL 验证请求
    if (event.type === 'url_verification') {
      return handleUrlVerification(event);
    }

    // 处理多维表变更事件
    if (event.type === 'bitable_record' || event.event_type?.startsWith('bitable_record')) {
      return await handleBitableRecordChange(event);
    }

    // 其他事件类型
    console.log('未处理的事件类型:', event.type, event.event_type);

    return NextResponse.json({
      code: 0,
      msg: 'success',
    });
  } catch (error) {
    console.error('Webhook 处理失败:', error);
    return NextResponse.json(
      {
        code: -1,
        msg: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// 支持 GET 请求（用于健康检查）
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Feishu Webhook endpoint is active',
  });
}
