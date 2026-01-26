import { Task, Resource, ScheduleResult, ResourceConflict, WorkingHoursConfig, ResourceLevel } from '@/types/schedule';

// 默认工作时间配置
const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  startHour: 9.5, // 9:30
  endHour: 19, // 19:00
  workDays: [1, 2, 3, 4, 5] // 周一到周五
};

// 资源等级对应的效率系数
const LEVEL_EFFICIENCY: Record<ResourceLevel, number> = {
  assistant: 0.7,
  junior: 1.0,
  senior: 1.5
};

// 优先级对应的权重
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
  low: 0.5
};

/**
 * 根据任务特征自动分配资源
 * 考虑因素：预估工时、优先级、资源效率、资源可用性、工作类型匹配
 */
export function autoAssignResources(tasks: Task[], resources: Resource[]): Task[] {
  // 只有人类资源可以分配
  const humanResources = resources.filter(r => r.type === 'human');

  // 按优先级和工时对任务排序（高优先级、高工时优先分配）
  const sortedTasks = [...tasks].sort((a, b) => {
    const aWeight = (PRIORITY_WEIGHT[a.priority] || 1) * a.estimatedHours;
    const bWeight = (PRIORITY_WEIGHT[b.priority] || 1) * b.estimatedHours;
    return bWeight - aWeight;
  });

  // 跟踪每个资源的已分配工时
  const resourceLoad = new Map<string, number>();
  humanResources.forEach(r => resourceLoad.set(r.id, 0));

  const assignedTasks = sortedTasks.map(task => {
    // 如果任务已有分配，跳过
    if (task.assignedResources && task.assignedResources.length > 0) {
      return task;
    }

    // 根据任务类型筛选匹配的资源
    const taskType = task.taskType;
    const matchingResources = taskType
      ? humanResources.filter(r => r.workType === taskType)
      : humanResources;

    // 如果没有匹配的资源，使用所有资源（降级处理）
    const resourcesToScore = matchingResources.length > 0 ? matchingResources : humanResources;

    if (resourcesToScore.length === 0) {
      return task;
    }

    // 评分每个资源
    const scoredResources = resourcesToScore
      .map(resource => {
        const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
        const currentLoad = resourceLoad.get(resource.id) || 0;

        // 基础分：效率越高分数越高
        let score = efficiency * 100;

        // 工作类型匹配分：类型完全匹配加分
        if (taskType && resource.workType === taskType) {
          score *= 1.5;
        }

        // 负载分：负载越低分数越高
        const loadPenalty = currentLoad / (8 * 5 * 4 * resource.availability); // 假设4周容量
        score *= (1 - loadPenalty);

        // 可用性分
        score *= resource.availability;

        return {
          resource,
          score,
          efficiency
        };
      })
      .sort((a, b) => b.score - a.score);

    // 选择最高分的资源
    if (scoredResources.length > 0) {
      const selected = scoredResources[0];
      const resourceLoadHours = resourceLoad.get(selected.resource.id) || 0;
      resourceLoad.set(selected.resource.id, resourceLoadHours + task.estimatedHours);

      return {
        ...task,
        assignedResources: [selected.resource.id]
      };
    }

    return task;
  });

  return assignedTasks;
}

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
 * 考虑资源效率
 */
export function calculateEndDate(startDate: Date, workHours: number, config: WorkingHoursConfig = DEFAULT_WORKING_HOURS, resourceEfficiency: number = 1.0): Date {
  // 根据资源效率调整实际需要的工作时间
  const adjustedHours = workHours / resourceEfficiency;

  const result = new Date(startDate);
  let remainingHours = adjustedHours;

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
 * 拓扑排序 - 按依赖关系排序任务
 */
export function topologicalSort(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach(task => taskMap.set(task.id, task));

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  // 初始化
  tasks.forEach(task => {
    inDegree.set(task.id, 0);
    adj.set(task.id, []);
  });

  // 构建图
  tasks.forEach(task => {
    const deps = task.dependencies || [];
    deps.forEach(depId => {
      const depTasks = adj.get(depId) || [];
      depTasks.push(task.id);
      adj.set(depId, depTasks);

      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
    });
  });

  // 拓扑排序
  const result: Task[] = [];
  const queue: string[] = [];

  // 找到所有入度为0的节点
  inDegree.forEach((degree, taskId) => {
    if (degree === 0) {
      queue.push(taskId);
    }
  });

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    const task = taskMap.get(taskId);
    if (task) {
      result.push(task);
    }

    // 减少依赖此任务的任务的入度
    const dependents = adj.get(taskId) || [];
    dependents.forEach(depId => {
      const newDegree = (inDegree.get(depId) || 0) - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) {
        queue.push(depId);
      }
    });
  }

  // 处理循环依赖的情况
  if (result.length < tasks.length) {
    const remaining = tasks.filter(t => !result.includes(t));
    result.push(...remaining);
  }

  return result;
}

/**
 * 计算关键路径 (Critical Path Method - CPM)
 */
export function calculateCriticalPath(tasks: Task[]): string[] {
  // 使用拓扑排序后的任务列表
  const sortedTasks = topologicalSort(tasks);

  const taskMap = new Map<string, Task>();
  sortedTasks.forEach(task => taskMap.set(task.id, task));

  // 1. 计算最早开始时间 (ES) 和最早完成时间 (EF)
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  sortedTasks.forEach(task => {
    es.set(task.id, 0);
  });

  for (const task of sortedTasks) {
    const deps = task.dependencies || [];
    let maxEF = 0;

    for (const depId of deps) {
      const depEF = ef.get(depId) || 0;
      maxEF = Math.max(maxEF, depEF);
    }

    es.set(task.id, maxEF);
    ef.set(task.id, maxEF + task.estimatedHours);
  }

  // 2. 计算最晚开始时间 (LS) 和最晚完成时间 (LF)
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();

  const projectDuration = Math.max(...Array.from(ef.values()));

  sortedTasks.forEach(task => {
    lf.set(task.id, projectDuration);
  });

  // 反向遍历
  for (let i = sortedTasks.length - 1; i >= 0; i--) {
    const task = sortedTasks[i];

    // 找出依赖此任务的所有任务
    const dependentTasks = sortedTasks.filter(t =>
      t.dependencies?.includes(task.id)
    );

    if (dependentTasks.length === 0) {
      lf.set(task.id, projectDuration);
      ls.set(task.id, projectDuration - task.estimatedHours);
    } else {
      let minLS = projectDuration;
      for (const depTask of dependentTasks) {
        const depLS = ls.get(depTask.id) || projectDuration;
        minLS = Math.min(minLS, depLS);
      }
      lf.set(task.id, minLS);
      ls.set(task.id, minLS - task.estimatedHours);
    }
  }

  // 3. 计算总时差并识别关键路径
  const criticalPath: string[] = [];
  sortedTasks.forEach(task => {
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

    // 计算总工时（考虑效率）
    const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
    const totalAssignedHours = assignedTasks.reduce(
      (sum, task) => sum + task.estimatedHours,
      0
    );

    // 考虑可用性系数
    const effectiveCapacity = 8 * 5 * 4 * resource.availability * efficiency;

    utilization[resource.id] = Math.min(totalAssignedHours / effectiveCapacity, 1);
  });

  return utilization;
}

/**
 * 资源负载平衡建议（具体化）
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
    overloaded.forEach(resource => {
      const utilRate = (utilization[resource.id] || 0) * 100;
      const assignedTasks = tasks.filter(t => t.assignedResources.includes(resource.id));

      // 找到可以转移的任务
      const transferableTasks = assignedTasks.filter(task => {
        // 优先级不高的任务
        if (task.priority === 'normal' || task.priority === 'low') {
          return true;
        }
        // 工时较小的任务
        if (task.estimatedHours < 8) {
          return true;
        }
        return false;
      });

      if (transferableTasks.length > 0) {
        const taskNames = transferableTasks.slice(0, 3).map(t => t.name).join('、');
        recommendations.push(
          `${resource.name} 的利用率已达到 ${utilRate.toFixed(0)}%，负载过高。建议将任务「${taskNames}」${transferableTasks.length > 3 ? '等' : ''}转移到其他资源。`
        );
      } else {
        recommendations.push(
          `${resource.name} 的利用率已达到 ${utilRate.toFixed(0)}%，建议：\n  • 增加一名新成员分担任务\n  • 调整任务优先级，优先处理关键路径任务\n  • 考虑提高该资源的可用性系数`
        );
      }
    });
  }

  // 检查低利用率
  const underutilized = resources.filter(r => (utilization[r.id] || 0) < 0.5 && (utilization[r.id] || 0) > 0);
  if (underutilized.length > 0) {
    underutilized.forEach(resource => {
      const utilRate = (utilization[resource.id] || 0) * 100;
      const assignedTasks = tasks.filter(t => t.assignedResources.includes(resource.id));

      // 找到忙碌的资源
      const busyResources = resources.filter(r =>
        (utilization[r.id] || 0) > 0.8 && r.id !== resource.id
      );

      if (busyResources.length > 0 && assignedTasks.length > 0) {
        const busyResource = busyResources[0];
        const resourceEfficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
        const busyResourceEfficiency = busyResource.efficiency || LEVEL_EFFICIENCY[busyResource.level as ResourceLevel] || 1.0;

        if (resourceEfficiency >= busyResourceEfficiency) {
          const busyTasks = tasks.filter(t => t.assignedResources.includes(busyResource.id));
          const transferCandidates = busyTasks.slice(0, 2);
          const taskNames = transferCandidates.map(t => t.name).join('、');

          recommendations.push(
            `${resource.name} 的利用率仅 ${utilRate.toFixed(0)}%，可以承接更多任务。建议将 ${busyResource.name} 的任务「${taskNames}」转移给 ${resource.name}，以平衡资源负载。`
          );
        } else {
          recommendations.push(
            `${resource.name} 的利用率仅 ${utilRate.toFixed(0)}%，建议优先分配小任务或提高该成员的效率等级。`
          );
        }
      }
    });
  }

  // 检查未使用的资源
  const unusedResources = resources.filter(r => (utilization[r.id] || 0) === 0 && r.type === 'human');
  if (unusedResources.length > 0) {
    unusedResources.forEach(resource => {
      recommendations.push(
        `${resource.name} 当前未分配任何任务。建议：\n  • 检查是否需要添加新任务\n  • 评估该成员的技能是否匹配当前任务\n  • 考虑从繁忙资源处转移部分任务`
      );
    });
  }

  return recommendations;
}

/**
 * 生成排期结果（修复依赖关系）
 */
export function generateSchedule(
  tasks: Task[],
  resources: Resource[],
  startDate: Date = new Date(),
  workingHoursConfig: WorkingHoursConfig = DEFAULT_WORKING_HOURS
): ScheduleResult {
  // 1. 自动分配资源（如果任务没有分配资源）
  const tasksWithResources = autoAssignResources(tasks, resources);

  // 2. 拓扑排序，确保依赖顺序
  const sortedTasks = topologicalSort(tasksWithResources);

  // 3. 按依赖顺序生成任务时间表
  const taskMap = new Map<string, Task>();
  const scheduledTasks: Task[] = [];

  for (const task of sortedTasks) {
    // 根据依赖关系计算开始时间
    let taskStart = new Date(startDate);

    // 考虑前置任务的结束时间
    if (task.dependencies && task.dependencies.length > 0) {
      let latestDepEnd = taskStart;

      for (const depId of task.dependencies) {
        const depTask = taskMap.get(depId);
        if (depTask && depTask.endDate) {
          if (depTask.endDate > latestDepEnd) {
            latestDepEnd = depTask.endDate;
          }
        }
      }

      taskStart = latestDepEnd;
    }

    // 获取分配的资源效率
    const resourceId = task.assignedResources[0];
    const resource = resources.find(r => r.id === resourceId);
    const efficiency = resource?.efficiency || LEVEL_EFFICIENCY[resource?.level as ResourceLevel] || 1.0;

    // 使用自定义工作时间计算结束时间（精确到小时，考虑效率）
    const taskEnd = calculateEndDate(taskStart, task.estimatedHours, workingHoursConfig, efficiency);

    // 计算开始和结束的小时数
    const startHour = taskStart.getHours() + taskStart.getMinutes() / 60;
    const endHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;

    const scheduledTask: Task = {
      ...task,
      startDate: taskStart,
      endDate: taskEnd,
      startHour,
      endHour,
      isCritical: false
    };

    taskMap.set(task.id, scheduledTask);
    scheduledTasks.push(scheduledTask);
  }

  // 4. 计算关键路径（使用排好期的任务）
  const criticalPath = calculateCriticalPath(scheduledTasks);

  // 更新关键路径标记
  scheduledTasks.forEach(task => {
    if (criticalPath.includes(task.id)) {
      task.isCritical = true;
    }
  });

  // 5. 检测资源冲突
  const conflicts = detectResourceConflicts(scheduledTasks, resources);

  // 6. 计算资源利用率
  const utilization = calculateResourceUtilization(scheduledTasks, resources);

  // 7. 生成警告和建议
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

  // 8. 计算总工期和总工时
  const latestEndDate = scheduledTasks.reduce((latest, task) => {
    const end = task.endDate || startDate;
    return end > latest ? end : latest;
  }, startDate);

  const totalDuration = Math.ceil((latestEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalHours = scheduledTasks.reduce((sum, task) => sum + task.estimatedHours, 0);

  return {
    tasks: scheduledTasks,
    projects: [],
    criticalPath,
    criticalChain: criticalPath,
    resourceConflicts: conflicts,
    resourceUtilization: utilization,
    totalDuration,
    totalHours,
    workingHoursConfig,
    warnings,
    recommendations
  };
}
