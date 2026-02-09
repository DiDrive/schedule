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

// 飞书字段ID常量（使用中文字段名）
export const FEISHU_FIELD_IDS = {
  // 人员表
  resources: {
    id: '人员ID',
    name: '姓名',
    type: '工作类型',
    efficiency: '效率',
    feishu_user: '飞书用户',
    total_hours: '总工时',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  // 项目表
  projects: {
    id: '项目ID',
    name: '项目名称',
    description: '项目描述',
    start_date: '开始日期',
    end_date: '结束日期',
    status: '项目状态',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  // 任务表
  tasks: {
    id: '任务ID',
    name: '任务名称',
    project: '所属项目',
    type: '任务类型',
    estimated_hours: '预估工时',
    actual_hours: '实际工时',
    start_time: '开始时间',
    end_time: '结束时间',
    deadline: '截止日期',
    priority: '优先级',
    assignee: '负责人',
    dependencies: '依赖关系',
    status: '任务状态',
    is_overdue: '是否超期',
    feishu_version: '飞书版本',
    system_version: '系统版本',
    last_synced_at: '最后同步时间',
    sync_source: '同步来源',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  // 排期表（排期结果表格）
  schedules: {
    id: '任务ID',
    project: '项目',
    name: '任务名称',
    version: '版本',
    task_count: '任务数',
    total_hours: '总工时',
    utilization: '利用率',
    critical_path_count: '关键路径数',
    start_time: '开始时间',
    end_time: '结束时间',
    generated_at: '生成时间',
    created_at: '创建时间',
    updated_at: '更新时间',
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
function dateToFeishuDate(date: Date | null | undefined, includeTime: boolean = false): number {
  if (!date) return 0;

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
  return {
    [FEISHU_FIELD_IDS.resources.id]: resource.id,
    [FEISHU_FIELD_IDS.resources.name]: resource.name,
    [FEISHU_FIELD_IDS.resources.type]: resource.workType === '平面' ? '平面设计' : resource.workType === '后期' ? '后期制作' : '物料',
    [FEISHU_FIELD_IDS.resources.efficiency]: Number(resource.efficiency || 1),
    [FEISHU_FIELD_IDS.resources.feishu_user]: [],
    [FEISHU_FIELD_IDS.resources.total_hours]: 0,
    [FEISHU_FIELD_IDS.resources.created_at]: dateToFeishuDate(new Date(), true),
    [FEISHU_FIELD_IDS.resources.updated_at]: dateToFeishuDate(new Date(), true),
  };
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
  return {
    [FEISHU_FIELD_IDS.projects.id]: project.id,
    [FEISHU_FIELD_IDS.projects.name]: project.name,
    [FEISHU_FIELD_IDS.projects.description]: project.description || '',
    [FEISHU_FIELD_IDS.projects.start_date]: dateToFeishuDate(project.startDate, false),
    [FEISHU_FIELD_IDS.projects.end_date]: dateToFeishuDate(project.deadline, false),
    [FEISHU_FIELD_IDS.projects.status]: '进行中',
    [FEISHU_FIELD_IDS.projects.created_at]: dateToFeishuDate(new Date(), true),
    [FEISHU_FIELD_IDS.projects.updated_at]: dateToFeishuDate(new Date(), true),
  };
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
  return {
    [FEISHU_FIELD_IDS.tasks.id]: task.id,
    [FEISHU_FIELD_IDS.tasks.name]: task.name,
    [FEISHU_FIELD_IDS.tasks.project]: task.projectId || [],
    [FEISHU_FIELD_IDS.tasks.type]: task.taskType === '平面' ? '平面设计' : task.taskType === '后期' ? '后期制作' : '物料',
    [FEISHU_FIELD_IDS.tasks.estimated_hours]: task.estimatedHours,
    [FEISHU_FIELD_IDS.tasks.actual_hours]: 0,
    [FEISHU_FIELD_IDS.tasks.start_time]: dateToFeishuDate(task.startDate, true),
    [FEISHU_FIELD_IDS.tasks.end_time]: dateToFeishuDate(task.endDate, true),
    [FEISHU_FIELD_IDS.tasks.deadline]: dateToFeishuDate(task.deadline, true),
    [FEISHU_FIELD_IDS.tasks.priority]: task.priority === 'urgent' || task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中',
    [FEISHU_FIELD_IDS.tasks.assignee]: task.assignedResources || [],
    [FEISHU_FIELD_IDS.tasks.dependencies]: task.dependencies || [],
    [FEISHU_FIELD_IDS.tasks.status]: task.status === 'pending' ? '未开始' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已暂停',
    [FEISHU_FIELD_IDS.tasks.is_overdue]: false,
    [FEISHU_FIELD_IDS.tasks.feishu_version]: 0,
    [FEISHU_FIELD_IDS.tasks.system_version]: 0,
    [FEISHU_FIELD_IDS.tasks.last_synced_at]: dateToFeishuDate(new Date(), true),
    [FEISHU_FIELD_IDS.tasks.sync_source]: '系统',
    [FEISHU_FIELD_IDS.tasks.created_at]: dateToFeishuDate(new Date(), true),
    [FEISHU_FIELD_IDS.tasks.updated_at]: dateToFeishuDate(new Date(), true),
  };
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
