import { Task } from '@/types/schedule';

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建任务选项
 */
export interface CreateTaskOptions {
  name: string;
  projectId?: string;
  taskType?: '平面' | '后期' | '物料';
  estimatedHours?: number;
  estimatedHoursGraphic?: number;
  estimatedHoursPost?: number;
  deadline?: Date;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  dependencies?: string[];
  description?: string;
  fixedResourceId?: string;
  
  // 扩展字段
  sequence?: number;
  qualityLevel?: 'excellent' | 'good' | 'medium' | 'poor';
  cooperationStatus?: string;
  requestDate?: Date;
  contactPerson?: string;
  supplier?: string;
  projectSize?: string;
  workOrderSubmitted?: boolean;
  businessMonth?: string;
  size?: string;
  subType?: string;
  language?: string;
  dubbing?: string;
}

/**
 * 创建任务（支持自动拆分复合任务）
 * 
 * 逻辑：
 * 1. 只有平面或只有后期工时 → 创建单个任务
 * 2. 平面+后期都有工时 → 创建父任务+2个子任务（复合任务）
 * 
 * @param options 任务选项
 * @returns 创建的任务数组（单个任务或父任务+子任务）
 */
export function createTask(options: CreateTaskOptions): Task[] {
  const { 
    estimatedHoursGraphic, 
    estimatedHoursPost,
    ...restOptions 
  } = options;

  // 情况1：只有平面或只有后期 → 单任务
  if (!estimatedHoursGraphic || estimatedHoursGraphic === 0) {
    // 只有后期
    return [createSingleTask({
      ...restOptions,
      taskType: '后期',
      estimatedHours: estimatedHoursPost || restOptions.estimatedHours || 0,
      estimatedHoursPost: estimatedHoursPost,
    })];
  }
  
  if (!estimatedHoursPost || estimatedHoursPost === 0) {
    // 只有平面
    return [createSingleTask({
      ...restOptions,
      taskType: '平面',
      estimatedHours: estimatedHoursGraphic,
      estimatedHoursGraphic: estimatedHoursGraphic,
    })];
  }

  // 情况2：平面+后期都有 → 复合任务
  return createCompositeTask(options);
}

/**
 * 创建单个任务
 */
function createSingleTask(options: CreateTaskOptions): Task {
  const now = new Date();
  
  return {
    id: generateId(),
    name: options.name,
    description: options.description,
    projectId: options.projectId,
    taskType: options.taskType,
    estimatedHours: options.estimatedHours || 0,
    estimatedHoursGraphic: options.estimatedHoursGraphic,
    estimatedHoursPost: options.estimatedHoursPost,
    deadline: options.deadline,
    priority: options.priority || 'normal',
    status: 'pending',
    assignedResources: [],
    dependencies: options.dependencies || [],
    fixedResourceId: options.fixedResourceId,
    
    // 扩展字段
    sequence: options.sequence,
    qualityLevel: options.qualityLevel,
    cooperationStatus: options.cooperationStatus,
    requestDate: options.requestDate,
    contactPerson: options.contactPerson,
    supplier: options.supplier,
    projectSize: options.projectSize,
    workOrderSubmitted: options.workOrderSubmitted,
    businessMonth: options.businessMonth,
    size: options.size,
    subType: options.subType,
    language: options.language,
    dubbing: options.dubbing,
  };
}

/**
 * 创建复合任务（父任务+子任务）
 */
function createCompositeTask(options: CreateTaskOptions): Task[] {
  const parentId = generateId();
  const { 
    estimatedHoursGraphic, 
    estimatedHoursPost,
    ...restOptions 
  } = options;

  // 父任务（统计容器）
  const parentTask: Task = {
    id: parentId,
    name: options.name,
    description: options.description,
    projectId: options.projectId,
    estimatedHours: (estimatedHoursGraphic || 0) + (estimatedHoursPost || 0),
    estimatedHoursGraphic: estimatedHoursGraphic,
    estimatedHoursPost: estimatedHoursPost,
    deadline: options.deadline,
    priority: options.priority || 'normal',
    status: 'pending',
    assignedResources: [],
    dependencies: options.dependencies || [],
    
    // 扩展字段（继承到父任务）
    sequence: options.sequence,
    qualityLevel: options.qualityLevel,
    cooperationStatus: options.cooperationStatus,
    requestDate: options.requestDate,
    contactPerson: options.contactPerson,
    supplier: options.supplier,
    projectSize: options.projectSize,
    workOrderSubmitted: options.workOrderSubmitted,
    businessMonth: options.businessMonth,
    size: options.size,
    subType: options.subType,
    language: options.language,
    dubbing: options.dubbing,
  };

  // 平面子任务
  const graphicTask: Task = {
    id: `${parentId}-graphic`,
    name: `${options.name}（平面）`,
    parentTaskId: parentId,
    isSubTask: true,
    subTaskType: '平面',
    taskType: '平面',
    projectId: options.projectId,
    estimatedHours: estimatedHoursGraphic || 0,
    estimatedHoursGraphic: estimatedHoursGraphic,
    deadline: options.deadline,
    priority: options.priority || 'normal',
    status: 'pending',
    assignedResources: [],
    dependencies: [], // 默认无依赖（可并行）
    
    // 继承部分扩展字段
    contactPerson: options.contactPerson,
    projectSize: options.projectSize,
  };

  // 后期子任务
  const postTask: Task = {
    id: `${parentId}-post`,
    name: `${options.name}（后期）`,
    parentTaskId: parentId,
    isSubTask: true,
    subTaskType: '后期',
    taskType: '后期',
    projectId: options.projectId,
    estimatedHours: estimatedHoursPost || 0,
    estimatedHoursPost: estimatedHoursPost,
    deadline: options.deadline,
    priority: options.priority || 'normal',
    status: 'pending',
    assignedResources: [],
    dependencies: [], // 默认无依赖（可并行）
    
    // 继承部分扩展字段
    contactPerson: options.contactPerson,
    projectSize: options.projectSize,
  };

  return [parentTask, graphicTask, postTask];
}

/**
 * 判断任务是否为复合任务
 */
export function isCompositeTask(task: Task): boolean {
  return !task.isSubTask && 
         task.estimatedHoursGraphic !== undefined && 
         task.estimatedHoursPost !== undefined &&
         task.estimatedHoursGraphic > 0 &&
         task.estimatedHoursPost > 0;
}

/**
 * 判断任务是否为父任务
 */
export function isParentTask(task: Task): boolean {
  return !task.isSubTask && !task.parentTaskId;
}

/**
 * 判断任务是否为子任务
 */
export function isSubTask(task: Task): boolean {
  return task.isSubTask === true && !!task.parentTaskId;
}

/**
 * 获取任务的所有子任务
 */
export function getSubTasks(parentTask: Task, allTasks: Task[]): Task[] {
  return allTasks.filter(t => t.parentTaskId === parentTask.id);
}

/**
 * 获取任务的父任务
 */
export function getParentTask(subTask: Task, allTasks: Task[]): Task | undefined {
  return allTasks.find(t => t.id === subTask.parentTaskId);
}

/**
 * 计算父任务的整体状态
 */
export function calculateParentTaskStatus(subTasks: Task[]): 'pending' | 'in-progress' | 'completed' | 'blocked' {
  // 所有子任务完成 → 父任务完成
  if (subTasks.every(t => t.status === 'completed')) {
    return 'completed';
  }
  
  // 有子任务进行中 → 父任务进行中
  if (subTasks.some(t => t.status === 'in-progress')) {
    return 'in-progress';
  }
  
  // 有子任务阻塞 → 父任务阻塞
  if (subTasks.some(t => t.status === 'blocked')) {
    return 'blocked';
  }
  
  // 其他 → 待处理
  return 'pending';
}

/**
 * 更新父任务的统计信息
 */
export function updateParentTaskStats(parentTask: Task, subTasks: Task[]): Task {
  const startDate = subTasks.reduce((earliest: Date | undefined, t) => {
    if (!t.startDate) return earliest;
    return !earliest || t.startDate < earliest ? t.startDate : earliest;
  }, undefined as Date | undefined);

  const endDate = subTasks.reduce((latest: Date | undefined, t) => {
    if (!t.endDate) return latest;
    return !latest || t.endDate > latest ? t.endDate : latest;
  }, undefined as Date | undefined);

  const status = calculateParentTaskStatus(subTasks);

  return {
    ...parentTask,
    startDate,
    endDate,
    status,
  };
}
