// 数据库服务（通过 API 路由调用）
// 由于客户端不能直接访问 Supabase，所有数据库操作都通过 /api/db 路由

const API_BASE = '/api/db';

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

export async function syncTasks(tasks: Array<Partial<DbTask> & { id: string }>): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_tasks',
      tasks: tasks.map(t => ({
        ...t,
        // deadline/start_date/end_date 已经是 string 或 undefined，无需转换
      })),
    }),
  });
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || '同步任务失败');
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
}): Promise<void> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_all',
      resources: data.resources,
      tasks: data.tasks?.map(t => ({
        ...t,
        // deadline/start_date/end_date 已经是 string 或 undefined，无需转换
      })),
      projects: data.projects,
      scheduleResult: data.scheduleResult,
      calendarExtraWorkDays: data.calendarExtraWorkDays,
    }),
  });
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || '同步数据失败');
  }
}
