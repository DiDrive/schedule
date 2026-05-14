// 数据库服务（通过 API 路由调用）
// 由于客户端不能直接访问 Supabase，所有数据库操作都通过 /api/db 路由

const API_BASE = '/api/db';
const TASK_BATCH_SIZE = 200;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface DbTask {
  id: string;
  name: string;
  description?: string;
  estimated_hours?: number;
  assigned_resources?: string[];
  deadline?: string;
  priority?: string;
  status?: string;
  task_type?: string;
  project_id?: string;
  project_name?: string;
  start_date?: string;
  end_date?: string;
  category?: string;
  sub_type?: string;
  language?: string;
  dubbing?: string;
  contact_person?: string;
  business_month?: string;
  local_sub_tasks?: unknown[];
  resource_assignments?: unknown[];
  feishu_record_id?: string;
  task_source?: string;
  source_view_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface DbResource {
  id: string;
  name: string;
  type?: string;
  work_type?: string;
  level?: string;
  capacity?: number;
  is_active?: boolean;
  metadata?: unknown;
  created_at?: string;
  updated_at?: string;
}

interface DbProject {
  id: string;
  name: string;
  description?: string;
  priority?: 'urgent' | 'normal';
  resourcePool?: string[];
  color?: string;
}

interface LoadDataResult {
  resources: DbResource[];
  tasks: DbTask[];
  matrixTasks: DbTask[];
  projects: DbProject[];
  scheduleResult: unknown | null;
  calendarExtraWorkDays: string[];
}

export async function loadAllData(): Promise<LoadDataResult> {
  const response = await fetch(API_BASE);
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || '加载数据失败');
  }
  
  return result.data;
}

export async function deleteTasks(taskIds: string[]): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete_tasks',
      taskIds,
    }),
  });
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '删除任务失败');
  }
}

export async function syncTasks(
  tasks: Array<Partial<DbTask> & { id: string }>,
  options?: { replaceMatrixViews?: string[] }
): Promise<void> {
  const normalizedTasks = tasks.map(t => ({
    ...t,
    // deadline/start_date/end_date 已经是 string 或 undefined，无需转换
  }));
  const replaceMatrixViews = Array.from(new Set((options?.replaceMatrixViews || []).map(v => String(v || '').trim()).filter(Boolean)));
  const batches = chunkArray(normalizedTasks, TASK_BATCH_SIZE);
  if (batches.length > 1) {
    console.info(`[DB同步] 任务分批写入开始: total=${normalizedTasks.length}, batches=${batches.length}, batchSize=${TASK_BATCH_SIZE}`);
  }

  for (const [index, batch] of batches.entries()) {
    if (batches.length > 1) {
      console.info(`[DB同步] 任务分批写入: batch ${index + 1}/${batches.length}, size=${batch.length}`);
    }
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_tasks',
        tasks: batch,
      }),
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '同步任务失败');
    }
  }

  if (replaceMatrixViews.length > 0) {
    const replaceViewSet = new Set(replaceMatrixViews);
    const matrixTasksForReplace = normalizedTasks.filter((task) => {
      return (
        String((task as { task_source?: string }).task_source || '').trim() === 'matrix_view' &&
        replaceViewSet.has(String((task as { source_view_id?: string }).source_view_id || '').trim()) &&
        Boolean(String((task as { feishu_record_id?: string }).feishu_record_id || '').trim())
      );
    });

    if (matrixTasksForReplace.length > 0) {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_tasks',
          tasks: matrixTasksForReplace,
          replaceMatrixViews,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '同步任务失败');
      }
    }
  }

  if (batches.length > 1) {
    console.info('[DB同步] 任务分批写入完成');
  }
}

export async function syncResources(resources: Array<Partial<DbResource> & { id: string }>): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_resources',
      resources,
    }),
  });
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || '同步资源失败');
  }
}

export async function syncCalendarExtraWorkDays(days: string[]): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_calendar',
      calendarExtraWorkDays: days,
    }),
  });
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || '同步日历配置失败');
  }
}

export async function syncAllData(data: {
  resources?: Array<Partial<DbResource> & { id: string }>;
  tasks?: Array<Partial<DbTask> & { id: string }>;
  projects?: Array<Partial<DbProject> & { id: string }>;
  scheduleResult?: unknown | null;
  calendarExtraWorkDays?: string[];
  replaceMatrixViews?: string[];
  replaceResources?: boolean;
}): Promise<void> {
  // 任务量大时分批同步，避免单请求过大导致网络中断或网关超时
  if (data.tasks && data.tasks.length > 0) {
    await syncTasks(data.tasks, { replaceMatrixViews: data.replaceMatrixViews });
  }

  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_all',
      resources: data.resources,
      // tasks 已由 syncTasks 分批完成
      projects: data.projects,
      scheduleResult: data.scheduleResult,
      calendarExtraWorkDays: data.calendarExtraWorkDays,
      replaceMatrixViews: data.replaceMatrixViews,
      replaceResources: Boolean(data.replaceResources),
    }),
  });
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || '同步数据失败');
  }
}
