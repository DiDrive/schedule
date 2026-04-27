-- Step 3: 拆分 projects / schedule_result 到独立表结构
-- 在 Supabase SQL Editor 执行本脚本

-- 0) 保留工时小数精度（例如 0.5 小时）
alter table if exists public.tasks
  alter column estimated_hours type numeric(10,2)
  using estimated_hours::numeric(10,2);

-- 1) 扩展 projects 表
alter table if exists public.projects
  add column if not exists priority varchar(20) default 'normal',
  add column if not exists color varchar(20),
  add column if not exists resource_pool jsonb default '[]'::jsonb;

-- 2) 创建 schedule_results 表
create table if not exists public.schedule_results (
  id varchar(64) primary key,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 3) 迁移 legacy 配置中的 projects_data -> projects 表
insert into public.projects (id, name, description, priority, color, resource_pool, status, created_at)
select
  coalesce(item->>'id', gen_random_uuid()::text) as id,
  coalesce(item->>'name', '未命名项目') as name,
  nullif(item->>'description', '') as description,
  coalesce(nullif(item->>'priority', ''), 'normal') as priority,
  nullif(item->>'color', '') as color,
  coalesce(item->'resourcePool', '[]'::jsonb) as resource_pool,
  'active' as status,
  now() as created_at
from (
  select jsonb_array_elements(config_value) as item
  from public.calendar_config
  where config_key = 'projects_data'
) t
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  priority = excluded.priority,
  color = excluded.color,
  resource_pool = excluded.resource_pool,
  updated_at = now();

-- 4) 迁移 legacy 配置中的 schedule_result -> schedule_results 表
insert into public.schedule_results (id, result, updated_at)
select 'default', config_value, now()
from public.calendar_config
where config_key = 'schedule_result'
on conflict (id) do update set
  result = excluded.result,
  updated_at = now();

-- 5) tasks 表按来源分层（矩阵视图 / 排期主任务）
alter table if exists public.tasks
  add column if not exists task_source varchar(30) default 'schedule',
  add column if not exists source_view_id varchar(100);

create index if not exists tasks_task_source_idx on public.tasks(task_source);
create index if not exists tasks_source_view_id_idx on public.tasks(source_view_id);

-- 矩阵视图任务以飞书记录ID去重（同一来源+同一视图下唯一）
create unique index if not exists tasks_matrix_view_record_unique_idx
  on public.tasks(task_source, source_view_id, feishu_record_id)
  where task_source = 'matrix_view' and feishu_record_id is not null;
