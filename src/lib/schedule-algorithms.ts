import { Task, Resource, ScheduleResult, ResourceConflict, WorkingHoursConfig, ResourceLevel, ResourceConflictStrategy, ConflictTask } from '@/types/schedule';

// 默认工作时间配置
const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  startHour: 9.5, // 9:30
  endHour: 18.5, // 18:30
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
  console.log('========================================');
  console.log('开始资源分配');
  console.log(`任务数: ${tasks.length}, 资源数: ${resources.length}`);

  // 只有人类资源可以分配
  const humanResources = resources.filter(r => r.type === 'human');
  console.log(`人类资源: ${humanResources.map(r => `${r.name}(${r.workType})`).join(', ')}`);

  // 清除所有任务的自动分配资源（保留指定资源）
  const cleanedTasks = tasks.map(task => {
    if (task.fixedResourceId) {
      // 有指定资源的任务，保留 fixedResourceId，但清除 assignedResources
      return { ...task, assignedResources: [] };
    }
    // 没有指定资源的任务，清除所有分配信息
    return { ...task, assignedResources: [] };
  });

  // 构建任务依赖关系图（用于计算被依赖数）
  const dependentsMap = new Map<string, string[]>();
  cleanedTasks.forEach(task => {
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
  const sortedTasks = [...cleanedTasks].sort((a, b) => {
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

  // ★★★ 识别并发任务组（从同一时间开始的任务）★★★
  // 并发任务是指：依赖关系相同，预期会从同一时间开始
  const taskGroups = new Map<string, Task[]>();
  sortedTasks.forEach(task => {
    const depKey = (task.dependencies || []).sort().join(',');
    if (!taskGroups.has(depKey)) {
      taskGroups.set(depKey, []);
    }
    taskGroups.get(depKey)!.push(task);
  });

  // 跟踪每个资源的已分配工时
  const resourceLoad = new Map<string, number>();
  humanResources.forEach(r => resourceLoad.set(r.id, 0));

  // 跟踪每个并发任务组已使用的资源（避免同一组任务分配给同一人）
  const groupUsedResources = new Map<string, Set<string>>();

  // 记录每个资源已经分配的任务（用于计算时间冲突）
  const resourceTasks = new Map<string, Task[]>();
  humanResources.forEach(r => resourceTasks.set(r.id, []));

  const assignedTasks = sortedTasks.map(task => {
    // 物料任务不分配资源
    if (task.taskType === '物料') {
      console.log(`  ⚪ 任务 ${task.name} 是物料任务，不分配资源`);
      return {
        ...task,
        assignedResources: []
      };
    }

    // 如果任务有指定资源，优先使用指定资源
    if (task.fixedResourceId) {
      console.log(`  🔧 任务 ${task.name} 有指定资源 ID: ${task.fixedResourceId}`);
      const fixedResource = humanResources.find(r => r.id === task.fixedResourceId);
      if (fixedResource) {
        console.log(`  ✓ 找到指定资源: ${fixedResource.name} (类型: ${fixedResource.workType})`);
        console.log(`  ✓ 任务类型: ${task.taskType}`);
        // 检查指定资源是否匹配任务类型
        if (task.taskType && fixedResource.workType !== task.taskType) {
          console.warn(`  ⚠ 任务 ${task.name} 指定的资源 ${fixedResource.name} 类型不匹配（任务类型: ${task.taskType}, 资源类型: ${fixedResource.workType}），将自动分配其他资源`);
        } else {
          // 使用指定资源
          const resourceLoadHours = resourceLoad.get(fixedResource.id) || 0;
          resourceLoad.set(fixedResource.id, resourceLoadHours + task.estimatedHours);

          const tasksForResource = resourceTasks.get(fixedResource.id) || [];
          tasksForResource.push(task);
          resourceTasks.set(fixedResource.id, tasksForResource);

          console.log(`  ✅ 任务 ${task.name} 使用指定资源: ${fixedResource.name} ✅`);

          return {
            ...task,
            assignedResources: [fixedResource.id]
          };
        }
      } else {
        console.warn(`  ⚠ 任务 ${task.name} 指定的资源 ${task.fixedResourceId} 不存在，将自动分配其他资源`);
      }
    }

    console.log(`  📋 任务 ${task.name} (${task.estimatedHours}h, 优先级: ${task.priority})`);

    // 移除"如果任务已有分配，跳过"的逻辑，始终重新分配以实现负载均衡
    // 注释掉以下代码：
    // if (task.assignedResources && task.assignedResources.length > 0) {
    //   return task;
    // }

    // 根据任务类型筛选匹配的资源
    const taskType = task.taskType;
    let matchingResources = taskType
      ? humanResources.filter(r => r.workType === taskType)
      : humanResources;

    // 如果没有匹配的资源，使用所有资源（降级处理）
    let resourcesToScore = matchingResources.length > 0 ? matchingResources : humanResources;

    // ★★★ 排除同一并发任务组已使用的资源 ★★★
    const depKey = (task.dependencies || []).sort().join(',');
    const usedResources = groupUsedResources.get(depKey);
    if (usedResources && usedResources.size > 0) {
      resourcesToScore = resourcesToScore.filter(r => !usedResources.has(r.id));
      // 如果过滤后没有资源，回退到所有可用资源
      if (resourcesToScore.length === 0) {
        console.log(`  ⚠ 任务 ${task.name} 的并发任务组已用完所有资源，回退到所有可用资源`);
        resourcesToScore = matchingResources.length > 0 ? matchingResources : humanResources;
      } else {
        console.log(`  ✓ 排除已用资源: ${Array.from(usedResources).join(', ')}`);
      }
    }

    // 调试日志
    console.log(`任务 ${task.name} (${taskType || '未指定'}), 匹配资源: ${resourcesToScore.map(r => r.name).join(', ')}`);

    if (resourcesToScore.length === 0) {
      console.log(`  ⚠ 没有可分配的资源！`);
      return task;
    }

    // 计算当前平均负载
    const totalLoad = Array.from(resourceLoad.values()).reduce((sum, load) => sum + load, 0);
    const avgLoad = totalLoad / humanResources.length;

    // ★★★ 综合评分公式：累计工时 + 效率 ★★★
    // 评分 = 工时得分 + 效率得分
    // 工时得分（权重：70%）：累计工时越低得分越高
    //   - 得分范围：0-100
    //   - 公式：100 - (累计工时 / 平均工时 + 1) * 70
    //   - 如果所有资源工时都是0，得分为100
    //   - 差异1小时的工时会导致约7分的差异
    // 效率得分（权重：30%）：效率越高得分越高
    //   - 得分范围：30-60（效率1.0-2.0）

    const sortedResources = [...resourcesToScore].sort((a, b) => {
      const loadA = resourceLoad.get(a.id) || 0;
      const loadB = resourceLoad.get(b.id) || 0;

      const effA = a.efficiency || LEVEL_EFFICIENCY[a.level as ResourceLevel] || 1.0;
      const effB = b.efficiency || LEVEL_EFFICIENCY[b.level as ResourceLevel] || 1.0;

      // 工时得分：累计工时越低得分越高（使用更平滑的公式）
      const hoursScoreA = 100 - (loadA / (avgLoad + 1)) * 70;
      const hoursScoreB = 100 - (loadB / (avgLoad + 1)) * 70;

      // 效率得分：效率越高得分越高
      const effScoreA = effA * 30;
      const effScoreB = effB * 30;

      // 综合得分
      const totalScoreA = hoursScoreA * 0.7 + effScoreA * 0.3;
      const totalScoreB = hoursScoreB * 0.7 + effScoreB * 0.3;

      // 添加调试日志
      console.log(`    ${a.name}: 负载=${loadA}h, 工时得分=${hoursScoreA.toFixed(1)}, 效率=${effA}, 效率得分=${effScoreA.toFixed(1)}, 总分=${totalScoreA.toFixed(1)}`);
      console.log(`    ${b.name}: 负载=${loadB}h, 工时得分=${hoursScoreB.toFixed(1)}, 效率=${effB}, 效率得分=${effScoreB.toFixed(1)}, 总分=${totalScoreB.toFixed(1)}`);

      return totalScoreB - totalScoreA; // 得分高的排在前面
    });

    // 选择负载最低的资源
    const selectedResource = sortedResources[0];

    // 调试日志
    const resourceLoadHours = resourceLoad.get(selectedResource.id) || 0;
    console.log(`  → 分配给 ${selectedResource.name} (负载: ${resourceLoadHours}h, 效率: ${selectedResource.efficiency || LEVEL_EFFICIENCY[selectedResource.level as ResourceLevel] || 1.0})`);
    console.log(`     所有资源负载: ${sortedResources.map(r => `${r.name}:${resourceLoad.get(r.id) || 0}h`).join(', ')}`);

    // 更新资源负载
    resourceLoad.set(selectedResource.id, resourceLoadHours + task.estimatedHours);

    // ★★★ 标记该资源为并发任务组已使用 ★★★
    if (!groupUsedResources.has(depKey)) {
      groupUsedResources.set(depKey, new Set());
    }
    groupUsedResources.get(depKey)!.add(selectedResource.id);

    // 记录任务到资源列表
    const tasksForResource = resourceTasks.get(selectedResource.id) || [];
    tasksForResource.push(task);
    resourceTasks.set(selectedResource.id, tasksForResource);

    return {
      ...task,
      assignedResources: [selectedResource.id]
    };
  });

  console.log('资源分配完成');
  console.log('========================================');

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
 * 检测资源冲突（在调度前）
 * 返回所有指定资源的任务冲突
 */
export function detectResourceConflicts(
  tasks: Task[],
  resources: Resource[],
  scheduleResult?: ScheduleResult
): Map<string, ConflictTask[]> {
  const conflictsMap = new Map<string, ConflictTask[]>();

  // 如果提供了排期结果，使用排期结果中的任务；否则使用原始任务
  const tasksToCheck = scheduleResult ? scheduleResult.tasks : tasks;

  // 找出所有有指定资源的任务
  const tasksWithFixedResource = tasksToCheck.filter(t => t.fixedResourceId && t.taskType !== '物料');

  // 按资源分组
  tasksWithFixedResource.forEach(task => {
    const resourceId = task.fixedResourceId!;
    if (!conflictsMap.has(resourceId)) {
      conflictsMap.set(resourceId, []);
    }

    // 使用排期结果中的时间，如果没有则使用预估时间
    const taskStart = task.startDate || new Date(); // 使用实际排期开始时间
    const resource = resources.find(r => r.id === resourceId);
    const efficiency = resource?.efficiency || LEVEL_EFFICIENCY[resource?.level as ResourceLevel] || 1.0;
    const actualWorkHours = task.estimatedHours / efficiency;

    // 计算任务结束时间（使用排期结束时间或重新计算）
    const taskEnd = task.endDate || calculateEndDate(taskStart, actualWorkHours);

    conflictsMap.get(resourceId)!.push({
      task,
      startTime: taskStart,
      endTime: taskEnd,
      resourceId,
      resourceName: resource?.name || '未知资源'
    });
  });

  // 检查每个资源的任务是否有时间冲突
  const actualConflicts = new Map<string, ConflictTask[]>();

  conflictsMap.forEach((conflictTasks, resourceId) => {
    // 如果只有一个任务，没有冲突
    if (conflictTasks.length <= 1) return;

    // 检查所有任务的时间是否重叠
    let hasConflict = false;
    for (let i = 0; i < conflictTasks.length; i++) {
      for (let j = i + 1; j < conflictTasks.length; j++) {
        const task1 = conflictTasks[i];
        const task2 = conflictTasks[j];

        // 检查时间重叠
        if (task1.startTime < task2.endTime && task1.endTime > task2.startTime) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) break;
    }

    if (hasConflict) {
      actualConflicts.set(resourceId, conflictTasks);
    }
  });

  return actualConflicts;
}

/**
 * 生成排期结果（修复依赖关系）
 */
export function generateSchedule(
  tasks: Task[],
  resources: Resource[],
  startDate: Date = new Date(),
  workingHoursConfig: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
  conflictStrategy: ResourceConflictStrategy = 'auto-switch',
  taskConflictResolutions?: Map<string, 'switch' | 'delay'> // 任务ID -> 处理方式
): ScheduleResult {
  // 1. 自动分配资源（如果任务没有分配资源）
  const tasksWithResources = autoAssignResources(tasks, resources);

  // 2. 并行调度算法：同时安排可并行的任务
  const taskMap = new Map<string, Task>();
  const scheduledTasks: Task[] = [];

  // 记录哪些任务因为指定资源冲突而延后了
  const tasksDelayedByFixedResource: string[] = [];

  // 为每个资源记录已安排的任务时间
  const resourceSchedules = new Map<string, Array<{ start: Date; end: Date }>>();
  resources.forEach(resource => {
    resourceSchedules.set(resource.id, []);
  });

  // 为每个资源记录累计工时
  const resourceLoad = new Map<string, number>();
  resources.forEach(resource => {
    resourceLoad.set(resource.id, 0);
  });

  // 创建任务集合，用于快速查找未安排的任务
  const unscheduledTasks = new Set(tasksWithResources.map(t => t.id));

  // 循环直到所有任务都被安排
  while (unscheduledTasks.size > 0) {
    // 找出所有"可用任务"：依赖已满足且未安排的任务
    const availableTasks = tasksWithResources.filter(task =>
      unscheduledTasks.has(task.id) &&
      areDependenciesSatisfied(task, taskMap)
    );

    if (availableTasks.length === 0) {
      // 找出未安排的任务及其依赖
      const unscheduledTasksList = tasksWithResources.filter(task => unscheduledTasks.has(task.id));
      console.error('无法继续调度：存在循环依赖或无法满足的依赖');
      console.error('未安排的任务:', unscheduledTasksList.map(t => `${t.name} (${t.id})`));
      console.error('未安排任务的依赖:', unscheduledTasksList.map(t => ({
        name: t.name,
        id: t.id,
        dependencies: t.dependencies,
        satisfiedDeps: t.dependencies?.filter(depId => taskMap.has(depId)) || [],
        unsatisfiedDeps: t.dependencies?.filter(depId => !taskMap.has(depId)) || []
      })));
      break;
    }

    console.log(`当前可并行任务数: ${availableTasks.length}, 任务: ${availableTasks.map(t => t.name).join(', ')}`);

    // 为所有可用任务同时安排时间（实现并行）
    for (const task of availableTasks) {
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
        unscheduledTasks.delete(task.id); // 从未安排集合中移除
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
    let resourceId = task.assignedResources[0];
    let resource = resources.find(r => r.id === resourceId);

    if (!resource) {
      console.error(`  ⚠ 资源 ${resourceId} 不存在！`);
      continue; // 跳过这个任务
    }

    // 检查资源冲突并调整开始时间
    let hasConflict = true;
    let maxIterations = 100; // 防止无限循环
    let iteration = 0;

    console.log(`  调度开始: 任务 ${task.name}, 原始资源: ${resource.name} (类型: ${resource.workType})`);

    // 检查用户是否为该任务选择了处理方式
    const userResolution = taskConflictResolutions?.get(task.id);

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

      // 计算实际工作时间：高效率人员用更少时间完成任务
      const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
      const actualWorkHours = task.estimatedHours / efficiency;
      const taskEnd = calculateEndDate(taskStart, actualWorkHours, workingHoursConfig);

      // 获取当前资源的时间表
      const resourceSchedule = resourceSchedules.get(resourceId) || [];

      // 检查是否与该资源的其他任务冲突
      console.log(`    第${iteration}次检查: 开始时间 ${taskStart.toLocaleString()}, 结束时间 ${taskEnd.toLocaleString()}`);
      console.log(`    资源 ${resource.name} 已安排任务: ${resourceSchedule.length}个`);

      for (const scheduled of resourceSchedule) {
        console.log(`      已安排: ${scheduled.start.toLocaleString()} - ${scheduled.end.toLocaleString()}`);
        // 检查时间重叠：任务开始 < 已安排任务结束 且 任务结束 > 已安排任务开始
        if (taskStart < scheduled.end && taskEnd > scheduled.start) {
          hasConflict = true;
          const overlapStart = taskStart > scheduled.start ? taskStart : scheduled.start;
          const overlapEnd = taskEnd < scheduled.end ? taskEnd : scheduled.end;
          console.log(`      ⚠ 检测到冲突: 重叠时间 ${overlapStart.toLocaleString()} - ${overlapEnd.toLocaleString()}`);

          // 计算等待当前资源完成的时间
          const waitCurrentResource = scheduled.end.getTime() - taskStart.getTime();
          const waitCurrentHours = waitCurrentResource / (1000 * 60 * 60);

          // 根据冲突处理策略决定是否允许切换资源
          // 优先使用用户的选择，如果没有则使用默认策略
          // ★★★ 修复：移除 !task.fixedResourceId 条件，允许指定资源的任务也能自动切换 ★★★
          const allowSwitch = userResolution === 'switch' || (userResolution === undefined && conflictStrategy === 'auto-switch');

      // 如果允许切换，比较等待指定资源和其他资源的时间
      if (allowSwitch) {
            const bestOption = findBestResourceWithWaitTime(
              task,
              resources,
              taskStart,
              actualWorkHours,
              workingHoursConfig,
              resourceSchedules,
              resourceId, // 排除当前资源
              resourceLoad // 传入累计工时信息
            );

            if (bestOption.resource) {
              // 比较等待时间
              if (bestOption.isAvailableNow) {
                // 有完全空闲的资源，立即切换
                console.log(`      ✓ 发现空闲资源: ${bestOption.resource.name}，立即切换资源（无需等待）`);
                resource = bestOption.resource;
                resourceId = bestOption.resource.id;
                hasConflict = false; // 重置冲突标记，使用新资源重新检查
                break; // 退出冲突检查循环，重新开始
              } else {
                // 没有空闲资源，比较等待时间
                const waitAlternativeHours = bestOption.waitTime / (1000 * 60 * 60);
                console.log(`      ⚖️ 等待时间比较:`);
                console.log(`        - 等待${resource.name}（当前资源）: ${waitCurrentHours.toFixed(1)}小时`);
                console.log(`        - 等待${bestOption.resource.name}: ${waitAlternativeHours.toFixed(1)}小时`);

                if (waitAlternativeHours < waitCurrentHours) {
                  // 切换到等待时间更短的资源
                  console.log(`      ✓ 切换到${bestOption.resource.name}（节省${(waitCurrentHours - waitAlternativeHours).toFixed(1)}小时）`);
                  resource = bestOption.resource;
                  resourceId = bestOption.resource.id;
                  taskStart = bestOption.adjustedTaskStart;
                  hasConflict = false; // 重置冲突标记，使用新资源重新检查
                  break; // 退出冲突检查循环，重新开始
                } else {
                  console.log(`      → 继续等待${resource.name}（等待时间更短）`);
                }
              }
            }
          }

          // 记录因为冲突而延后的任务
          if (!tasksDelayedByFixedResource.includes(task.id)) {
            tasksDelayedByFixedResource.push(task.id);
          }

          // 调整开始时间为冲突任务的结束时间
          console.log(`      → 调整开始时间为 ${scheduled.end.toLocaleString()}`);
          taskStart = new Date(scheduled.end);
          break;
        }
      }

      if (!hasConflict) {
        console.log(`    ✓ 无冲突，时间安排成功 (资源: ${resource.name})`);
      }
    }

    if (iteration >= maxIterations) {
      console.error(`    ⚠ 调度失败：超过最大迭代次数`);
    }

    // 使用实际工作时间计算最终的结束时间
    // 重新计算实际工作时间（因为资源可能已经切换）
    const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
    const finalActualWorkHours = task.estimatedHours / efficiency;
    const taskEnd = calculateEndDate(taskStart, finalActualWorkHours, workingHoursConfig);

    // 计算开始和结束的小时数
    const startHour = taskStart.getHours() + taskStart.getMinutes() / 60;
    const endHour = taskEnd.getHours() + taskEnd.getMinutes() / 60;

    const scheduledTask: Task = {
      ...task,
      startDate: taskStart,
      endDate: taskEnd,
      startHour,
      endHour,
      assignedResources: [resourceId], // 使用最终选择的资源ID（可能已经切换）
      isCritical: false
    };

    // 记录到资源时间表
    const finalResourceSchedule = resourceSchedules.get(resourceId) || [];
    finalResourceSchedule.push({
      start: taskStart,
      end: taskEnd
    });
    resourceSchedules.set(resourceId, finalResourceSchedule);

    // 更新累计工时
    const currentLoad = resourceLoad.get(resourceId) || 0;
    resourceLoad.set(resourceId, currentLoad + task.estimatedHours);

      taskMap.set(task.id, scheduledTask);
      scheduledTasks.push(scheduledTask);
      unscheduledTasks.delete(task.id); // 从未安排集合中移除
    } // end for (const task of availableTasks)
  } // end while (unscheduledTasks.size > 0)

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

  const totalConflicts = Array.from(conflicts.values()).flat().length;
  if (totalConflicts > 0) {
    warnings.push(`检测到 ${totalConflicts} 个资源冲突，需要解决`);
    conflicts.forEach((conflictTasks) => {
      conflictTasks.forEach(conflictTask => {
        const resourceId = conflictTask.resourceId;
        recommendations.push(`资源 ${conflictTask.resourceName} 的任务 "${conflictTask.task.name}" 存在时间冲突`);
      });
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

  // 生成关于冲突延后的警告
  if (tasksDelayedByFixedResource.length > 0) {
    const delayedTaskNames = tasksDelayedByFixedResource
      .map(taskId => scheduledTasks.find(t => t.id === taskId)?.name)
      .filter(Boolean)
      .join(', ');

    warnings.push(`以下任务因为资源冲突而延后：${delayedTaskNames}`);
    recommendations.push(`建议：检查这些任务的资源分配，考虑调整处理策略或增加资源`);
  }

  // 将 Map<string, ConflictTask[]> 转换为 ResourceConflict[]
  const resourceConflicts: ResourceConflict[] = [];
  conflicts.forEach((conflictTasks, resourceId) => {
    if (conflictTasks.length > 1) {
      const resource = resources.find(r => r.id === resourceId);
      resourceConflicts.push({
        resourceId,
        resourceName: resource?.name || '未知资源',
        tasks: conflictTasks.map(ct => ct.task.id),
        timeRange: {
          start: conflictTasks[0].startTime,
          end: conflictTasks[conflictTasks.length - 1].endTime
        },
        severity: 'high',
        suggestedResolution: `多个任务指定了同一人员 ${resource?.name || '未知资源'}，需要调整资源分配或任务时间`
      });
    }
  });

  // 基于最终的排期结果重新检测冲突
  const finalConflictsMap = detectResourceConflicts(scheduledTasks, resources);
  
  // 将 Map 转换为 ResourceConflict 数组
  const finalConflicts: ResourceConflict[] = [];
  finalConflictsMap.forEach((conflictTasks, resourceId) => {
    if (conflictTasks.length > 1) {
      const resource = resources.find(r => r.id === resourceId);
      const taskIds = conflictTasks.map(ct => ct.task.id);
      
      // 计算冲突的时间范围（所有任务的重叠部分）
      let start = conflictTasks[0].startTime;
      let end = conflictTasks[0].endTime;
      
      conflictTasks.forEach(ct => {
        if (ct.startTime > start) start = ct.startTime;
        if (ct.endTime < end) end = ct.endTime;
      });
      
      finalConflicts.push({
        resourceId,
        resourceName: resource?.name || '未知资源',
        tasks: taskIds,
        timeRange: { start, end },
        severity: 'high',
        suggestedResolution: `多个任务指定了同一人员 ${resource?.name || '未知资源'}，需要调整资源分配或任务时间`
      });
    }
  });

  return {
    tasks: scheduledTasks,
    projects: [],
    criticalPath,
    criticalChain: criticalPath,
    resourceConflicts: finalConflicts,
    resourceUtilization: utilization,
    totalDuration,
    totalHours,
    workingHoursConfig,
    warnings,
    recommendations
  };
}
/**
 * 检查任务的所有依赖是否已满足
 */
function areDependenciesSatisfied(task: Task, taskMap: Map<string, Task>): boolean {
  if (!task.dependencies || task.dependencies.length === 0) {
    return true;
  }

  // 检查所有依赖任务是否都已被安排
  return task.dependencies.every(depId => taskMap.has(depId));
}

/**
 * 查找最优资源（考虑等待时间）
 * 如果有完全空闲的资源，优先选择空闲的
 * 如果没有空闲资源，比较等待指定资源和其他资源的时间，选择等待时间更短的
 */
function findBestResourceWithWaitTime(
  task: Task,
  resources: Resource[],
  taskStart: Date,
  actualWorkHours: number,
  workingHoursConfig: WorkingHoursConfig,
  resourceSchedules: Map<string, Array<{ start: Date; end: Date }>>,
  excludeResourceId?: string,
  resourceLoad?: Map<string, number>
): { 
  resource: Resource | null; 
  waitTime: number; 
  isAvailableNow: boolean;
  adjustedTaskStart: Date;
  adjustedTaskEnd: Date;
} {
  // 找出所有匹配的资源（相同工作类型且是人类资源）
  const matchingResources = resources.filter(r =>
    r.type === 'human' &&
    r.workType === task.taskType &&
    r.id !== excludeResourceId // 排除当前资源
  );

  if (matchingResources.length === 0) {
    return { resource: null, waitTime: Infinity, isAvailableNow: false, adjustedTaskStart: taskStart, adjustedTaskEnd: calculateEndDate(taskStart, actualWorkHours, workingHoursConfig) };
  }

  // 计算任务的结束时间（用于检测重叠）
  const originalTaskEnd = calculateEndDate(taskStart, actualWorkHours, workingHoursConfig);

  // 评估每个资源的等待时间
  const resourceOptions = matchingResources.map(resource => {
    const schedule = resourceSchedules.get(resource.id) || [];
    
    // 找出所有与任务时间重叠的已安排任务
    const overlappingTasks = schedule.filter(scheduled =>
      taskStart < scheduled.end && originalTaskEnd > scheduled.start
    );

    // 如果没有重叠，资源立即可用
    if (overlappingTasks.length === 0) {
      return {
        resource,
        waitTime: 0,
        isAvailableNow: true,
        adjustedTaskStart: taskStart,
        adjustedTaskEnd: originalTaskEnd
      };
    }

    // 有重叠，计算最早可用时间
    // 需要考虑所有重叠任务，找到最晚的结束时间
    let latestEnd = overlappingTasks.reduce((max, task) => task.end > max ? task.end : max, new Date(0));
    
    // 如果当前开始时间比最晚结束时间还要晚，那就直接使用当前开始时间
    let adjustedStart = taskStart > latestEnd ? taskStart : latestEnd;
    
    // 重新检查依赖关系：确保调整后的开始时间满足依赖
    // （在调用此函数之前已经检查过依赖，这里假设依赖已经满足）
    
    // 计算调整后的结束时间
    const efficiency = resource.efficiency || LEVEL_EFFICIENCY[resource.level as ResourceLevel] || 1.0;
    const adjustedEnd = calculateEndDate(adjustedStart, actualWorkHours, workingHoursConfig);
    
    // 计算等待时间（从当前计划开始时间到实际开始时间）
    const waitTime = adjustedStart.getTime() - taskStart.getTime();
    
    return {
      resource,
      waitTime,
      isAvailableNow: false,
      adjustedTaskStart: adjustedStart,
      adjustedTaskEnd: adjustedEnd
    };
  });

  // 先检查是否有立即可用的资源
  const availableNow = resourceOptions.filter(opt => opt.isAvailableNow);
  if (availableNow.length > 0) {
    // 有空闲资源，使用综合评分选择最优的
    const avgLoad = availableNow.reduce((sum, opt) => sum + (resourceLoad?.get(opt.resource.id) || 0), 0) / availableNow.length;

    availableNow.sort((a, b) => {
      const loadA = resourceLoad?.get(a.resource.id) || 0;
      const loadB = resourceLoad?.get(b.resource.id) || 0;

      const effA = a.resource.efficiency || LEVEL_EFFICIENCY[a.resource.level as ResourceLevel] || 1.0;
      const effB = b.resource.efficiency || LEVEL_EFFICIENCY[b.resource.level as ResourceLevel] || 1.0;

      const hoursScoreA = 100 - (loadA / (avgLoad + 1)) * 70;
      const hoursScoreB = 100 - (loadB / (avgLoad + 1)) * 70;

      const effScoreA = effA * 30;
      const effScoreB = effB * 30;

      const totalScoreA = hoursScoreA * 0.7 + effScoreA * 0.3;
      const totalScoreB = hoursScoreB * 0.7 + effScoreB * 0.3;

      return totalScoreB - totalScoreA;
    });

    const selected = availableNow[0];
    console.log(`    ✓ 发现空闲资源: ${selected.resource.name}(累计工时:${resourceLoad?.get(selected.resource.id) || 0}h, 效率:${selected.resource.efficiency || LEVEL_EFFICIENCY[selected.resource.level as ResourceLevel] || 1.0})`);

    return { 
      resource: selected.resource, 
      waitTime: 0, 
      isAvailableNow: true,
      adjustedTaskStart: taskStart,
      adjustedTaskEnd: originalTaskEnd
    };
  }

  // 没有空闲资源，选择等待时间最短的
  resourceOptions.sort((a, b) => a.waitTime - b.waitTime);
  
  // 如果等待时间相同，使用综合评分
  if (resourceOptions.length > 1 && resourceOptions[0].waitTime === resourceOptions[1].waitTime) {
    const avgLoad = resourceOptions.reduce((sum, opt) => sum + (resourceLoad?.get(opt.resource.id) || 0), 0) / resourceOptions.length;

    resourceOptions.sort((a, b) => {
      const loadA = resourceLoad?.get(a.resource.id) || 0;
      const loadB = resourceLoad?.get(b.resource.id) || 0;

      const effA = a.resource.efficiency || LEVEL_EFFICIENCY[a.resource.level as ResourceLevel] || 1.0;
      const effB = b.resource.efficiency || LEVEL_EFFICIENCY[b.resource.level as ResourceLevel] || 1.0;

      const hoursScoreA = 100 - (loadA / (avgLoad + 1)) * 70;
      const hoursScoreB = 100 - (loadB / (avgLoad + 1)) * 70;

      const effScoreA = effA * 30;
      const effScoreB = effB * 30;

      const totalScoreA = hoursScoreA * 0.7 + effScoreA * 0.3;
      const totalScoreB = hoursScoreB * 0.7 + effScoreB * 0.3;

      return totalScoreB - totalScoreA;
    });
  }

  const selected = resourceOptions[0];
  const waitHours = selected.waitTime / (1000 * 60 * 60);
  console.log(`    ⚠ 没有空闲资源，选择等待时间最短: ${selected.resource.name}(等待${waitHours.toFixed(1)}小时, 累计工时:${resourceLoad?.get(selected.resource.id) || 0}h, 效率:${selected.resource.efficiency || LEVEL_EFFICIENCY[selected.resource.level as ResourceLevel] || 1.0})`);

  return { 
    resource: selected.resource, 
    waitTime: selected.waitTime, 
    isAvailableNow: false,
    adjustedTaskStart: selected.adjustedTaskStart,
    adjustedTaskEnd: selected.adjustedTaskEnd
  };
}

/**
 * 查找在指定时间段可用的空闲资源
 */
function findAvailableResource(
  task: Task,
  resources: Resource[],
  taskStart: Date,
  actualWorkHours: number,
  workingHoursConfig: WorkingHoursConfig,
  resourceSchedules: Map<string, Array<{ start: Date; end: Date }>>,
  excludeResourceId?: string,
  resourceLoad?: Map<string, number> // 资源的累计工时
): Resource | null {
  // 找出所有匹配的资源（相同工作类型且是人类资源）
  const matchingResources = resources.filter(r =>
    r.type === 'human' &&
    r.workType === task.taskType &&
    r.id !== excludeResourceId // 排除当前资源
  );

  if (matchingResources.length === 0) {
    return null;
  }

  // 计算任务的结束时间
  const taskEnd = calculateEndDate(taskStart, actualWorkHours, workingHoursConfig);

  // 找出所有在指定时间段无冲突的资源
  const availableResources = matchingResources.filter(resource => {
    const schedule = resourceSchedules.get(resource.id) || [];

    // 检查是否与该资源的任何已安排任务冲突
    const hasConflict = schedule.some(scheduled =>
      taskStart < scheduled.end && taskEnd > scheduled.start
    );

    return !hasConflict;
  });

  if (availableResources.length === 0) {
    console.log(`    ⚠ 没有可用的空闲资源`);
    return null;
  }

  console.log(`    📋 可用资源列表: ${availableResources.map(r => `${r.name}(累计工时:${resourceLoad?.get(r.id) || 0}h, 效率:${r.efficiency || LEVEL_EFFICIENCY[r.level as ResourceLevel] || 1.0})`).join(', ')}`);

  // ★★★ 综合评分公式：累计工时 + 效率（与 autoAssignResources 一致）★★★
  // 计算每个资源的综合得分，得分越高越优先
  // 评分 = 工时得分 + 效率得分
  // 工时得分：累计工时越接近平均值得分越高，累计工时越低得分越高（权重：70%）
  // 效率得分：效率越高得分越高（权重：30%）

  // 计算平均累计工时
  const avgLoad = availableResources.length > 0
    ? Array.from(availableResources).reduce((sum, r) => sum + (resourceLoad?.get(r.id) || 0), 0) / availableResources.length
    : 0;

  availableResources.sort((a, b) => {
    const loadA = resourceLoad?.get(a.id) || 0;
    const loadB = resourceLoad?.get(b.id) || 0;

    const effA = a.efficiency || LEVEL_EFFICIENCY[a.level as ResourceLevel] || 1.0;
    const effB = b.efficiency || LEVEL_EFFICIENCY[b.level as ResourceLevel] || 1.0;

    // ★★★ 综合评分公式（修复：更合理的评分逻辑）★★★
    // 评分 = 工时得分 + 效率得分
    // 工时得分（权重：70%）：累计工时越低得分越高
    //   - 得分范围：0-100
    //   - 公式：100 - (累计工时 / 平均工时 + 1) * 70
    //   - 如果所有资源工时都是0，得分为100
    //   - 差异1小时的工时会导致约7分的差异
    // 效率得分（权重：30%）：效率越高得分越高
    //   - 得分范围：30-60（效率1.0-2.0）

    // 工时得分：累计工时越低得分越高（使用更平滑的公式）
    const hoursScoreA = 100 - (loadA / (avgLoad + 1)) * 70;
    const hoursScoreB = 100 - (loadB / (avgLoad + 1)) * 70;

    // 效率得分：效率越高得分越高
    const effScoreA = effA * 30;
    const effScoreB = effB * 30;

    // 综合得分
    const totalScoreA = hoursScoreA * 0.7 + effScoreA * 0.3;
    const totalScoreB = hoursScoreB * 0.7 + effScoreB * 0.3;

    return totalScoreB - totalScoreA; // 得分高的排在前面
  });

  const selected = availableResources[0];
  console.log(`    ✓ 最终选择: ${selected.name}(累计工时:${resourceLoad?.get(selected.id) || 0}h, 效率:${selected.efficiency || LEVEL_EFFICIENCY[selected.level as ResourceLevel] || 1.0})`);

  return selected;
}
