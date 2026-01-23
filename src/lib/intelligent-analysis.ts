import { Task, Resource, IntelligentAnalysis, ResourceAllocation, RiskMitigation, Tradeoff } from '@/types/schedule';

/**
 * 智能排期优化建议
 */
export function analyzeScheduleOptimization(
  tasks: Task[],
  resources: Resource[]
): string {
  let analysis = '基于当前数据分析，建议采用以下排期策略：\n\n';
  
  // 分析任务优先级分布
  const urgentTasks = tasks.filter(t => t.priority === 'urgent').length;
  const highTasks = tasks.filter(t => t.priority === 'high').length;
  
  if (urgentTasks > 0) {
    analysis += `1. 优先级管理：当前有 ${urgentTasks} 个紧急任务，建议采用优先级队列调度\n`;
    analysis += `   - 紧急任务：立即开始，高优先级资源分配\n`;
    analysis += `   - 高优先级任务：在紧急任务完成后立即启动\n\n`;
  }
  
  // 分析资源瓶颈
  const resourceUsage = new Map<string, number>();
  tasks.forEach(task => {
    task.assignedResources.forEach(resId => {
      resourceUsage.set(resId, (resourceUsage.get(resId) || 0) + task.estimatedHours);
    });
  });
  
  const bottleneckResources = Array.from(resourceUsage.entries())
    .filter(([_, hours]) => hours > 40) // 假设每周40小时
    .map(([resId, _]) => resources.find(r => r.id === resId)?.name)
    .filter(Boolean);
  
  if (bottleneckResources.length > 0) {
    analysis += `2. 资源瓶颈：${bottleneckResources.join('、')} 存在负载过高\n`;
    analysis += `   - 建议增加资源数量或采用并行处理\n`;
    analysis += `   - 考虑将任务拆分为更小的子任务\n\n`;
  }
  
  // 分析任务时长
  const avgDuration = tasks.reduce((sum, t) => sum + t.estimatedHours, 0) / tasks.length;
  const longTasks = tasks.filter(t => t.estimatedHours > avgDuration * 2);
  
  if (longTasks.length > 0) {
    analysis += `3. 任务拆分建议：${longTasks.length} 个任务时长超过平均值2倍\n`;
    analysis += `   - 建议将大任务拆分为多个可并行的子任务\n`;
    analysis += `   - 采用里程碑管理，提高进度可控性\n\n`;
  }
  
  return analysis;
}

/**
 * 资源最优分配方案
 */
export function optimizeResourceAllocation(
  tasks: Task[],
  resources: Resource[]
): ResourceAllocation[] {
  const allocations: ResourceAllocation[] = [];
  
  resources.forEach(resource => {
    const assignedTasks = tasks.filter(t => t.assignedResources.includes(resource.id));
    
    // 计算效率指标
    const efficiency = assignedTasks.length > 0 ? 
      calculateResourceEfficiency(resource, assignedTasks) : 0;
    
    // 生成建议
    const recommendations: string[] = [];
    
    if (efficiency < 0.5) {
      recommendations.push('当前资源利用率较低，建议分配更多任务');
    } else if (efficiency > 0.9) {
      recommendations.push('资源接近饱和，注意避免过度分配');
    }
    
    // 技能匹配度分析
    if (resource.skills) {
      const skillMatchRate = calculateSkillMatch(resource, assignedTasks);
      if (skillMatchRate < 0.7) {
        recommendations.push('技能匹配度不高，建议调整任务分配或提供培训');
      }
    }
    
    allocations.push({
      resourceId: resource.id,
      resourceName: resource.name,
      assignedTasks: assignedTasks.map(t => t.id),
      efficiency,
      recommendations
    });
  });
  
  return allocations;
}

function calculateResourceEfficiency(
  resource: Resource,
  tasks: Task[]
): number {
  // 简化计算：基于可用性和任务负载
  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const capacity = 40 * resource.availability; // 假设每周40小时
  return Math.min(totalHours / capacity, 1);
}

function calculateSkillMatch(
  resource: Resource,
  tasks: Task[]
): number {
  if (!resource.skills || resource.skills.length === 0) return 1;
  
  let matchedCount = 0;
  tasks.forEach(task => {
    if (task.tags && task.tags.length > 0) {
      const hasMatch = task.tags.some(tag => resource.skills?.includes(tag));
      if (hasMatch) matchedCount++;
    } else {
      matchedCount++; // 无技能要求的任务默认匹配
    }
  });
  
  return matchedCount / tasks.length;
}

/**
 * 风险评估和缓解策略
 */
export function assessRisks(
  tasks: Task[],
  resources: Resource[]
): RiskMitigation[] {
  const riskMitigations: RiskMitigation[] = [];
  
  tasks.forEach(task => {
    const riskFactors: string[] = [];
    const mitigationStrategies: string[] = [];
    
    // 基于任务属性评估风险
    const riskFactor = task.riskFactor || 0.5;
    
    // 风险因素1：任务时长过长
    if (task.estimatedHours > 80) { // 超过2周
      riskFactors.push('任务时长过长，不确定性增加');
      mitigationStrategies.push('将任务拆分为里程碑');
    }
    
    // 风险因素2：依赖关系复杂
    if (task.dependencies && task.dependencies.length > 3) {
      riskFactors.push('依赖任务过多，进度延迟风险高');
      mitigationStrategies.push('建立依赖监控机制');
      mitigationStrategies.push('预留缓冲时间');
    }
    
    // 风险因素3：资源可用性
    const assignedResources = resources.filter(r => task.assignedResources.includes(r.id));
    const lowAvailabilityResources = assignedResources.filter(r => r.availability < 0.7);
    if (lowAvailabilityResources.length > 0) {
      riskFactors.push('部分资源可用性较低');
      mitigationStrategies.push('准备备选资源');
      mitigationStrategies.push('调整任务顺序');
    }
    
    // 风险因素4：物料采购
    if (task.materialRequirements && task.materialRequirements.length > 0) {
      const longLeadTime = task.materialRequirements.filter(m => (m.leadTime || 0) > 7);
      if (longLeadTime.length > 0) {
        riskFactors.push('部分物料采购周期长');
        mitigationStrategies.push('提前启动采购流程');
        mitigationStrategies.push('寻找替代供应商');
      }
    }
    
    // 风险因素5：任务标签
    if (task.tags && task.tags.includes('experimental')) {
      riskFactors.push('实验性任务，不确定性高');
      mitigationStrategies.push('采用敏捷开发方式');
      mitigationStrategies.push('增加测试和验证环节');
    }
    
    // 综合风险等级
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskFactor > 0.7 || riskFactors.length >= 3) {
      riskLevel = 'high';
    } else if (riskFactor > 0.4 || riskFactors.length >= 1) {
      riskLevel = 'medium';
    }
    
    riskMitigations.push({
      taskId: task.id,
      taskName: task.name,
      riskLevel,
      riskFactors,
      mitigationStrategies
    });
  });
  
  return riskMitigations;
}

/**
 * 多维度权衡分析
 */
export function analyzeTradeoffs(
  tasks: Task[],
  resources: Resource[],
  constraints: {
    maxConcurrentTasks?: number;
    riskTolerance?: number;
  }
): Tradeoff[] {
  const tradeoffs: Tradeoff[] = [];
  
  // 场景1：速度优先
  tradeoffs.push({
    scenario: '速度优先',
    description: '增加资源投入，缩短项目周期',
    pros: [
      '项目提前完成',
      '更快获得市场反馈',
      '减少延期风险'
    ],
    cons: [
      '资源协调难度增大',
      '可能降低单个任务质量'
    ],
    impact: {
      duration: -30, // 缩短30%
      quality: -10
    }
  });
  
  // 场景2：资源效率优先
  tradeoffs.push({
    scenario: '资源效率优先',
    description: '优化资源利用，提高资源利用率',
    pros: [
      '提高资源利用率',
      '优化团队协作效率'
    ],
    cons: [
      '项目周期可能延长',
      '资源调度更严格'
    ],
    impact: {
      duration: 25, // 延长25%
      quality: 0
    }
  });
  
  // 场景3：质量优先
  tradeoffs.push({
    scenario: '质量优先',
    description: '增加测试和验证环节，确保交付质量',
    pros: [
      '降低后期维护成本',
      '提高用户满意度',
      '减少返工风险'
    ],
    cons: [
      '延长项目周期',
      '增加开发和测试时间',
      '可能影响市场时机'
    ],
    impact: {
      duration: 20, // 延长20%
      quality: 40 // 质量显著提升
    }
  });
  
  // 场景4：风险缓解
  tradeoffs.push({
    scenario: '风险缓解',
    description: '增加备选方案和缓冲时间，降低项目风险',
    pros: [
      '提高项目成功率',
      '减少意外中断',
      '增强团队信心'
    ],
    cons: [
      '资源利用率降低',
      '项目周期延长',
      '增加管理复杂度'
    ],
    impact: {
      duration: 15,
      quality: 10
    }
  });
  
  return tradeoffs;
}

/**
 * 生成综合智能分析
 */
export function generateIntelligentAnalysis(
  tasks: Task[],
  resources: Resource[],
  constraints?: any
): IntelligentAnalysis {
  const scheduleOptimization = analyzeScheduleOptimization(tasks, resources);
  const resourceAllocation = optimizeResourceAllocation(tasks, resources);
  const riskMitigation = assessRisks(tasks, resources);
  const tradeoffAnalysis = analyzeTradeoffs(tasks, resources, constraints || {});
  
  return {
    scheduleOptimization,
    resourceAllocation,
    riskMitigation,
    tradeoffAnalysis
  };
}
