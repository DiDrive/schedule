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
    feishu_user_id: '飞书用户ID',
  },
  // 项目表
  projects: {
    id: '项目ID',
    name: '项目名称',
    description: '项目描述',
    priority: '优先级',
    end_date: '截止日期',
    status: '项目状态',
  },
  // 任务表（标准任务表）
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
  // 工单表（视频项目工单视图）
  workorders: {
    id: '任务ID',                    // 系统任务ID
    name: '脚本名称',                // 任务名称
    project: '需求类目',             // 项目/需求类目
    sub_type: '细分类',              // 细分类别
    language: '语言',                // 语言
    dubbing: '配音',                 // 配音要求
    deadline: '需求日期',            // 截止日期
    business_month: '商务月份',      // 商务月份
    size: '尺寸',                    // 尺寸规格
    status: '项目进展',              // 项目状态
    graphic_hours: '平面预估工时',   // 平面工时
    post_hours: '后期预估工时',      // 后期工时
    assignee: '对接人',              // 负责人
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
  projectPriority: {
    '紧急': 'urgent',
    '普通': 'normal',
  },
  taskType: {
    '平面设计': 'graphic',
    '后期制作': 'post',
    '物料': 'material',
  },
  taskPriority: {
    '紧急': 'urgent',
    '普通': 'normal',
    '低': 'low',
  },
  taskStatus: {
    '未开始': 'not_started',
    '进行中': 'in_progress',
    '已完成': 'completed',
    '已暂停': 'paused',
    '已超期': 'overdue',
  },
  // 工单表状态映射
  workorderStatus: {
    'DONE-打包归档': 'completed',
    '打包工程': 'in_progress',
    '未开始': 'not_started',
    '已暂停': 'paused',
  },
  // 工单表细分类到任务类型映射
  workorderSubType: {
    '前瞻pv视频': '后期',
    'pv视频-延展': '后期',
    '前瞻pv视频-动态kv': '平面',
    '英改简': '后期',
    '英语新片': '后期',
    '简中新片': '后期',
    '简改繁': '后期',
    '简改日': '后期',
    '简改韩': '后期',
    '简改英': '后期',
    '简改泰': '后期',
    '特殊需求-改标题': '平面',
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
 * 如果日期为空，返回 undefined（不发送该字段）
 */
function dateToFeishuDate(date: Date | string | null | undefined, includeTime: boolean = false): number | undefined {
  if (!date) return undefined;

  // 如果是字符串，先转换为 Date 对象
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
    // 检查转换是否有效
    if (isNaN(dateObj.getTime())) {
      console.warn('[Feishu Data Mapper] 无效的日期字符串:', date);
      return undefined;
    }
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    console.warn('[Feishu Data Mapper] 未知的日期类型:', typeof date, date);
    return undefined;
  }

  if (includeTime) {
    // 包含时间的日期：返回毫秒级时间戳
    return dateObj.getTime();
  } else {
    // 不包含时间的日期：返回秒级时间戳
    return Math.floor(dateObj.getTime() / 1000);
  }
}

/**
 * 将飞书日期格式转换为日期对象
 * 支持秒级和毫秒级时间戳
 */
function feishuDateToDate(timestamp: number | null | undefined): Date | null {
  if (!timestamp || timestamp === 0) return null;
  
  // 如果时间戳小于 100000000000（1973年左右），则认为是秒级时间戳
  // 如果时间戳大于 100000000000，则认为是毫秒级时间戳
  const isSeconds = timestamp < 100000000000;
  return new Date(isSeconds ? timestamp * 1000 : timestamp);
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
  const record: Record<string, any> = {
    [FEISHU_FIELD_IDS.projects.id]: project.id,
    [FEISHU_FIELD_IDS.projects.name]: project.name,
    [FEISHU_FIELD_IDS.projects.description]: project.description || '',
    [FEISHU_FIELD_IDS.projects.priority]: project.priority === 'urgent' ? '紧急' : '普通',
    [FEISHU_FIELD_IDS.projects.status]: '进行中',
  };

  return record;
}

/**
 * 将飞书记录转换为系统项目
 */
export function feishuRecordToProject(record: Record<string, any>, recordId: string): Project {
  const fields = record.fields || {};
  
  // 从飞书读取优先级
  const priorityValue = fields[FEISHU_FIELD_IDS.projects.priority] as string;
  const priority = priorityValue === '紧急' ? 'urgent' : 'normal';

  return {
    id: fields[FEISHU_FIELD_IDS.projects.id] as string || recordId,
    name: fields[FEISHU_FIELD_IDS.projects.name] as string || '',
    description: fields[FEISHU_FIELD_IDS.projects.description] as string || '',
    priority: priority,
    tasks: [],
    resourcePool: [],
  };
}

/**
 * 将系统任务转换为飞书记录格式
 * @param task 系统任务
 * @param resourceMap 系统资源ID到飞书人员ID的映射（可选）
 */
export function taskToFeishuRecord(
  task: Task & { projectName?: string },
  resourceMap?: Map<string, string>
): Record<string, any> {
  // 优先使用 assignedResources（已排期），如果没有则使用 fixedResourceId（手动指定）
  const assigneeResources = task.assignedResources && task.assignedResources.length > 0
    ? task.assignedResources
    : (task.fixedResourceId ? [task.fixedResourceId] : []);

  // 将资源ID数组转换为飞书人员格式：[{ id: 'ou_xxxx' }, ...]
  const feishuAssignee = assigneeResources.length > 0
    ? assigneeResources
        .map((id: string) => {
          // 如果有资源映射，将系统资源ID转换为飞书人员ID
          const feishuPersonId = resourceMap?.get(id);
          return feishuPersonId ? { id: feishuPersonId } : null;
        })
        .filter(Boolean)
    : [];

  const record: Record<string, any> = {
    [FEISHU_FIELD_IDS.tasks.id]: task.id,
    [FEISHU_FIELD_IDS.tasks.name]: task.name,
  };

  // 只在有空值时添加这些字段
  if (task.projectName || task.projectId) {
    record[FEISHU_FIELD_IDS.tasks.project] = task.projectName || (task.projectId ? [task.projectId] : []);
  }

  if (task.taskType) {
    record[FEISHU_FIELD_IDS.tasks.type] = task.taskType === '平面' ? '平面设计' : task.taskType === '后期' ? '后期制作' : '物料';
  }

  if (task.estimatedHours) {
    record[FEISHU_FIELD_IDS.tasks.estimated_hours] = task.estimatedHours;
  }

  const deadline = dateToFeishuDate(task.deadline, true);
  if (deadline !== undefined) {
    record[FEISHU_FIELD_IDS.tasks.deadline] = deadline;
  }

  if (task.priority) {
    record[FEISHU_FIELD_IDS.tasks.priority] = task.priority === 'urgent' ? '紧急' : task.priority === 'low' ? '低' : '普通';
  }

  if (feishuAssignee.length > 0) {
    record[FEISHU_FIELD_IDS.tasks.assignee] = feishuAssignee;
  }

  if (task.dependencies && task.dependencies.length > 0) {
    record[FEISHU_FIELD_IDS.tasks.dependencies] = task.dependencies;
  }

  return record;
}

/**
 * 将飞书记录转换为系统任务
 * @param record 飞书记录
 * @param recordId 记录ID
 * @param resourceMap 飞书人员ID到系统资源ID的映射（可选）
 */
export function feishuRecordToTask(
  record: Record<string, any>,
  recordId: string,
  resourceMap?: Map<string, string>
): Task {
  const fields = record.fields || {};

  // 从飞书读取优先级
  const priorityValue = fields[FEISHU_FIELD_IDS.tasks.priority] as string;
  const priority = priorityValue === '紧急' ? 'urgent' : priorityValue === '低' ? 'low' : 'normal';

  // 从飞书读取负责人（飞书人员字段返回对象数组）
  // 格式：[{ "type": 1, "person": { "open_id": "ou_xxx" } }, ...]
  const assigneeField = fields[FEISHU_FIELD_IDS.tasks.assignee];
  let assignedResources: string[] = [];
  
  if (assigneeField) {
    if (Array.isArray(assigneeField)) {
      // 多选人员
      assignedResources = assigneeField
        .map((item: any) => {
          const openId = item?.person?.open_id;
          // 如果有资源映射，将飞书人员ID转换为系统资源ID
          return resourceMap?.get(openId) || openId;
        })
        .filter(Boolean);
    } else if (assigneeField.person?.open_id) {
      // 单选人员
      const openId = assigneeField.person.open_id;
      const resourceId = resourceMap?.get(openId) || openId;
      assignedResources = [resourceId];
    }
  }

  // 将负责人设置到 fixedResourceId，以便在任务管理中显示
  const fixedResourceId = assignedResources.length > 0 ? assignedResources[0] : undefined;

  return {
    id: fields[FEISHU_FIELD_IDS.tasks.id] as string || recordId,
    name: fields[FEISHU_FIELD_IDS.tasks.name] as string || '',
    taskType: fields[FEISHU_FIELD_IDS.tasks.type] === '平面设计' ? '平面' : fields[FEISHU_FIELD_IDS.tasks.type] === '后期制作' ? '后期' : '物料',
    projectId: (fields[FEISHU_FIELD_IDS.tasks.project] as string)?.[0] || undefined,
    estimatedHours: (fields[FEISHU_FIELD_IDS.tasks.estimated_hours] as number) || 0,
    assignedResources: assignedResources, // 用于排期算法
    fixedResourceId: fixedResourceId, // 用于任务管理中显示指定人员
    dependencies: (fields[FEISHU_FIELD_IDS.tasks.dependencies] as string[]) || [],
    status: 'pending',
    priority: priority,
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

/**
 * 从细分类推断任务类型
 * @param subType 细分类值
 * @returns 任务类型（平面/后期/物料）
 */
function inferTaskTypeFromSubType(subType: string): string {
  if (!subType) return '后期';
  
  // 平面类细分类
  const graphicTypes = [
    '简中平面',
    '动态kv',
    '静态kv',
    '前瞻pv视频-动态kv',
    '特殊需求-改标题',
    '改标题',
  ];
  
  // 物料类细分类
  const materialTypes = [
    'NOVA-买量需求',
    '05-富婆人生（春节跳舞福利）',
  ];
  
  // 后期类细分类（包含翻译、配音、延展等）
  const postTypes = [
    '简中新片',
    '繁中新片',
    '日语新片',
    '英语新片',
    '简改繁',
    '简改日',
    '简改韩',
    '简改英',
    '简改泰',
    '简改越南',
    '繁改日',
    '繁改英',
    '繁改简',
    '繁改韩',
    '繁改泰',
    '英改简',
    '英改繁',
    '英改日',
    '英改韩',
    '英改德',
    '英改法',
    '英改西',
    '英改葡',
    '日改韩',
    '日改英',
    '日改简',
    '日改繁',
    'AI混剪',
    '翻译需求-英文',
    '翻译需求-韩文',
    '翻译需求-日文',
    '配音需求-英语',
    '配音需求-韩语',
    '英语延展',
    '繁中延展',
    '韩语延展',
    '日语延展',
    '前瞻pv视频',
    'pv视频-延展',
  ];
  
  // 直接匹配
  if (graphicTypes.includes(subType)) return '平面';
  if (materialTypes.includes(subType)) return '物料';
  if (postTypes.includes(subType)) return '后期';
  
  // 模糊匹配
  if (subType.includes('平面') || subType.includes('kv') || subType.includes('KV')) {
    return '平面';
  }
  if (subType.includes('物料') || subType.includes('素材') || subType.includes('买量')) {
    return '物料';
  }
  if (subType.includes('改') || subType.includes('新片') || subType.includes('翻译') || 
      subType.includes('配音') || subType.includes('延展') || subType.includes('混剪')) {
    return '后期';
  }
  
  return '后期'; // 默认后期
}

/**
 * 将工单表记录转换为系统任务
 * @param record 飞书记录
 * @param recordId 记录ID
 * @returns 系统任务
 */
export function workorderRecordToTask(record: Record<string, any>, recordId: string): Task {
  const fields = record.fields || {};
  const f = FEISHU_FIELD_IDS.workorders;
  
  // 解析任务ID
  const taskId = (fields[f.id] as string) || recordId;
  
  // 解析任务名称
  const taskName = (fields[f.name] as string) || '未命名任务';
  
  // 解析项目/需求类目
  const projectName = parseStringField(fields[f.project], '');
  
  // 解析细分类并推断任务类型
  const subType = parseStringField(fields[f.sub_type], '');
  const taskType = inferTaskTypeFromSubType(subType);
  
  // 解析工时：根据任务类型选择对应的工时字段
  const graphicHours = Number(fields[f.graphic_hours]) || 0;
  const postHours = Number(fields[f.post_hours]) || 0;
  const estimatedHours = taskType === '平面' ? graphicHours : postHours;
  
  // 解析截止日期
  const deadline = feishuDateToDate(fields[f.deadline] as number);
  
  // 解析状态
  const statusValue = parseStringField(fields[f.status], '未开始');
  const statusMap: Record<string, string> = {
    'DONE-打包归档': 'completed',
    '打包工程': 'in_progress',
    '未开始': 'not_started',
    '已暂停': 'paused',
  };
  const status = statusMap[statusValue] || 'not_started';
  
  // 解析负责人（对接人）
  const assigneeField = fields[f.assignee];
  let fixedResourceId = '';
  let assigneeName = '';
  
  if (assigneeField) {
    if (Array.isArray(assigneeField) && assigneeField.length > 0) {
      // 人员类型字段格式: [{ id: 'ou_xxx', name: '张三', ... }]
      assigneeName = assigneeField[0].name || assigneeField[0].en_name || '';
    } else if (typeof assigneeField === 'object') {
      assigneeName = assigneeField.name || assigneeField.en_name || '';
    } else if (typeof assigneeField === 'string') {
      assigneeName = assigneeField;
    }
  }
  
  return {
    id: taskId,
    name: taskName,
    projectId: projectName, // 使用项目名称作为项目ID
    taskType: taskType,
    estimatedHours: estimatedHours || 1, // 默认至少1小时
    deadline: deadline || undefined,
    status: status as any,
    priority: 'normal',
    assignedResources: [],
    fixedResourceId: fixedResourceId,
    dependencies: [],
    // 保存原始字段用于参考
    language: parseStringField(fields[f.language], ''),
    dubbing: parseStringField(fields[f.dubbing], ''),
    businessMonth: parseStringField(fields[f.business_month], ''),
    size: parseStringField(fields[f.size], ''),
    subType: subType,
  } as Task;
}

/**
 * 将系统任务转换为工单表记录格式
 * @param task 系统任务
 * @param resourceMap 资源ID到飞书人员ID的映射
 * @returns 飞书记录格式
 */
export function taskToWorkorderRecord(
  task: Task,
  resourceMap?: Map<string, string>
): Record<string, any> {
  const f = FEISHU_FIELD_IDS.workorders;
  
  // 转换负责人
  let assignee: any = [];
  const resourceId = task.assignedResources?.[0] || task.fixedResourceId;
  if (resourceId && resourceMap) {
    const feishuPersonId = resourceMap.get(resourceId);
    if (feishuPersonId) {
      assignee = [{ id: feishuPersonId }];
    }
  }
  
  // 转换状态
  const statusMap: Record<string, string> = {
    'completed': 'DONE-打包归档',
    'in_progress': '打包工程',
    'not_started': '未开始',
    'paused': '已暂停',
  };
  
  const record: Record<string, any> = {
    [f.id]: task.id,
    [f.name]: task.name,
    [f.project]: task.projectId || '心动小镇-品牌需求',
    [f.sub_type]: task.subType || (task.taskType === '平面' ? '动态kv' : '简中新片'),
    [f.language]: task.language || '',
    [f.deadline]: dateToFeishuDate(task.deadline, false),
    [f.status]: statusMap[task.status] || '未开始',
  };
  
  // 根据任务类型设置对应的工时字段
  if (task.taskType === '平面') {
    record[f.graphic_hours] = task.estimatedHours;
    record[f.post_hours] = 0;
  } else {
    record[f.graphic_hours] = 0;
    record[f.post_hours] = task.estimatedHours;
  }
  
  // 设置负责人
  if (assignee.length > 0) {
    record[f.assignee] = assignee;
  }
  
  return record;
}

// 辅助函数：解析字符串字段（处理文本数组或普通字符串）
function parseStringField(value: any, defaultValue: string = ''): string {
  if (!value) return defaultValue;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) {
    if (typeof value[0] === 'string') return value[0];
    if (value[0]?.text) return value[0].text;
  }
  return defaultValue;
}
