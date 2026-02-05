/**
 * 飞书同步扩展类型定义
 * 扩展基础类型，添加飞书同步所需的字段
 */

import { Resource, Project, Task, ScheduleResult } from './schedule';

// 扩展的 Resource 类型，添加飞书同步字段
export interface FeishuResource extends Resource {
  resourceType: 'graphic' | 'post' | 'material'; // 人员类型
  feishuUserId?: string[]; // 飞书用户ID
  totalHours?: number; // 累计工时
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// 扩展的 Project 类型，添加飞书同步字段
export interface FeishuProject {
  id: string;
  name: string;
  description?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// 扩展的 Task 类型，添加飞书同步字段
export interface FeishuTask extends Omit<Task, 'projectId'> {
  projectId?: string | null; // 允许 null
  actualHours?: number; // 实际工时
  isOverdue?: boolean; // 是否超期
  feishuVersion?: number; // 飞书记录版本
  systemVersion?: number; // 系统记录版本
  lastSyncedAt?: Date | null; // 最后同步时间
  syncSource?: 'system' | 'feishu' | 'manual'; // 同步来源
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// 扩展的 ScheduleResult 类型，添加飞书同步字段
export interface FeishuScheduleResult {
  tasks: FeishuTask[];
  criticalPath: string[];
  projectId?: string | null;
  version?: number;
}
