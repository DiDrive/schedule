import { Task, ProjectTemplate, TemplateTask, Project, Resource } from '@/types/schedule';

/**
 * 从项目模板生成任务列表
 * @param template 项目模板
 * @param projectId 项目ID
 * @param startDate 项目开始日期
 * @param workingHours 每天工作小时数（默认8小时）
 * @param projectDeadline 项目截止日期（可选，用于限制任务结束日期）
 * @returns 生成的任务列表
 */
export function generateTasksFromTemplate(
  template: ProjectTemplate,
  projectId: string,
  startDate: Date,
  workingHours: number = 8,
  projectDeadline?: Date
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
  // 使用用户选择的开始时间，不强制设置为9:30
  
  // 工作时间配置
  const WORK_START_HOUR = 9.5;   // 上午9:30上班
  const WORK_MORNING_END = 12;    // 中午12:00上午结束
  const WORK_AFTERNOON_START = 13.5; // 下午1:30开始
  const WORK_END_HOUR = 18.5;     // 下午6点半下班（18.5 = 18:30）
  
  // 辅助函数：跳过周末，找到下一个工作日，设置为9:30
  const skipWeekends = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    if (day === 0) { // 周日
      result.setDate(result.getDate() + 1);
    } else if (day === 6) { // 周六
      result.setDate(result.getDate() + 2);
    }
    // 设置为上午9:30
    result.setHours(9, 30, 0, 0);
    return result;
  };

  // 辅助函数：计算从开始时间到当天中午12:00还有多少分钟
  const getRemainingMorningMinutes = (date: Date): number => {
    const morningEnd = new Date(date);
    morningEnd.setHours(12, 0, 0, 0);
    const diff = morningEnd.getTime() - date.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60)));
  };

  // 辅助函数：计算从下午1:30到下午6:30还有多少分钟
  const getAfternoonMinutes = (): number => {
    // 下午时间段：13:30 - 18:30 = 5小时 = 300分钟
    return 300;
  };

  // 辅助函数：计算从开始时间到当天18:30还有多少分钟（考虑午休）
  const getRemainingMinutesForDay = (date: Date): number => {
    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    
    // 判断是在上午还是下午
    if (currentHour < 12 || (currentHour === 12 && currentMinute === 0)) {
      // 在上午时段
      return getRemainingMorningMinutes(date);
    } else if (currentHour < 13.5 || (currentHour === 13 && currentMinute < 30)) {
      // 在午休时段，返回下午的时间
      return getAfternoonMinutes();
    } else {
      // 在下午时段
      const dayEnd = new Date(date);
      dayEnd.setHours(18, 30, 0, 0);
      const diff = dayEnd.getTime() - date.getTime();
      return Math.max(0, Math.floor(diff / (1000 * 60)));
    }
  };

  // 辅助函数：根据当前时间判断应该从上午还是下午开始计算
  const getStartTimeForNextDay = (referenceTime: Date): Date => {
    const result = new Date(referenceTime);
    result.setHours(9, 30, 0, 0);
    return result;
  };

  // 辅助函数：从开始日期开始，根据剩余工作小时数计算结束日期
  const calculateEndDate = (startDate: Date, remainingHours: number): Date => {
    let currentDate = new Date(startDate);
    let remainingWorkMinutes = remainingHours * 60; // 转换为分钟
    
    while (remainingWorkMinutes > 0) {
      const currentHour = currentDate.getHours();
      const currentMinute = currentDate.getMinutes();
      
      // 判断当前时间段
      if (currentHour < 12 || (currentHour === 12 && currentMinute === 0)) {
        // 在上午时段
        const remainingMorningMinutes = getRemainingMorningMinutes(currentDate);
        
        if (remainingWorkMinutes <= remainingMorningMinutes) {
          // 当天上午能完成
          const endDate = new Date(currentDate);
          endDate.setTime(currentDate.getTime() + remainingWorkMinutes * 60 * 1000);
          return endDate;
        } else {
          // 上午完成不了，减去上午时间
          remainingWorkMinutes -= remainingMorningMinutes;
          // 跳到下午1:30
          currentDate.setHours(13, 30, 0, 0);
        }
      } else if (currentHour < 13.5 || (currentHour === 13 && currentMinute < 30)) {
        // 在午休时段，跳到下午1:30
        currentDate.setHours(13, 30, 0, 0);
      } else {
        // 在下午时段
        const remainingAfternoonMinutes = getRemainingMinutesForDay(currentDate);
        
        if (remainingWorkMinutes <= remainingAfternoonMinutes) {
          // 当天下午能完成
          const endDate = new Date(currentDate);
          endDate.setTime(currentDate.getTime() + remainingWorkMinutes * 60 * 1000);
          return endDate;
        } else {
          // 下午完成不了，减去下午时间
          remainingWorkMinutes -= remainingAfternoonMinutes;
          // 跳到下一个工作日上午9:30
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate = skipWeekends(currentDate);
        }
      }
    }
    
    // 如果没有剩余工作小时数，返回开始日期
    return new Date(startDate);
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
    task.startDate = new Date(currentDate);
    
    // 根据预估工时计算结束日期（考虑每天工作时间）
    const endDate = calculateEndDate(currentDate, templateTask.estimatedHours);
    
    // 检查是否超过项目截止日期
    if (projectDeadline && endDate > projectDeadline) {
      // 如果超过，使用项目截止日期
      task.endDate = new Date(projectDeadline);
      task.deadline = new Date(projectDeadline);
    } else {
      task.endDate = endDate;
      task.deadline = new Date(endDate);
    }

    // 更新当前日期为任务结束日期，并跳过周末，准备下一个任务
    currentDate = new Date(task.endDate);
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
  
  // 直接使用用户选择的开始日期和时间
  const projectStartDate = new Date(startDate);
  
  // 设置项目截止日期时间为18:30（如果有）
  let projectDeadline = deadline;
  if (projectDeadline) {
    projectDeadline = new Date(projectDeadline);
    projectDeadline.setHours(18, 30, 0, 0);
  }
  
  // 生成任务（传入项目截止日期）
  const tasks = generateTasksFromTemplate(template, projectId, projectStartDate, 8, projectDeadline);

  // 如果没有传入截止日期，使用最后一个任务的结束日期
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
    startDate: projectStartDate
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
