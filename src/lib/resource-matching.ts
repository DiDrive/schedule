/**
 * 资源匹配度计算模块
 * 计算资源与任务的技能/擅长匹配度
 */

import { Resource, Task } from '@/types/schedule';

/**
 * 资源匹配得分详情
 */
export interface ResourceMatchScore {
  resourceId: string;
  resourceName: string;
  skillMatchScore: number;      // 技能匹配得分（0-80）
  specialtyMatchScore: number;  // 擅长匹配得分（0+）
  efficiencyScore: number;      // 效率得分（20/10/5）
  conflictScore: number;        // 冲突惩罚（-1000）
  totalScore: number;           // 总得分
  hasConflict: boolean;
  matchedSkills: string[];      // 匹配的技能
  matchedSpecialties: string[]; // 匹配的擅长
  warnings: string[];           // 警告信息
}

/**
 * 检测资源时间冲突
 * @param resourceId 资源ID
 * @param task 当前任务
 * @param allTasks 所有任务列表（包含已排期的任务）
 * @returns 是否存在时间冲突
 */
export function checkTimeConflict(
  resourceId: string,
  task: Task,
  allTasks: Task[]
): boolean {
  // 如果任务还没有开始/结束时间，认为没有冲突
  if (!task.startDate || !task.endDate) return false;

  const taskStart = new Date(task.startDate);
  const taskEnd = new Date(task.endDate);

  return allTasks.some(otherTask => {
    // 排除自己
    if (otherTask.id === task.id) return false;
    
    // 排除未分配该资源的任务
    if (!otherTask.assignedResources.includes(resourceId)) return false;
    
    // 排除没有开始/结束时间的任务
    if (!otherTask.startDate || !otherTask.endDate) return false;
    
    // 检查时间重叠（使用Date对象比较）
    const otherStart = new Date(otherTask.startDate);
    const otherEnd = new Date(otherTask.endDate);
    
    // 时间重叠判断：如果两个时间范围有交集，则存在冲突
    return !(taskEnd <= otherStart || taskStart >= otherEnd);
  });
}

/**
 * 计算资源与任务的匹配度
 * 
 * 得分计算规则：
 * 1. 技能匹配（0-80分）：(匹配技能数 / 所需技能数) × 80
 * 2. 擅长匹配（30分/个）：每匹配1个擅长加30分
 * 3. 资源效率（20/10/5分）：senior=20, junior=10, assistant=5
 * 4. 时间冲突（-1000分）：存在冲突则大幅降权
 * 
 * @param resource 资源
 * @param task 任务
 * @param allTasks 所有任务列表（用于检测时间冲突）
 * @param resources 所有资源列表（用于获取资源名称）
 * @returns 匹配得分详情
 */
export function calculateResourceMatchScore(
  resource: Resource,
  task: Task,
  allTasks: Task[],
  resources: Resource[]
): ResourceMatchScore {
  const warnings: string[] = [];
  
  // ========== 1. 技能匹配度（0-80分） ==========
  const requiredSkills = task.requiredSkills || [];
  const resourceSkills = resource.skills || [];
  const matchedSkills = requiredSkills.filter(skill => resourceSkills.includes(skill));
  
  let skillMatchScore = 0;
  if (requiredSkills.length > 0) {
    skillMatchScore = (matchedSkills.length / requiredSkills.length) * 80;
    
    // 警告：技能不完整
    if (matchedSkills.length < requiredSkills.length) {
      const missingSkills = requiredSkills.filter(s => !resourceSkills.includes(s));
      warnings.push(`缺少技能：${missingSkills.join(', ')}`);
    }
  } else {
    // 无技能要求，给满分
    skillMatchScore = 80;
  }
  
  // ========== 2. 擅长匹配度（30分/个） ==========
  const requiredSpecialties = task.requiredSpecialties || [];
  const resourceSpecialties = resource.specialties || [];
  const matchedSpecialties = requiredSpecialties.filter(specialty => 
    resourceSpecialties.includes(specialty)
  );
  const specialtyMatchScore = matchedSpecialties.length * 30;
  
  // ========== 3. 资源效率（20/10/5分） ==========
  let efficiencyScore = 5; // 默认助理
  if (resource.level === 'senior') {
    efficiencyScore = 20;
  } else if (resource.level === 'junior') {
    efficiencyScore = 10;
  }
  
  // ========== 4. 时间冲突检测（-1000分） ==========
  const hasConflict = checkTimeConflict(resource.id, task, allTasks);
  const conflictScore = hasConflict ? -1000 : 0;
  
  if (hasConflict) {
    warnings.push('存在时间冲突');
  }
  
  // ========== 5. 警告：工作类型不匹配 ==========
  if (task.taskType && resource.workType && task.taskType !== resource.workType) {
    warnings.push(`工作类型不匹配：任务需要${task.taskType}，资源是${resource.workType}`);
  }
  
  // ========== 计算总分 ==========
  const totalScore = skillMatchScore + specialtyMatchScore + efficiencyScore + conflictScore;
  
  // 获取资源名称
  const resourceName = resources.find(r => r.id === resource.id)?.name || resource.id;
  
  return {
    resourceId: resource.id,
    resourceName,
    skillMatchScore,
    specialtyMatchScore,
    efficiencyScore,
    conflictScore,
    totalScore,
    hasConflict,
    matchedSkills,
    matchedSpecialties,
    warnings,
  };
}

/**
 * 为任务计算所有候选资源的匹配度
 * @param task 任务
 * @param resources 资源列表
 * @param allTasks 所有任务列表
 * @param workTypeFilter 是否按工作类型过滤资源
 * @returns 排序后的匹配得分列表（从高到低）
 */
export function calculateAllResourceMatchScores(
  task: Task,
  resources: Resource[],
  allTasks: Task[],
  workTypeFilter: boolean = true
): ResourceMatchScore[] {
  // 过滤候选资源
  let candidateResources = resources.filter(r => r.type === 'human');
  
  // 如果需要，按工作类型过滤
  if (workTypeFilter && task.taskType) {
    candidateResources = candidateResources.filter(r => 
      !r.workType || r.workType === task.taskType
    );
  }
  
  // 计算每个候选资源的匹配度
  const scores = candidateResources.map(resource =>
    calculateResourceMatchScore(resource, task, allTasks, resources)
  );
  
  // 按总分排序（从高到低）
  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * 为任务选择最佳资源
 * @param task 任务
 * @param resources 资源列表
 * @param allTasks 所有任务列表
 * @param workTypeFilter 是否按工作类型过滤资源
 * @returns 最佳资源的ID，如果没有合适的资源则返回null
 */
export function selectBestResource(
  task: Task,
  resources: Resource[],
  allTasks: Task[],
  workTypeFilter: boolean = true
): string | null {
  const scores = calculateAllResourceMatchScores(task, resources, allTasks, workTypeFilter);
  
  // 如果没有候选资源，返回null
  if (scores.length === 0) return null;
  
  // 选择得分最高的资源
  const bestMatch = scores[0];
  
  // 如果最佳资源的总分为负数（有严重冲突或完全不匹配），返回null
  if (bestMatch.totalScore < 0) {
    return null;
  }
  
  return bestMatch.resourceId;
}

/**
 * 获取匹配度等级描述
 * @param score 总得分
 * @returns 等级描述
 */
export function getMatchLevel(score: number): string {
  if (score >= 80) return '高匹配';
  if (score >= 50) return '中等匹配';
  if (score >= 0) return '低匹配';
  return '不匹配';
}

/**
 * 获取匹配度颜色
 * @param score 总得分
 * @returns 颜色类名
 */
export function getMatchColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}
