import { Task, ProjectTemplate, TemplateTask, Project, Resource } from '@/types/schedule';

/**
 * 从项目模板生成任务列表
 * @param template 项目模板
 * @param projectId 项目ID
 * @param startDate 项目开始日期
 * @param workingHours 每天工作小时数（默认8小时）
 * @returns 生成的任务列表
 */
export function generateTasksFromTemplate(
  template: ProjectTemplate,
  projectId: string,
  startDate: Date,
  workingHours: number = 8
): Task[] {
  const tasks: Task[] = [];
  const taskMap = new Map<number, Task>(); // 序号到任务的映射

  // 按序号排序任务
  const sortedTemplateTasks = [...template.tasks].sort((a, b) => a.sequence - b.sequence);

  // 第一遍：创建所有任务（不设置依赖关系）
  sortedTemplateTasks.forEach((templateTask, index) => {
    const taskId = `task-${projectId}-${templateTask.sequence}`;
    
    const task: Task = {
      id: taskId,
      name: templateTask.name,
      description: templateTask.description,
      estimatedHours: templateTask.estimatedHours,
      priority: templateTask.priority,
      taskType: templateTask.taskType,
      status: 'pending',
      projectId: projectId,
      dependencies: [], // 稍后设置
      tags: templateTask.tags,
      assignedResources: [] // 资源分配将在排期时自动处理
    };

    tasks.push(task);
    taskMap.set(templateTask.sequence, task);
  });

  // 第二遍：设置依赖关系并计算开始日期
  let currentDate = new Date(startDate);
  
  // 辅助函数：跳过周末，找到下一个工作日
  const skipWeekends = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    if (day === 0) { // 周日
      result.setDate(result.getDate() + 1);
    } else if (day === 6) { // 周六
      result.setDate(result.getDate() + 2);
    }
    return result;
  };

  // 辅助函数：从开始日期开始，计算任务结束日期（跳过周末）
  const calculateEndDate = (startDate: Date, taskDays: number): Date => {
    const endDate = new Date(startDate);
    let workingDaysPassed = 0;
    
    while (workingDaysPassed < taskDays - 1) {
      endDate.setDate(endDate.getDate() + 1);
      const day = endDate.getDay();
      // 只计算周一到周五
      if (day !== 0 && day !== 6) {
        workingDaysPassed++;
      }
    }
    
    return endDate;
  };
  
  sortedTemplateTasks.forEach((templateTask) => {
    const task = taskMap.get(templateTask.sequence);
    if (!task) return;

    // 设置依赖关系（将序号转换为任务ID）
    if (templateTask.dependencies && templateTask.dependencies.length > 0) {
      task.dependencies = templateTask.dependencies
        .map(seq => {
          const depTask = taskMap.get(seq);
          return depTask ? depTask.id : '';
        })
        .filter(id => id !== '');
    }

    // 计算开始日期
    if (task.dependencies && task.dependencies.length > 0) {
      // 如果有依赖，找出所有依赖任务中最晚的结束日期
      const depTasks = task.dependencies
        .map(depId => tasks.find(t => t.id === depId))
        .filter(t => t !== undefined) as Task[];

      if (depTasks.length > 0) {
        const maxEndDate = depTasks.reduce((max, t) => {
          const endDate = t.endDate ? new Date(t.endDate) : new Date(currentDate);
          return endDate > max ? endDate : max;
        }, new Date(currentDate));

        currentDate = new Date(maxEndDate);
        // 从依赖任务结束日期的下一天开始，并跳过周末
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate = skipWeekends(currentDate);
      }
    }

    // 设置任务开始和结束日期
    const taskDays = Math.ceil(templateTask.estimatedHours / workingHours);
    
    task.startDate = new Date(currentDate);
    
    // 计算结束日期（跳过周末）
    const endDate = calculateEndDate(currentDate, taskDays);
    task.endDate = endDate;
    task.deadline = new Date(endDate); // 设置截止日期

    // 更新当前日期为任务结束日期，并跳过周末，准备下一个任务
    currentDate = new Date(endDate);
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate = skipWeekends(currentDate);
  });

  return tasks;
}

/**
 * 从模板创建完整项目
 * @param template 项目模板
 * @param projectName 项目名称
 * @param startDate 项目开始日期
 * @param priority 项目优先级
 * @param resourcePool 资源池
 * @param projectDescription 项目描述
 * @param deadline 项目截止日期（可选）
 * @returns 创建的项目对象
 */
export function createProjectFromTemplate(
  template: ProjectTemplate,
  projectName: string,
  startDate: Date,
  priority: number = 5,
  resourcePool: string[] = [],
  projectDescription?: string,
  deadline?: Date
): Project {
  const projectId = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 生成任务
  const tasks = generateTasksFromTemplate(template, projectId, startDate);

  // 使用传入的截止日期，如果没有则使用最后一个任务的结束日期
  let projectDeadline = deadline;
  if (!projectDeadline) {
    const lastTask = tasks[tasks.length - 1];
    projectDeadline = lastTask.endDate ? new Date(lastTask.endDate) : undefined;
  }

  const project: Project = {
    id: projectId,
    name: projectName,
    description: projectDescription || template.description,
    priority: priority,
    deadline: projectDeadline,
    tasks: tasks,
    resourcePool: resourcePool,
    color: template.color,
    startDate: startDate
  };

  return project;
}

/**
 * 计算项目的预计工期
 * @param tasks 任务列表
 * @param workingHours 每天工作小时数
 * @returns 预计工期（天）
 */
export function calculateProjectDuration(tasks: Task[], workingHours: number = 8): number {
  if (tasks.length === 0) return 0;

  const startDates = tasks
    .map(t => t.startDate)
    .filter(d => d !== undefined) as Date[];
  
  const endDates = tasks
    .map(t => t.endDate)
    .filter(d => d !== undefined) as Date[];

  if (startDates.length === 0 || endDates.length === 0) return 0;

  const minStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
  const maxEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));

  const diffTime = maxEndDate.getTime() - minStartDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // 包含开始和结束当天
}

/**
 * 计算项目总工时
 * @param tasks 任务列表
 * @returns 总工时
 */
export function calculateTotalHours(tasks: Task[]): number {
  return tasks.reduce((total, task) => total + task.estimatedHours, 0);
}

/**
 * 按任务类型分组统计
 * @param tasks 任务列表
 * @returns 按类型统计的任务数和工时
 */
export function getTaskTypeStats(tasks: Task[]) {
  const stats: Record<string, { count: number; hours: number }> = {};

  tasks.forEach(task => {
    const type = task.taskType || '未分类';
    if (!stats[type]) {
      stats[type] = { count: 0, hours: 0 };
    }
    stats[type].count++;
    stats[type].hours += task.estimatedHours;
  });

  return stats;
}

/**
 * 按优先级分组统计
 * @param tasks 任务列表
 * @returns 按优先级统计的任务数
 */
export function getPriorityStats(tasks: Task[]) {
  const stats: Record<string, number> = {
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0
  };

  tasks.forEach(task => {
    const priority = task.priority || 'normal';
    stats[priority]++;
  });

  return stats;
}
