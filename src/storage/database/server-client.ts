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
  
  const [resourcesResult, tasksResult, calendarConfigResult] = await Promise.all([
    client.from('resources').select('*').order('name'),
    client.from('tasks').select('*').order('created_at', { ascending: false }),
    client.from('calendar_config').select('*').eq('config_key', 'extra_work_days').maybeSingle(),
  ]);

  if (resourcesResult.error) throw new Error(`获取资源失败: ${resourcesResult.error.message}`);
  if (tasksResult.error) throw new Error(`获取任务失败: ${tasksResult.error.message}`);

  return {
    resources: resourcesResult.data,
    tasks: tasksResult.data,
    calendarExtraWorkDays: (calendarConfigResult.data?.config_value as string[]) || [],
  };
}

// 同步任务到数据库
export async function syncTask(taskData: Record<string, unknown>) {
  const client = getSupabaseClient();
  const { error } = await client.from('tasks').upsert(taskData, { onConflict: 'id' });
  if (error) throw new Error(`同步任务失败: ${error.message}`);
}

// 批量同步任务
export async function syncTasksBatch(tasks: Record<string, unknown>[]) {
  if (tasks.length === 0) return;
  
  const client = getSupabaseClient();
  const { error } = await client.from('tasks').upsert(tasks, { onConflict: 'id' });
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
  const client = getSupabaseClient();
  const { error } = await client.from('calendar_config').upsert(
    { config_key: 'extra_work_days', config_value: days },
    { onConflict: 'config_key' }
  );
  if (error) throw new Error(`保存日历配置失败: ${error.message}`);
}
