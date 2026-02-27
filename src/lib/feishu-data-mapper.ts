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
  },
  // 项目表
  projects: {
    id: '项目ID',
    name: '项目名称',
    description: '项目描述',
    end_date: '截止日期',
    status: '项目状态',
  },
  // 任务表
  tasks: {
    id: '任务ID',
    name: '任务名称',
    project: '所属项目',
    type: '任务类型',
    estimated_hours: '预估工时',
    deadline: '截止日期',
    priority: '优先级',
    assignee: '负责人',
    dependencies: '依赖关系',
  },
  // 排期表（排期结果表格）
  schedules: {
    id: '任务ID',
    project: '所属项目',
    type: '任务类型',
    assignee: '负责人',
    start_time: '开始时间',
    end_time: '结束时间',
    deadline: '截止日期',
    actual_hours: '工时',
    status: '状态',
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
    efficiency: 1,
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
    [FEISHU_FIELD_IDS.projects.end_date]: dateToFeishuDate(project.deadline, false),
    [FEISHU_FIELD_IDS.projects.status]: '进行中',
  };
}

/**
 * 将飞书记录转换为系统项目
 */
export function feishuRecordToProject(record: Record<string, any>, recordId: string): Project {
  const fields = record.fields || {};

  return {
    id: fields[FEISHU_FIELD_IDS.projects.id] as string || recordId,
    name: fields[FEISHU_FIELD_IDS.projects.name] as string || '',
    description: fields[FEISHU_FIELD_IDS.projects.description] as string || '',
    priority: 'normal',
    tasks: [],
    resourcePool: [],
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
    [FEISHU_FIELD_IDS.tasks.deadline]: dateToFeishuDate(task.deadline, false),
    [FEISHU_FIELD_IDS.tasks.priority]: task.priority === 'urgent' || task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中',
    [FEISHU_FIELD_IDS.tasks.assignee]: task.assignedResources || [],
    [FEISHU_FIELD_IDS.tasks.dependencies]: task.dependencies || [],
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
    status: 'pending',
    priority: fields[FEISHU_FIELD_IDS.tasks.priority] === '高' ? 'high' : fields[FEISHU_FIELD_IDS.tasks.priority] === '低' ? 'low' : 'normal',
    deadline: feishuDateToDate(fields[FEISHU_FIELD_IDS.tasks.deadline] as number) || undefined,
  };
}



/**
 * 将排期结果中的每个任务转换为飞书记录格式
 * 排期表每个任务一行
 */
export function scheduleToFeishuRecords(schedule: ScheduleResult, projects: Project[], resources: Resource[]): Record<string, any>[] {
  const tasks = schedule.tasks || [];
  
  // 创建资源ID到名称的映射
  const resourceMap = new Map(resources.map((res: any) => [res.id, res.name]));
  
  // 创建项目ID到名称的映射
  const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));

  return tasks.map((task: any) => {
    // 获取负责人名称
    let assignee = '';
    if (task.assignedResources && task.assignedResources.length > 0) {
      const resourceId = task.assignedResources[0];
      if (typeof resourceId === 'string') {
        assignee = resourceMap.get(resourceId) || '';
      } else if (typeof resourceId === 'object') {
        assignee = resourceId.name || '';
      }
    }

    // 计算实际工时（考虑效率）
    const resourceId = task.assignedResources?.[0];
    const resource = resources.find((r: any) => r.id === resourceId);
    const efficiency = resource?.efficiency || 1.0;
    const actualHours = task.estimatedHours / efficiency;

    // 确定状态
    const status = task.status === 'completed' ? '已完成' : 
                   task.status === 'in-progress' ? '进行中' : 
                   task.status === 'pending' ? '未开始' : '已暂停';

    return {
      [FEISHU_FIELD_IDS.schedules.id]: task.id,
      [FEISHU_FIELD_IDS.schedules.project]: projectMap.get(task.projectId) || '',
      [FEISHU_FIELD_IDS.schedules.type]: task.taskType === '平面' ? '平面设计' : task.taskType === '后期' ? '后期制作' : '物料',
      [FEISHU_FIELD_IDS.schedules.assignee]: assignee,
      [FEISHU_FIELD_IDS.schedules.start_time]: dateToFeishuDate(task.startDate, true),
      [FEISHU_FIELD_IDS.schedules.end_time]: dateToFeishuDate(task.endDate, true),
      [FEISHU_FIELD_IDS.schedules.deadline]: dateToFeishuDate(task.deadline, false),
      [FEISHU_FIELD_IDS.schedules.actual_hours]: Math.round(actualHours * 100) / 100,
      [FEISHU_FIELD_IDS.schedules.status]: status,
    };
  });
}

// 保留旧的函数名用于兼容性
export function scheduleToFeishuRecord(schedule: ScheduleResult): Record<string, any> {
  // 这个函数不再使用，由 scheduleToFeishuRecords 替代
  return {};
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
    priority: 'normal',
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
  // 目前版本不需要冲突检测
  return false;
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
