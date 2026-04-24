import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 服务端 Supabase 客户端
let supabaseClient: SupabaseClient | null = null;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function loadEnv(): void {
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
    return;
  }

  try {
    // 尝试从 Python SDK 加载环境变量
    const { execSync } = require('child_process');
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // 静默失败
  }
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured. Please ensure Supabase service is enabled.');
  }

  return { url, anonKey };
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = getSupabaseCredentials();
  supabaseClient = createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

// 从数据库获取所有数据
export async function getAllData() {
  const client = getSupabaseClient();
  
  const [resourcesResult, tasksResult, calendarExtraWorkDaysResult] = await Promise.all([
    client.from('resources').select('*').order('name'),
    client.from('tasks').select('*').order('created_at', { ascending: false }),
    client.from('calendar_config').select('config_value').eq('config_key', 'extra_work_days').maybeSingle(),
  ]);

  if (resourcesResult.error) throw new Error(`获取资源失败: ${resourcesResult.error.message}`);
  if (tasksResult.error) throw new Error(`获取任务失败: ${tasksResult.error.message}`);
  if (calendarExtraWorkDaysResult.error) throw new Error(`获取配置失败: ${calendarExtraWorkDaysResult.error.message}`);

  // projects：优先新表，兼容回退 legacy 配置
  let projects: Record<string, unknown>[] = [];
  const projectsResult = await client.from('projects').select('*').order('created_at', { ascending: true });
  if (!projectsResult.error) {
    projects = (projectsResult.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      priority: row.priority || 'normal',
      color: row.color || undefined,
      resourcePool: Array.isArray(row.resource_pool) ? row.resource_pool : [],
      tasks: [],
    }));
  } else if (isSchemaMissingError(projectsResult.error)) {
    projects = (await getLegacyConfigValue('projects_data')) as Record<string, unknown>[] || [];
  } else {
    throw new Error(`获取项目失败: ${projectsResult.error.message}`);
  }

  // scheduleResult：优先新表，兼容回退 legacy 配置
  let rawScheduleResult: Record<string, unknown> | null = null;
  const scheduleResultQuery = await client
    .from('schedule_results')
    .select('result')
    .eq('id', 'default')
    .maybeSingle();

  if (!scheduleResultQuery.error) {
    rawScheduleResult = (scheduleResultQuery.data?.result as Record<string, unknown>) || null;
  } else if (isSchemaMissingError(scheduleResultQuery.error)) {
    rawScheduleResult = (await getLegacyConfigValue('schedule_result')) as Record<string, unknown> | null;
  } else {
    throw new Error(`获取排期结果失败: ${scheduleResultQuery.error.message}`);
  }

  const scheduleResult =
    rawScheduleResult &&
    typeof rawScheduleResult === 'object' &&
    Object.keys(rawScheduleResult).length === 0
      ? null
      : rawScheduleResult || null;

  return {
    resources: resourcesResult.data,
    tasks: tasksResult.data,
    projects,
    scheduleResult,
    calendarExtraWorkDays: (calendarExtraWorkDaysResult.data?.config_value as string[]) || [],
  };
}

// 同步任务到数据库
export async function syncTask(taskData: Record<string, unknown>) {
  const client = getSupabaseClient();
  const normalized = normalizeTaskRecord(taskData);
  const { error } = await client.from('tasks').upsert(normalized, { onConflict: 'id' });
  if (error) throw new Error(`同步任务失败: ${error.message}`);
}

// 批量同步任务
export async function syncTasksBatch(tasks: Record<string, unknown>[]) {
  if (tasks.length === 0) return;
  
  const client = getSupabaseClient();
  const normalizedTasks = tasks.map(normalizeTaskRecord);
  const { error } = await client.from('tasks').upsert(normalizedTasks, { onConflict: 'id' });
  if (error) throw new Error(`批量同步任务失败: ${error.message}`);
}

// 批量同步资源
export async function syncResourcesBatch(resources: Record<string, unknown>[]) {
  if (resources.length === 0) return;
  
  const client = getSupabaseClient();
  const { error } = await client.from('resources').upsert(resources, { onConflict: 'id' });
  if (error) throw new Error(`批量同步资源失败: ${error.message}`);
}

// 设置日历配置
export async function setCalendarExtraWorkDays(days: string[]) {
  await setConfigValue('extra_work_days', days);
}

export async function setProjectsData(projects: Record<string, unknown>[]) {
  const client = getSupabaseClient();
  const payload = projects.map((project: any) => ({
    id: String(project.id || ''),
    name: String(project.name || ''),
    description: project.description ? String(project.description) : null,
    priority: project.priority ? String(project.priority) : 'normal',
    color: project.color ? String(project.color) : null,
    resource_pool: Array.isArray(project.resourcePool) ? project.resourcePool : [],
    status: 'active',
  }));

  const { error } = await client.from('projects').upsert(payload, { onConflict: 'id' });
  if (!error) {
    return;
  }
  if (isSchemaMissingError(error)) {
    await setConfigValue('projects_data', projects);
    return;
  }
  throw new Error(`保存项目失败: ${error.message}`);
}

export async function setScheduleResult(scheduleResult: Record<string, unknown> | null) {
  const client = getSupabaseClient();
  const { error } = await client.from('schedule_results').upsert(
    {
      id: 'default',
      result: scheduleResult ?? {},
    },
    { onConflict: 'id' }
  );

  if (!error) {
    return;
  }
  if (isSchemaMissingError(error)) {
    await setConfigValue('schedule_result', scheduleResult ?? {});
    return;
  }
  throw new Error(`保存排期结果失败: ${error.message}`);
}

async function setConfigValue(configKey: string, configValue: unknown) {
  const client = getSupabaseClient();
  const { error } = await client.from('calendar_config').upsert(
    { config_key: configKey, config_value: configValue },
    { onConflict: 'config_key' }
  );
  if (error) throw new Error(`保存配置失败(${configKey}): ${error.message}`);
}

async function getLegacyConfigValue(configKey: string): Promise<unknown> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('calendar_config')
    .select('config_value')
    .eq('config_key', configKey)
    .maybeSingle();
  if (error) {
    throw new Error(`读取兼容配置失败(${configKey}): ${error.message}`);
  }
  return data?.config_value;
}

function isSchemaMissingError(error: { code?: string; message?: string }): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    /does not exist/i.test(error?.message || '')
  );
}

function normalizeTaskRecord(task: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...task };

  // 保留小数工时精度（例如 0.5 小时）
  // 数据库字段应为 numeric(10,2)，这里统一标准化为 2 位小数
  const rawHours = normalized.estimated_hours;
  if (rawHours !== undefined && rawHours !== null) {
    const parsed = Number(rawHours);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      normalized.estimated_hours = Math.max(0, Math.round(parsed * 100) / 100);
    } else {
      normalized.estimated_hours = 0;
    }
  }

  return normalized;
}
