/**
 * 技能稀缺性统计模块
 * 统计每个技能对应的资源数量，用于任务排期优先级计算
 */

import { Resource, Task } from '@/types/schedule';

/**
 * 统计每个技能对应的资源数量
 * @param resources 资源列表
 * @returns 技能ID到资源数量的映射
 */
export function getSkillScarcity(resources: Resource[]): Map<string, number> {
  const scarcity = new Map<string, number>();
  
  resources.forEach(resource => {
    // 只统计人类资源
    if (resource.type !== 'human') return;
    
    (resource.skills || []).forEach(skillId => {
      scarcity.set(skillId, (scarcity.get(skillId) || 0) + 1);
    });
  });
  
  return scarcity;
}

/**
 * 计算任务的技能稀缺性得分
 * 
 * 权重配置：
 * - 1人能做：+30分（稀缺，优先）
 * - 2-3人能做：+15分（较稀缺）
 * - 无人能做：-500分（无法完成）
 * - 4人以上能做：0分（不稀缺）
 * 
 * @param requiredSkills 任务所需的技能列表
 * @param scarcity 技能稀缺性映射
 * @returns 技能稀缺性得分
 */
export function getScarcityScore(requiredSkills: string[], scarcity: Map<string, number>): number {
  // 如果任务没有技能要求，返回0
  if (!requiredSkills || requiredSkills.length === 0) return 0;
  
  // 统计每个技能对应的资源数量
  const resourceCounts = requiredSkills
    .map(skillId => scarcity.get(skillId) || 0);
  
  // 找出最稀缺的技能（资源数量最少）
  const minCount = Math.min(...resourceCounts);
  
  // 根据最稀缺技能的资源数量计算得分
  if (minCount === 0) {
    // 无人能做该技能，大幅降权
    return -500;
  } else if (minCount === 1) {
    // 只有1人能做，稀缺，高优先级
    return 30;
  } else if (minCount <= 3) {
    // 2-3人能做，较稀缺
    return 15;
  } else {
    // 4人以上能做，不稀缺
    return 0;
  }
}

/**
 * 获取任务的技能稀缺性描述
 * @param requiredSkills 任务所需的技能列表
 * @param scarcity 技能稀缺性映射
 * @returns 描述文本
 */
export function getScarcityDescription(requiredSkills: string[], scarcity: Map<string, number>): string {
  if (!requiredSkills || requiredSkills.length === 0) {
    return '无技能要求';
  }
  
  const resourceCounts = requiredSkills
    .map(skillId => ({
      skillId,
      count: scarcity.get(skillId) || 0
    }));
  
  const minCount = Math.min(...resourceCounts.map(r => r.count));
  
  if (minCount === 0) {
    const missingSkills = resourceCounts
      .filter(r => r.count === 0)
      .map(r => r.skillId);
    return `缺少技能：${missingSkills.join(', ')}`;
  } else if (minCount === 1) {
    return '稀缺技能（仅1人具备）';
  } else if (minCount <= 3) {
    return '较稀缺技能（2-3人具备）';
  } else {
    return '普通技能（4人以上具备）';
  }
}

/**
 * 检查任务是否所有技能都有对应的资源
 * @param requiredSkills 任务所需的技能列表
 * @param scarcity 技能稀缺性映射
 * @returns 是否所有技能都有对应资源
 */
export function isTaskExecutable(requiredSkills: string[], scarcity: Map<string, number>): boolean {
  if (!requiredSkills || requiredSkills.length === 0) return true;
  
  return requiredSkills.every(skillId => {
    const count = scarcity.get(skillId) || 0;
    return count > 0;
  });
}

/**
 * 获取任务缺少的技能列表
 * @param requiredSkills 任务所需的技能列表
 * @param scarcity 技能稀缺性映射
 * @returns 缺少的技能ID列表
 */
export function getMissingSkills(requiredSkills: string[], scarcity: Map<string, number>): string[] {
  if (!requiredSkills || requiredSkills.length === 0) return [];
  
  return requiredSkills.filter(skillId => {
    const count = scarcity.get(skillId) || 0;
    return count === 0;
  });
}
