import { Task, Resource, ScheduleResult, ResourceConflict, WorkingHoursConfig } from '@/types/schedule';

// 默认工作时间配置
const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  startHour: 9.5, // 9:30
  endHour: 19, // 19:00
  workDays: [1, 2, 3, 4, 5] // 周一到周五
};

/**
 * 计算两个日期之间的工作小时数
 */
export function calculateWorkHours(startDate: Date, endDate: Date, config: WorkingHoursConfig = DEFAULT_WORKING_HOURS): number {
  let current = new Date(startDate);
  let totalHours = 0;
  const end = new Date(endDate);

  while (current < end) {
    const dayOfWeek = current.getDay();
    
    // 检查是否是工作日
    if (config.workDays.includes(dayOfWeek)) {
      const startOfDay = new Date(current);
      startOfDay.setHours(Math.floor(config.startHour), (config.startHour % 1) * 60, 0, 0);
      
      const endOfDay = new Date(current);
      endOfDay.setHours(Math.floor(config.endHour), (config.endHour % 1) * 60, 0, 0);
      
      // 计算当天的工作小时数
      let workStart = current > startOfDay ? current : startOfDay;
      let workEnd = end < endOfDay ? end : endOfDay;
      
      if (workStart < workEnd) {
        const hours = (workEnd.getTime() - workStart.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    }
    
    // 移动到下一天的开始
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return totalHours;
}

/**
 * 计算从开始日期起经过指定工作小时数后的结束日期
 */
export function calculateEndDate(startDate: Date, workHours: number, config: WorkingHoursConfig = DEFAULT_WORKING_HOURS): Date {
  const result = new Date(startDate);
  let remainingHours = workHours;

  // 先调整到第一个工作日的工作时间开始
  while (remainingHours > 0) {
    const dayOfWeek = result.getDay();
    
    if (!config.workDays.includes(dayOfWeek)) {
      // 非工作日，跳到下一天 0:00
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }

    const startOfDay = new Date(result);
    startOfDay.setHours(Math.floor(config.startHour), (config.startHour % 1) * 60, 0, 0);
    
    const endOfDay = new Date(result);
    endOfDay.setHours(Math.floor(config.endHour), (config.endHour % 1) * 60, 0, 0);

    // 如果当前时间在工作日之前，从工作日开始
    if (result < startOfDay) {
      result.setTime(startOfDay.getTime());
      continue;
    }

    // 如果当前时间在工作日之后，跳到下一个工作日
    if (result >= endOfDay) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }

    // 计算当天剩余工作时间
    const availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
    const hoursToUse = Math.min(remainingHours, availableHours);

    result.setTime(result.getTime() + hoursToUse * 60 * 60 * 1000);
    remainingHours -= hoursToUse;

    // 如果还有剩余工作时间，移到下一天
    if (remainingHours > 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
    }
  }

  return result;
}

/**
 * 计算关键路径 (Critical Path Method - CPM)
 * 使用前向和后向遍历计算最早开始时间、最晚开始时间、总时差
 */
export function calculateCriticalPath(tasks: Task[]): string[] {
  // 构建任务图
  const taskMap = new Map<string, Task>();
  tasks.forEach(task => taskMap.set(task.id, task));

  // 1. 计算最早开始时间 (ES) 和最早完成时间 (EF)
  const es = new Map<string, number>(); // Earliest Start
  const ef = new Map<string, number>(); // Earliest Finish
  
  tasks.forEach(task => {
    es.set(task.id, 0);
  });

  // 拓扑排序并计算
  let visited = new Set<string>();
  let processed = 0;
  
  while (processed < tasks.length) {
    let progress = false;
    for (const task of tasks) {
      if (visited.has(task.id)) continue;
      
      const deps = task.dependencies || [];
      const allDepsProcessed = deps.every(depId => visited.has(depId));
      
      if (allDepsProcessed) {
        // 计算最早开始时间 = max(依赖任务的最早完成时间)
        let maxEF = 0;
        for (const depId of deps) {
          const depEF = ef.get(depId) || 0;
          maxEF = Math.max(maxEF, depEF);
        }
        
        es.set(task.id, maxEF);
        ef.set(task.id, maxEF + task.estimatedHours);
        visited.add(task.id);
        processed++;
        progress = true;
      }
    }
    
    if (!progress) {
      // 检测到循环依赖，强制处理
      const unvisited = tasks.filter(t => !visited.has(t.id));
      if (unvisited.length > 0) {
        es.set(unvisited[0].id, 0);
        ef.set(unvisited[0].id, unvisited[0].estimatedHours);
        visited.add(unvisited[0].id);
        processed++;
        progress = true;
      }
    }
  }

  // 2. 计算最晚开始时间 (LS) 和最晚完成时间 (LF)
  const ls = new Map<string, number>(); // Latest Start
  const lf = new Map<string, number>(); // Latest Finish
  
  const projectDuration = Math.max(...Array.from(ef.values()));
  
  tasks.forEach(task => {
    lf.set(task.id, projectDuration);
  });

  visited = new Set<string>();
  processed = 0;
  
  // 反向遍历
  const reversedTasks = [...tasks].reverse();
  
  while (processed < reversedTasks.length) {
    let progress = false;
    for (const task of reversedTasks) {
      if (visited.has(task.id)) continue;
      
      // 找出依赖此任务的所有任务
      const dependentTasks = tasks.filter(t => 
        t.dependencies?.includes(task.id)
      );
      
      if (dependentTasks.length === 0 || 
          dependentTasks.every(dt => visited.has(dt.id))) {
        // 计算最晚完成时间 = min(依赖此任务的任务的最晚开始时间)
        let minLS = projectDuration;
        for (const depTask of dependentTasks) {
          const depLS = ls.get(depTask.id) || projectDuration;
          minLS = Math.min(minLS, depLS);
        }
        
        lf.set(task.id, minLS);
        ls.set(task.id, minLS - task.estimatedHours);
        visited.add(task.id);
        processed++;
        progress = true;
      }
    }
    
    if (!progress) {
      // 处理孤立任务
      const unvisited = reversedTasks.filter(t => !visited.has(t.id));
      if (unvisited.length > 0) {
        const task = unvisited[0];
        lf.set(task.id, projectDuration);
        ls.set(task.id, projectDuration - task.estimatedHours);
        visited.add(task.id);
        processed++;
        progress = true;
      }
    }
  }

  // 3. 计算总时差并识别关键路径
  const criticalPath: string[] = [];
  tasks.forEach(task => {
    const taskES = es.get(task.id) || 0;
    const taskLS = ls.get(task.id) || 0;
    const slack = taskLS - taskES;
    
    if (slack <= 0) {
      criticalPath.push(task.id);
    }
  });

  return criticalPath;
}

/**
 * 检测资源冲突
 * 返回同一时间段内同一资源被分配给多个任务的冲突
 */
export function detectResourceConflicts(
  tasks: Task[],
  resources: Resource[]
): ResourceConflict[] {
  const conflicts: ResourceConflict[] = [];
  
  // 为每个任务计算具体的时间窗口
  const taskTimeWindows = new Map<string, { start: number; end: number }>();
  
  tasks.forEach(task => {
    if (task.startDate && task.endDate) {
      const start = task.startDate.getTime();
      const end = task.endDate.getTime();
      taskTimeWindows.set(task.id, { start, end });
    }
  });

  // 检查每个资源的分配情况
  resources.forEach(resource => {
    const assignedTasks = tasks.filter(t => t.assignedResources.includes(resource.id));
    
    if (assignedTasks.length < 2) return;
    
    // 检查每对任务是否有时间重叠
    for (let i = 0; i < assignedTasks.length; i++) {
      for (let j = i + 1; j < assignedTasks.length; j++) {
        const task1 = assignedTasks[i];
        const task2 = assignedTasks[j];
        
        const window1 = taskTimeWindows.get(task1.id);
        const window2 = taskTimeWindows.get(task2.id);
        
        if (!window1 || !window2) continue;
        
        // 检查时间重叠
        const hasOverlap = window1.start < window2.end && window2.start < window1.end;
        
        if (hasOverlap) {
          const overlapStart = new Date(Math.max(window1.start, window2.start));
          const overlapEnd = new Date(Math.min(window1.end, window2.end));
          const overlapDuration = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
          
          // 根据重叠时长确定严重程度
          const severity = overlapDuration > task1.estimatedHours * 0.5 ? 'high' : 
                           overlapDuration > task1.estimatedHours * 0.2 ? 'medium' : 'low';
          
          const existingConflict = conflicts.find(
            c => c.resourceId === resource.id && 
            c.tasks.includes(task1.id) && 
            c.tasks.includes(task2.id)
          );
          
          if (!existingConflict) {
            conflicts.push({
              resourceId: resource.id,
              resourceName: resource.name,
              tasks: [task1.id, task2.id],
              timeRange: { start: overlapStart, end: overlapEnd },
              severity,
              suggestedResolution: `建议将任务"${task1.name}"或"${task2.name}"调整为非重叠时间段，或增加${resource.name}的可用性`
            });
          }
        }
      }
    }
  });

  return conflicts;
}

/**
 * 计算资源利用率
 */
export function calculateResourceUtilization(
  tasks: Task[],
  resources: Resource[]
): Record<string, number> {
  const utilization: Record<string, number> = {};
  
  resources.forEach(resource => {
    const assignedTasks = tasks.filter(t => t.assignedResources.includes(resource.id));
    
    if (assignedTasks.length === 0) {
      utilization[resource.id] = 0;
      return;
    }
    
    // 计算总工时
    const totalAssignedHours = assignedTasks.reduce(
      (sum, task) => sum + task.estimatedHours, 
      0
    );
    
    // 考虑可用性系数
    const effectiveCapacity = 8 * 5 * 4 * resource.availability; // 假设4周，每周40小时
    
    utilization[resource.id] = Math.min(totalAssignedHours / effectiveCapacity, 1);
  });

  return utilization;
}

/**
 * 资源负载平衡建议
 */
export function getResourceBalancingRecommendations(
  tasks: Task[],
  resources: Resource[]
): string[] {
  const recommendations: string[] = [];
  const utilization = calculateResourceUtilization(tasks, resources);
  
  // 检查过度负载
  const overloaded = resources.filter(r => (utilization[r.id] || 0) > 0.9);
  if (overloaded.length > 0) {
    const names = overloaded.map(r => r.name).join('、');
    recommendations.push(`${names} 的利用率超过90%，建议：\n  - 考虑增加额外资源\n  - 将部分任务重新分配\n  - 优化任务优先级`);
  }
  
  // 检查低利用率
  const underutilized = resources.filter(r => (utilization[r.id] || 0) < 0.5);
  if (underutilized.length > 0) {
    const names = underutilized.map(r => r.name).join('、');
    recommendations.push(`${names} 的利用率低于50%，建议将部分任务重新分配以提高资源效率`);
  }
  
  // 检查技能不匹配
  resources.forEach(resource => {
    if (resource.skills && resource.skills.length > 0) {
      const assignedTasks = tasks.filter(t => t.assignedResources.includes(resource.id));
      const mismatchedTasks = assignedTasks.filter(task => {
        // 简化判断：如果任务有特定技能标签但资源不匹配
        if (task.tags && task.tags.length > 0) {
          return !task.tags.some(tag => resource.skills?.includes(tag));
        }
        return false;
      });
      
      if (mismatchedTasks.length > 0) {
        recommendations.push(`${resource.name} 的技能与部分任务不匹配，建议重新分配或安排培训`);
      }
    }
  });

  return recommendations;
}

/**
 * 生成排期结果
 */
export function generateSchedule(
  tasks: Task[],
  resources: Resource[],
  startDate: Date = new Date(),
  workingHoursConfig: WorkingHoursConfig = DEFAULT_WORKING_HOURS
): ScheduleResult {
  // 1. 计算关键路径
  const criticalPath = calculateCriticalPath(tasks);
  
  // 2. 生成任务时间表
  const scheduledTasks = tasks.map(task => {
    const isCritical = criticalPath.includes(task.id);
    
    // 根据依赖关系计算开始时间
    let taskStart = new Date(startDate);
    
    // 考虑前置任务
    if (task.dependencies && task.dependencies.length > 0) {
      const depTasks = tasks.filter(t => task.dependencies?.includes(t.id));
      const latestDep = depTasks.reduce((latest, dep) => {
        const depEnd = dep.endDate || taskStart;
        return depEnd > latest ? depEnd : latest;
      }, taskStart);
      taskStart = latestDep;
    }
    
    // 使用自定义工作时间计算结束时间（精确到小时）
    const taskEnd = calculateEndDate(taskStart, task.estimatedHours, workingHoursConfig);
    
    // 计算开始和结束的小时数
    const startHour = taskStart.getHours() + taskStart.getMinutes() / 60;
    const endHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;
    
    return {
      ...task,
      startDate: taskStart,
      endDate: taskEnd,
      startHour,
      endHour,
      isCritical
    };
  });
  
  // 3. 检测资源冲突
  const conflicts = detectResourceConflicts(scheduledTasks, resources);
  
  // 4. 计算资源利用率
  const utilization = calculateResourceUtilization(scheduledTasks, resources);
  
  // 5. 生成警告和建议
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  if (conflicts.length > 0) {
    warnings.push(`检测到 ${conflicts.length} 个资源冲突，需要解决`);
    conflicts.forEach(conflict => {
      recommendations.push(conflict.suggestedResolution || '');
    });
  }
  
  const balancingRecs = getResourceBalancingRecommendations(scheduledTasks, resources);
  recommendations.push(...balancingRecs);
  
  // 6. 计算总工期和总工时
  const latestEndDate = scheduledTasks.reduce((latest, task) => {
    const end = task.endDate || startDate;
    return end > latest ? end : latest;
  }, startDate);
  
  const totalDuration = Math.ceil((latestEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalHours = scheduledTasks.reduce((sum, task) => sum + task.estimatedHours, 0);

  return {
    tasks: scheduledTasks,
    projects: [], // 简化版本，后续可以扩展
    criticalPath,
    criticalChain: criticalPath, // 简化版本
    resourceConflicts: conflicts,
    resourceUtilization: utilization,
    totalDuration,
    totalHours,
    workingHoursConfig,
    warnings,
    recommendations
  };
}
