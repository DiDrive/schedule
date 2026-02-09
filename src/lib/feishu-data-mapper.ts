/**
 * 飞书数据映射模块
 * 负责系统数据与飞书多维表数据的双向转换
 */

import { Resource, Project, Task, ScheduleResult } from '@/types/schedule';
import {
  FeishuResource,
  FeishuProject,
  FeishuTask,
  FeishuScheduleResult,
} from '@/types/feishu-extended';

// 飞书字段ID常量
export const FEISHU_FIELD_IDS = {
  // 人员表
  resources: {
    id: 'id',
    name: 'name',
    type: 'type',
    efficiency: 'efficiency',
    feishu_user: 'feishu_user',
    total_hours: 'total_hours',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
  // 项目表
  projects: {
    id: 'id',
    name: 'name',
    description: 'description',
    start_date: 'start_date',
    end_date: 'end_date',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
  // 任务表
  tasks: {
    id: 'id',
    name: 'name',
    project: 'project',
    type: 'type',
    estimated_hours: 'estimated_hours',
    actual_hours: 'actual_hours',
    start_time: 'start_time',
    end_time: 'end_time',
    deadline: 'deadline',
    priority: 'priority',
    assignee: 'assignee',
    dependencies: 'dependencies',
    status: 'status',
    is_overdue: 'is_overdue',
    feishu_version: 'feishu_version',
    system_version: 'system_version',
    last_synced_at: 'last_synced_at',
    sync_source: 'sync_source',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
  // 排期表
  schedules: {
    id: 'id',
    project: 'project',
    name: 'name',
    version: 'version',
    task_count: 'task_count',
    total_hours: 'total_hours',
    utilization: 'utilization',
    critical_path_count: 'critical_path_count',
    start_time: 'start_time',
    end_time: 'end_time',
    generated_at: 'generated_at',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
};

// 飞书单选值映射
export const FEISHU_OPTION_VALUES = {
  resourceType: {
    '平面设计': 'graphic',
    '后期制作': 'post',
    '物料': 'material',
  },
  projectStatus: {
    '未开始': 'not_started',
    '进行中': 'in_progress',
    '已完成': 'completed',
    '已暂停': 'paused',
  },
  taskType: {
    '平面设计': 'graphic',
    '后期制作': 'post',
    '物料': 'material',
  },
  taskPriority: {
    '高': 'high',
    '中': 'medium',
    '低': 'low',
  },
  taskStatus: {
    '未开始': 'not_started',
    '进行中': 'in_progress',
    '已完成': 'completed',
    '已暂停': 'paused',
    '已超期': 'overdue',
  },
  syncSource: {
    '系统': 'system',
    '飞书': 'feishu',
    '手动': 'manual',
  },
};

// 反向映射（系统值 → 飞书显示值）
const REVERSE_OPTION_VALUES: Record<string, Record<string, string>> = {};
Object.entries(FEISHU_OPTION_VALUES).forEach(([category, values]) => {
  REVERSE_OPTION_VALUES[category] = {};
  Object.entries(values).forEach(([label, value]) => {
    REVERSE_OPTION_VALUES[category][value] = label;
  });
});

/**
 * 将日期对象转换为飞书日期格式
 * 对于不包含时间的日期字段，返回秒级时间戳
 * 对于包含时间的日期字段，返回毫秒级时间戳
 */
function dateToFeishuDate(date: Date | null | undefined, includeTime: boolean = false): number | null {
  if (!date) return null;

  if (includeTime) {
    // 包含时间的日期：返回毫秒级时间戳
    return date.getTime();
  } else {
    // 不包含时间的日期：返回秒级时间戳
    return Math.floor(date.getTime() / 1000);
  }
}

/**
 * 将飞书日期格式转换为日期对象
 */
function feishuDateToDate(timestamp: number | null | undefined): Date | null {
  if (!timestamp || timestamp === 0) return null;
  return new Date(timestamp);
}

/**
 * 将系统资源转换为飞书记录格式
 */
export function resourceToFeishuRecord(resource: Resource): Record<string, any> {
  const record: Record<string, any> = {
    [FEISHU_FIELD_IDS.resources.id]: resource.id,
    [FEISHU_FIELD_IDS.resources.name]: resource.name,
    [FEISHU_FIELD_IDS.resources.type]: resource.workType === '平面' ? '平面设计' : resource.workType === '后期' ? '后期制作' : '物料',
    [FEISHU_FIELD_IDS.resources.efficiency]: Number(resource.efficiency || 1),
    [FEISHU_FIELD_IDS.resources.total_hours]: 0,
  };

  // 只添加日期字段，如果值不为 null
  const now = new Date();
  const createdAt = dateToFeishuDate(now, true);
  const updatedAt = dateToFeishuDate(now, true);

  if (createdAt !== null) {
    record[FEISHU_FIELD_IDS.resources.created_at] = createdAt;
  }

  if (updatedAt !== null) {
    record[FEISHU_FIELD_IDS.resources.updated_at] = updatedAt;
  }

  return record;
}

/**
 * 将飞书记录转换为系统资源
 */
export function feishuRecordToResource(record: Record<string, any>, recordId: string): Resource {
  const fields = record.fields || {};
  const resourceType = fields[FEISHU_FIELD_IDS.resources.type] as string;

  return {
    id: fields[FEISHU_FIELD_IDS.resources.id] as string || recordId,
    name: fields[FEISHU_FIELD_IDS.resources.name] as string || '',
    type: 'human',
    workType: resourceType === '平面设计' ? '平面' : resourceType === '后期制作' ? '后期' : '物料',
    efficiency: (fields[FEISHU_FIELD_IDS.resources.efficiency] as number) || 1,
    availability: 1,
  };
}

/**
 * 将系统项目转换为飞书记录格式
 */
export function projectToFeishuRecord(project: Project): Record<string, any> {
  const record: Record<string, any> = {
    [FEISHU_FIELD_IDS.projects.id]: project.id,
    [FEISHU_FIELD_IDS.projects.name]: project.name,
    [FEISHU_FIELD_IDS.projects.description]: project.description || '',
    [FEISHU_FIELD_IDS.projects.status]: '进行中',
  };

  // 只添加日期字段，如果值不为 null
  const startDate = dateToFeishuDate(project.startDate, false);
  const endDate = dateToFeishuDate(project.deadline, false);
  const now = new Date();
  const createdAt = dateToFeishuDate(now, true);
  const updatedAt = dateToFeishuDate(now, true);

  if (startDate !== null) {
    record[FEISHU_FIELD_IDS.projects.start_date] = startDate;
  }

  if (endDate !== null) {
    record[FEISHU_FIELD_IDS.projects.end_date] = endDate;
  }

  if (createdAt !== null) {
    record[FEISHU_FIELD_IDS.projects.created_at] = createdAt;
  }

  if (updatedAt !== null) {
    record[FEISHU_FIELD_IDS.projects.updated_at] = updatedAt;
  }

  return record;
}

/**
 * 将飞书记录转换为系统项目
 */
export function feishuRecordToProject(record: Record<string, any>, recordId: string): Project {
  const fields = record.fields || {};
  const status = fields[FEISHU_FIELD_IDS.projects.status] as string;

  return {
    id: fields[FEISHU_FIELD_IDS.projects.id] as string || recordId,
    name: fields[FEISHU_FIELD_IDS.projects.name] as string || '',
    description: fields[FEISHU_FIELD_IDS.projects.description] as string || '',
    priority: 5,
    tasks: [],
    resourcePool: [],
    startDate: feishuDateToDate(fields[FEISHU_FIELD_IDS.projects.start_date] as number) || undefined,
    deadline: feishuDateToDate(fields[FEISHU_FIELD_IDS.projects.end_date] as number) || undefined,
  };
}

/**
 * 将系统任务转换为飞书记录格式
 */
export function taskToFeishuRecord(task: Task): Record<string, any> {
  const record: Record<string, any> = {
    [FEISHU_FIELD_IDS.tasks.id]: task.id,
    [FEISHU_FIELD_IDS.tasks.name]: task.name,
    [FEISHU_FIELD_IDS.tasks.type]: task.taskType === '平面' ? '平面设计' : task.taskType === '后期' ? '后期制作' : '物料',
    [FEISHU_FIELD_IDS.tasks.estimated_hours]: task.estimatedHours,
    [FEISHU_FIELD_IDS.tasks.actual_hours]: 0,
    [FEISHU_FIELD_IDS.tasks.priority]: task.priority === 'urgent' || task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中',
    [FEISHU_FIELD_IDS.tasks.status]: task.status === 'pending' ? '未开始' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已暂停',
    [FEISHU_FIELD_IDS.tasks.is_overdue]: false,
    [FEISHU_FIELD_IDS.tasks.feishu_version]: 0,
    [FEISHU_FIELD_IDS.tasks.system_version]: 0,
    [FEISHU_FIELD_IDS.tasks.sync_source]: '系统',
  };

  // 只添加日期字段，如果值不为 null
  const startTime = dateToFeishuDate(task.startDate, true);
  const endTime = dateToFeishuDate(task.endDate, true);
  const deadline = dateToFeishuDate(task.deadline, true);
  const lastSyncedAt = dateToFeishuDate(new Date(), true);
  const now = new Date();
  const createdAt = dateToFeishuDate(now, true);
  const updatedAt = dateToFeishuDate(now, true);

  if (startTime !== null) {
    record[FEISHU_FIELD_IDS.tasks.start_time] = startTime;
  }

  if (endTime !== null) {
    record[FEISHU_FIELD_IDS.tasks.end_time] = endTime;
  }

  if (deadline !== null) {
    record[FEISHU_FIELD_IDS.tasks.deadline] = deadline;
  }

  if (lastSyncedAt !== null) {
    record[FEISHU_FIELD_IDS.tasks.last_synced_at] = lastSyncedAt;
  }

  if (createdAt !== null) {
    record[FEISHU_FIELD_IDS.tasks.created_at] = createdAt;
  }

  if (updatedAt !== null) {
    record[FEISHU_FIELD_IDS.tasks.updated_at] = updatedAt;
  }

  // 处理关联字段
  if (task.projectId) {
    record[FEISHU_FIELD_IDS.tasks.project] = [task.projectId];
  } else {
    record[FEISHU_FIELD_IDS.tasks.project] = [];
  }

  if (task.assignedResources && task.assignedResources.length > 0) {
    record[FEISHU_FIELD_IDS.tasks.assignee] = task.assignedResources;
  } else {
    record[FEISHU_FIELD_IDS.tasks.assignee] = [];
  }

  if (task.dependencies && task.dependencies.length > 0) {
    record[FEISHU_FIELD_IDS.tasks.dependencies] = task.dependencies;
  } else {
    record[FEISHU_FIELD_IDS.tasks.dependencies] = [];
  }

  return record;
}

/**
 * 将飞书记录转换为系统任务
 */
export function feishuRecordToTask(record: Record<string, any>, recordId: string): Task {
  const fields = record.fields || {};

  return {
    id: fields[FEISHU_FIELD_IDS.tasks.id] as string || recordId,
    name: fields[FEISHU_FIELD_IDS.tasks.name] as string || '',
    taskType: fields[FEISHU_FIELD_IDS.tasks.type] === '平面设计' ? '平面' : fields[FEISHU_FIELD_IDS.tasks.type] === '后期制作' ? '后期' : '物料',
    projectId: (fields[FEISHU_FIELD_IDS.tasks.project] as string)?.[0] || undefined,
    estimatedHours: (fields[FEISHU_FIELD_IDS.tasks.estimated_hours] as number) || 0,
    assignedResources: (fields[FEISHU_FIELD_IDS.tasks.assignee] as string[]) || [],
    dependencies: (fields[FEISHU_FIELD_IDS.tasks.dependencies] as string[]) || [],
    status: fields[FEISHU_FIELD_IDS.tasks.status] === '未开始' ? 'pending' : fields[FEISHU_FIELD_IDS.tasks.status] === '进行中' ? 'in-progress' : fields[FEISHU_FIELD_IDS.tasks.status] === '已完成' ? 'completed' : 'blocked',
    priority: fields[FEISHU_FIELD_IDS.tasks.priority] === '高' ? 'high' : fields[FEISHU_FIELD_IDS.tasks.priority] === '低' ? 'low' : 'normal',
    deadline: feishuDateToDate(fields[FEISHU_FIELD_IDS.tasks.deadline] as number) || undefined,
    startDate: feishuDateToDate(fields[FEISHU_FIELD_IDS.tasks.start_time] as number) || undefined,
    endDate: feishuDateToDate(fields[FEISHU_FIELD_IDS.tasks.end_time] as number) || undefined,
  };
}

/**
 * 将系统排期结果转换为飞书记录格式
 */
export function scheduleToFeishuRecord(schedule: ScheduleResult): Record<string, any> {
  // 确保 tasks 存在
  const tasks = schedule.tasks || [];

  // 计算总工时
  const totalHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);

  // 计算资源利用率（简单计算）
  const utilization = tasks.length > 0 ? 0.85 : 0;

  // 获取排期时间范围
  const startTime = tasks.length > 0
    ? tasks.reduce((min, task) => task.startDate && task.startDate < min ? task.startDate : min, tasks[0].startDate!)
    : null;

  const endTime = tasks.length > 0
    ? tasks.reduce((max, task) => task.endDate && task.endDate > max ? task.endDate : max, tasks[0].endDate!)
    : null;

  // 获取第一个任务的项目ID
  const projectId = tasks[0]?.projectId || '';

  return {
    [FEISHU_FIELD_IDS.schedules.id]: `schedule-${Date.now()}`,
    [FEISHU_FIELD_IDS.schedules.project]: projectId ? [projectId] : [],
    [FEISHU_FIELD_IDS.schedules.name]: `排期 ${new Date().toLocaleString('zh-CN')}`,
    [FEISHU_FIELD_IDS.schedules.version]: 1,
    [FEISHU_FIELD_IDS.schedules.task_count]: tasks.length,
    [FEISHU_FIELD_IDS.schedules.total_hours]: Math.round(totalHours * 10) / 10,
    [FEISHU_FIELD_IDS.schedules.utilization]: Math.round(utilization * 100),
    [FEISHU_FIELD_IDS.schedules.critical_path_count]: schedule.criticalPath.length,

  };
}

/**
 * 将飞书记录转换为系统排期结果
 */
export function feishuRecordToSchedule(record: Record<string, any>, tasks: Task[]): ScheduleResult | null {
  const fields = record.fields || {};
  const projectId = (fields[FEISHU_FIELD_IDS.schedules.project] as string)?.[0];

  if (!projectId) return null;

  // 确保 tasks 存在
  const validTasks = tasks || [];

  // 过滤出该项目的任务
  const projectTasks = validTasks.filter(t => t.projectId === projectId);

  // 计算关键路径（简化处理）
  const criticalPath = projectTasks.slice(0, Math.ceil(projectTasks.length * 0.3)).map(t => t.id);

  // 创建项目对象
  const project: Project = {
    id: projectId,
    name: '飞书导入项目',
    priority: 5,
    tasks: projectTasks,
    resourcePool: [],
  };

  return {
    tasks: projectTasks,
    projects: [project],
    criticalPath,
    criticalChain: [],
    resourceConflicts: [],
    resourceUtilization: {},
    totalDuration: 0,
    totalHours: projectTasks.reduce((sum, t) => sum + t.estimatedHours, 0),
    warnings: [],
    recommendations: [],
  };
}

/**
 * 检测任务版本冲突
 * @param task 系统中的任务
 * @param feishuRecord 飞书中的记录
 * @returns 是否存在冲突
 */
export function detectVersionConflict(task: Task, feishuRecord: Record<string, any>): boolean {
  const fields = feishuRecord.fields || {};
  const feishuVersion = (fields[FEISHU_FIELD_IDS.tasks.feishu_version] as number) || 0;
  const systemVersion = (fields[FEISHU_FIELD_IDS.tasks.system_version] as number) || 0;

  // 如果两边都有更新，则存在冲突
  return systemVersion !== 0 && feishuVersion !== 0;
}

/**
 * 解决版本冲突（以飞书为准）
 * @param task 系统中的任务
 * @param feishuRecord 飞书中的记录
 * @returns 解决冲突后的任务
 */
export function resolveConflictWithFeishu(task: Task, feishuRecord: Record<string, any>): Task {
  // 直接使用飞书的数据覆盖系统数据
  return feishuRecordToTask(feishuRecord, task.id);
}
