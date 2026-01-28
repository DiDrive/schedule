import { Task, Resource, ScheduleResult, ResourceConflict, WorkingHoursConfig, ResourceLevel } from '@/types/schedule';

// 默认工作时间配置
const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  startHour: 9.5, // 9:30
  endHour: 19, // 19:00
  workDays: [1, 2, 3, 4, 5], // 周一到周五
  lunchBreakStart: 12, // 12:00 午休开始
  lunchBreakEnd: 13.5 // 13:30 午休结束
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
 * 策略：
 * 1. 被依赖的任务优先获得资源（避免阻塞后续任务）
 * 2. 在满足工作类型匹配的前提下，优先选择负载最低的资源
 * 3. 实现负载均衡，让所有人都有活干
 * 注意：物料任务不分配资源
 */
export function autoAssignResources(tasks: Task[], resources: Resource[]): Task[] {
  // 只有人类资源可以分配
  const humanResources = resources.filter(r => r.type === 'human');

  // 构建任务依赖关系图（用于计算被依赖数）
  const dependentsMap = new Map<string, string[]>();
  tasks.forEach(task => {
    const deps = task.dependencies || [];
    deps.forEach(depId => {
      const list = dependentsMap.get(depId) || [];
      list.push(task.id);
      dependentsMap.set(depId, list);
    });
  });

  // 按以下因素对任务排序（优先级从高到低）：
  // 1. 被依赖数（越多越优先，避免阻塞）
  // 2. 优先级（urgent > high > normal > low）
  // 3. 工时（高工时优先）
  const sortedTasks = [...tasks].sort((a, b) => {
    const aDependents = (dependentsMap.get(a.id) || []).length;
    const bDependents = (dependentsMap.get(b.id) || []).length;

    // 1. 被依赖数：越多越优先（权重最高）
    if (aDependents !== bDependents) {
      return bDependents - aDependents;
    }

    // 2. 优先级
    const aPriority = PRIORITY_WEIGHT[a.priority] || 1;
    const bPriority = PRIORITY_WEIGHT[b.priority] || 1;
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }

    // 3. 工时
    return b.estimatedHours - a.estimatedHours;
  });

  // 跟踪每个资源的已分配工时
  const resourceLoad = new Map<string, number>();
  humanResources.forEach(r => resourceLoad.set(r.id, 0));

  const assignedTasks = sortedTasks.map(task => {
    // 物料任务不分配资源
    if (task.taskType === '物料') {
      return {
        ...task,
        assignedResources: []
      };
    }

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

    // 计算当前平均负载
    const totalLoad = Array.from(resourceLoad.values()).reduce((sum, load) => sum + load, 0);
    const avgLoad = totalLoad / humanResources.length;

    // 评分每个资源：负载优先，效率次之
    const scoredResources = resourcesToScore
      .map(resource => {
        const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
        const currentLoad = resourceLoad.get(resource.id) || 0;

        // 核心策略：负载是主要因素
        // 1. 基础分：1000（确保负载优先级高于效率）
        let score = 1000;

        // 2. 负载惩罚：负载越高，分数越低
        // 使用指数函数放大负载差异
        const loadRatio = currentLoad / Math.max(avgLoad, 1); // 防止除以0
        if (loadRatio > 0) {
          score /= (loadRatio * loadRatio); // 平方惩罚
        }

        // 3. 工作类型匹配分：类型完全匹配加分
        if (taskType && resource.workType === taskType) {
          score *= 2.0;
        }

        // 4. 效率分：效率高略加分，但不能凌驾于负载之上
        score *= (1 + (efficiency - 1) * 0.2); // 最多20%的加成

        // 5. 可用性分
        score *= resource.availability;

        return {
          resource,
          score,
          efficiency,
          load: currentLoad
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

      // 午休时间段
      let lunchBreakStart: Date | null = null;
      let lunchBreakEnd: Date | null = null;
      if (config.lunchBreakStart !== undefined && config.lunchBreakEnd !== undefined) {
        lunchBreakStart = new Date(current);
        lunchBreakStart.setHours(Math.floor(config.lunchBreakStart), (config.lunchBreakStart % 1) * 60, 0, 0);

        lunchBreakEnd = new Date(current);
        lunchBreakEnd.setHours(Math.floor(config.lunchBreakEnd), (config.lunchBreakEnd % 1) * 60, 0, 0);
      }

      // 计算当天的工作小时数
      let workStart = current > startOfDay ? current : startOfDay;
      let workEnd = end < endOfDay ? end : endOfDay;

      if (workStart < workEnd) {
        // 如果有午休时间，需要排除
        if (lunchBreakStart && lunchBreakEnd && lunchBreakStart < lunchBreakEnd) {
          // 分段计算：上午 + 下午
          // 上午工作时间
          const morningEnd = workEnd < lunchBreakStart ? workEnd : lunchBreakStart;
          if (workStart < morningEnd) {
            totalHours += (morningEnd.getTime() - workStart.getTime()) / (1000 * 60 * 60);
          }

          // 下午工作时间
          const afternoonStart = workStart > lunchBreakEnd ? workStart : lunchBreakEnd;
          if (afternoonStart < workEnd) {
            totalHours += (workEnd.getTime() - afternoonStart.getTime()) / (1000 * 60 * 60);
          }
        } else {
          // 没有午休时间，直接计算
          const hours = (workEnd.getTime() - workStart.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
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
 * 考虑午休时间
 * 注意：效率系数不影响工作时间，仅用于资源评估
 */
export function calculateEndDate(startDate: Date, workHours: number, config: WorkingHoursConfig = DEFAULT_WORKING_HOURS): Date {
  const result = new Date(startDate);
  let remainingHours = workHours;

  // 定义午休时间段
  const getLunchBreak = (date: Date) => {
    if (config.lunchBreakStart !== undefined && config.lunchBreakEnd !== undefined) {
      const lunchStart = new Date(date);
      lunchStart.setHours(Math.floor(config.lunchBreakStart), (config.lunchBreakStart % 1) * 60, 0, 0);

      const lunchEnd = new Date(date);
      lunchEnd.setHours(Math.floor(config.lunchBreakEnd), (config.lunchBreakEnd % 1) * 60, 0, 0);

      return { start: lunchStart, end: lunchEnd };
    }
    return null;
  };

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

    // 获取午休时间段
    const lunchBreak = getLunchBreak(result);

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

    // 检查是否在午休时间
    if (lunchBreak && result >= lunchBreak.start && result < lunchBreak.end) {
      // 跳到午休结束
      result.setTime(lunchBreak.end.getTime());
      continue;
    }

    // 计算当天剩余工作时间（考虑午休）
    let availableHours: number;

    if (lunchBreak && lunchBreak.start < lunchBreak.end) {
      // 有午休时间，分段计算
      if (result < lunchBreak.start) {
        // 在午休前，最多工作到午休开始
        availableHours = (lunchBreak.start.getTime() - result.getTime()) / (1000 * 60 * 60);
      } else {
        // 在午休后，最多工作到下班
        availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
      }
    } else {
      // 没有午休时间
      availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
    }

    const hoursToUse = Math.min(remainingHours, availableHours);

    result.setTime(result.getTime() + hoursToUse * 60 * 60 * 1000);
    remainingHours -= hoursToUse;

    // 如果还有剩余工作时间
    if (remainingHours > 0) {
      // 检查是否到达了午休开始，如果是，跳到午休结束继续当天工作
      if (lunchBreak && lunchBreak.start < lunchBreak.end &&
          result.getTime() === lunchBreak.start.getTime()) {
        // 到达午休开始，跳到午休结束继续当天下午工作
        result.setTime(lunchBreak.end.getTime());
      } else if (result.getTime() >= endOfDay.getTime()) {
        // 已经到下班时间，跳到下一天
        result.setDate(result.getDate() + 1);
        result.setHours(0, 0, 0, 0);
      }
      // 否则，继续在同一天工作（比如在午休后还有剩余时间，但已到下班）
    }
  }

  return result;
}

/**
 * 拓扑排序 - 按依赖关系排序任务
 * 改进：考虑任务优先级、截止日期和任务类型
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

  // 调试：输出所有任务的入度和依赖关系
  console.log('\n=== 拓扑排序开始 ===');
  console.log('任务列表:');
  tasks.forEach(task => {
    console.log(`  • "${task.name}": 类型=${task.taskType}, 入度=${inDegree.get(task.id)}, 依赖=${JSON.stringify(task.dependencies || [])}, 被依赖数=${(adj.get(task.id) || []).length}`);
  });
  console.log('=== 拓扑排序开始 ===\n');

  // 任务评分函数：综合考虑优先级、截止日期、依赖关系和任务类型
  // 注意：物料任务不参与评分，因为它们的时间固定，不由我们控制
  const calculateScore = (task: Task): number => {
    // 物料任务直接返回0分，不参与评分竞争
    // 物料任务在拓扑排序开始前会被提前处理
    if (task.taskType === '物料') {
      return 0;
    }

    let score = 0;

    // 1. 【最重要】被其他任务依赖的任务应该优先处理
    // 任何有依赖的任务都应该获得高优先级，因为它阻塞后续任务
    const dependents = adj.get(task.id) || [];
    if (dependents.length > 0) {
      // 基础分：被依赖的任务至少获得2000分
      score += 2000;

      // 被依赖的任务数量越多，分数越高（阻塞更多任务）
      score += dependents.length * 500;
    }

    // 2. 优先级权重
    score += (PRIORITY_WEIGHT[task.priority] || 1) * 1000;

    // 3. 截止日期权重（越接近截止日期，分数越高）
    if (task.deadline) {
      const daysToDeadline = Math.max(0, (task.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToDeadline < 7) {
        score += (7 - daysToDeadline) * 200; // 一周内高权重
      } else if (daysToDeadline < 30) {
        score += (30 - daysToDeadline) * 50; // 一月内中权重
      }
    }

    // 4. 任务工时权重（小任务优先）
    score += 100 / (task.estimatedHours || 1);

    return score;
  };

  // 拓扑排序
  const result: Task[] = [];

  // 使用优先队列：每次选择分数最高的任务
  const getReadyTasks = (): Task[] => {
    const readyTaskIds: string[] = [];
    inDegree.forEach((degree, taskId) => {
      if (degree === 0 && !result.find(t => t.id === taskId)) {
        readyTaskIds.push(taskId);
      }
    });
    return readyTaskIds.map(id => taskMap.get(id)!).filter(Boolean);
  };

  while (result.length < tasks.length) {
    // 获取所有准备好的任务（包括物料任务和非物料任务）
    const readyTasks = getReadyTasks();

    if (readyTasks.length === 0) {
      // 没有准备好的任务，可能存在循环依赖
      const remaining = tasks.filter(t => !result.includes(t));
      if (remaining.length > 0) {
        // 随机选择一个剩余任务
        result.push(remaining[0]);
      }
      break;
    }

    // 按分数排序，选择分数最高的任务
    // 物料任务得分为0，会被排在没有依赖的非物料任务之后
    readyTasks.sort((a, b) => {
      const scoreA = calculateScore(a);
      const scoreB = calculateScore(b);
      return scoreB - scoreA; // 降序排列
    });

    const nextTask = readyTasks[0];
    result.push(nextTask);

    // 调试信息（始终输出）
    console.log(`\n=== 第${result.length + 1}步排序 ===`);
    console.log(`选择: "${nextTask.name}"`);
    console.log(`  - 类型: ${nextTask.taskType}, 优先级: ${nextTask.priority}, 工时: ${nextTask.estimatedHours}h`);
    console.log(`  - 被依赖数: ${(adj.get(nextTask.id) || []).length}, 得分: ${calculateScore(nextTask).toFixed(2)}`);
    console.log(`  - 入度: ${inDegree.get(nextTask.id)}`);
    console.log(`  - 依赖: ${JSON.stringify(nextTask.dependencies)}`);
    console.log(`准备好的任务排序:`);
    readyTasks.forEach((t, index) => {
      const score = calculateScore(t);
      console.log(`  ${index + 1}. "${t.name}" [${t.taskType}] 得分=${score.toFixed(2)}, 入度=${inDegree.get(t.id)}, 依赖数=${(adj.get(t.id) || []).length}, 优先级=${t.priority}`);
    });
    console.log(`=== 第${result.length + 1}步结束 ===\n`);

    // 减少依赖此任务的任务的入度
    const dependents = adj.get(nextTask.id) || [];
    dependents.forEach(depId => {
      const newDegree = (inDegree.get(depId) || 0) - 1;
      inDegree.set(depId, newDegree);
    });
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
 * 说明：
 * - 任务预估工时是"标准人"（效率1.0）完成所需时间
 * - 高效率（1.5倍）人员在相同时间内能完成更多工作
 * - 利用率 = 分配工时 / (可用时间 × 可用性 × 效率)
 * - 例如：高效率人在160小时可完成240小时的标准工时
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

    // 计算分配的标准工时（任务预估工时之和）
    const totalAssignedHours = assignedTasks.reduce(
      (sum, task) => sum + task.estimatedHours,
      0
    );

    // 计算资源有效容量（考虑效率）
    // 假设4周工作：8小时/天 × 5天/周 × 4周 = 160小时（标准人）
    // 高效率（1.5倍）：160 × 1.5 × 可用性 = 可完成的标准工时
    const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
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

  // 3. 按依赖顺序生成任务时间表（考虑资源冲突）
  const taskMap = new Map<string, Task>();
  const scheduledTasks: Task[] = [];

  // 为每个资源记录已安排的任务时间
  const resourceSchedules = new Map<string, Array<{ start: Date; end: Date }>>();
  resources.forEach(resource => {
    resourceSchedules.set(resource.id, []);
  });

  for (const task of sortedTasks) {
    // 物料任务特殊处理
    if (task.taskType === '物料') {
      // 使用实际提供日期（如果有），否则使用预估提供日期
      // 使用用户在界面上选择的精确时间（datetime-local）
      let materialDate = task.actualMaterialDate || task.estimatedMaterialDate || startDate;
      let materialTime = new Date(materialDate);

      // 如果物料提供日期是周末，自动顺延到最近的下一个工作日
      const dayOfWeek = materialTime.getDay();
      if (dayOfWeek === 0) { // 周日
        // 顺延到下周一
        materialTime.setDate(materialTime.getDate() + 1);
      } else if (dayOfWeek === 6) { // 周六
        // 顺延到下周一
        materialTime.setDate(materialTime.getDate() + 2);
      }

      // 物料任务是里程碑，表示在这个时间点提供
      // 开始时间：顺延后的提供时间
      // 结束时间：也是顺延后的提供时间，表示物料在这个时间点立即可用
      const scheduledTask: Task = {
        ...task,
        startDate: new Date(materialTime),
        endDate: new Date(materialTime), // 里程碑，开始和结束时间相同
        isCritical: false,
        assignedResources: [] // 物料任务不分配资源
      };

      taskMap.set(task.id, scheduledTask);
      scheduledTasks.push(scheduledTask);
      continue;
    }

    // 根据依赖关系计算开始时间
    let taskStart = new Date(startDate);

    // 考虑前置任务的结束时间
    if (task.dependencies && task.dependencies.length > 0) {
      let latestDepEnd: Date | null = null;

      for (const depId of task.dependencies) {
        const depTask = taskMap.get(depId);
        if (depTask && depTask.endDate) {
          if (!latestDepEnd || depTask.endDate > latestDepEnd) {
            latestDepEnd = depTask.endDate;
          }
        }
      }

      // 如果有依赖任务，使用最晚的结束时间作为开始时间
      if (latestDepEnd) {
        taskStart = latestDepEnd;
      }
    }

    // 获取分配的资源
    const resourceId = task.assignedResources[0];
    const resourceSchedule = resourceSchedules.get(resourceId) || [];

    // 计算实际工作时间：高效率人员用更少时间完成任务
    // 任务预估工时是"标准人"（效率1.0）完成所需时间
    // 高效率（1.5倍）人员：实际用时 = 预估工时 / 1.5
    // 低效率（0.7倍）人员：实际用时 = 预估工时 / 0.7
    const resource = resources.find(r => r.id === resourceId);
    const efficiency = resource?.efficiency || LEVEL_EFFICIENCY[resource?.level as ResourceLevel] || 1.0;
    const actualWorkHours = task.estimatedHours / efficiency;

    // 检查资源冲突并调整开始时间
    let hasConflict = true;
    let maxIterations = 100; // 防止无限循环
    let iteration = 0;

    while (hasConflict && iteration < maxIterations) {
      hasConflict = false;
      iteration++;

      // 重新检查依赖关系：确保 taskStart 不早于任何依赖任务的结束时间
      if (task.dependencies && task.dependencies.length > 0) {
        let latestDepEnd: Date | null = null;

        for (const depId of task.dependencies) {
          const depTask = taskMap.get(depId);
          if (depTask && depTask.endDate) {
            if (!latestDepEnd || depTask.endDate > latestDepEnd) {
              latestDepEnd = depTask.endDate;
            }
          }
        }

        // 如果当前 taskStart 早于最晚的依赖任务结束时间，则调整为最晚的依赖任务结束时间
        if (latestDepEnd && taskStart < latestDepEnd) {
          taskStart = new Date(latestDepEnd);
        }
      }

      // 计算当前安排的任务结束时间（使用实际工作时间）
      const taskEnd = calculateEndDate(taskStart, actualWorkHours, workingHoursConfig);

      // 检查是否与该资源的其他任务冲突
      for (const scheduled of resourceSchedule) {
        // 检查时间重叠：任务开始 < 已安排任务结束 且 任务结束 > 已安排任务开始
        if (taskStart < scheduled.end && taskEnd > scheduled.start) {
          hasConflict = true;
          // 从冲突任务的结束时间开始
          taskStart = new Date(scheduled.end);
          break;
        }
      }
    }

    // 使用实际工作时间计算最终的结束时间
    const taskEnd = calculateEndDate(taskStart, actualWorkHours, workingHoursConfig);

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

    // 记录到资源时间表
    if (resourceSchedule) {
      resourceSchedule.push({
        start: taskStart,
        end: taskEnd
      });
    }

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
