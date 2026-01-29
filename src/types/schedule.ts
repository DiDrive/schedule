// 资源等级
export type ResourceLevel = 'assistant' | 'junior' | 'senior';

// 资源类型
export type ResourceType = 'human' | 'material' | 'equipment';
export type ResourceWorkType = '平面' | '后期' | '物料';

// 资源冲突处理策略
export type ResourceConflictStrategy = 'auto-switch' | 'delay-only' | 'ask-each';

// 基础数据类型
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  workType?: ResourceWorkType; // 工作类型：平面/后期
  level?: ResourceLevel; // 资源等级
  efficiency?: number; // 效率系数，0.5-2.0，1.0为标准效率
  skills?: string[];
  availability: number; // 0-1, 可用性系数
  color?: string; // 资源在甘特图中的显示颜色
}

// 工作时间配置
export interface WorkingHoursConfig {
  startHour: number; // 开始小时，如 9.5 表示 9:30
  endHour: number; // 结束小时，如 19 表示 19:00
  workDays: number[]; // 工作日，0-6 表示周日到周六
  lunchBreakStart?: number; // 午休开始小时，如 12 表示 12:00
  lunchBreakEnd?: number; // 午休结束小时，如 13.5 表示 13:30
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  estimatedHours: number;
  assignedResources: string[]; // Resource IDs
  deadline?: Date;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  taskType?: ResourceWorkType; // 任务类型：平面/后期/物料
  fixedResourceId?: string; // 指定的资源ID（如果指定，则优先使用该资源，不进行自动分配）

  // 复杂场景扩展
  projectId?: string;
  dependencies?: string[]; // 前置任务 IDs

  // 复合场景扩展
  tags?: string[];
  riskFactor?: number; // 0-1, 风险系数
  materialRequirements?: {
    materialId: string;
    quantity: number;
    leadTime?: number; // 采购周期（天）
  }[];

  // 物料任务专用字段
  estimatedMaterialDate?: Date; // 物料预估提供日期
  actualMaterialDate?: Date; // 物料实际提供日期（可能提前）

  // 排期结果（精确到小时）
  startDate?: Date;
  endDate?: Date;
  startHour?: number; // 开始小时，如 9.5 表示 9:30
  endHour?: number; // 结束小时
  isCritical?: boolean; // 是否在关键路径上
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  priority: number; // 1-10, 数字越大优先级越高
  deadline?: Date;
  tasks: Task[];
  resourcePool: string[]; // Resource IDs
  color?: string; // 项目在甘特图中的显示颜色
  startDate?: Date; // 项目开始时间
}

// 排期算法结果
export interface ScheduleResult {
  tasks: Task[];
  projects: Project[];
  criticalPath: string[]; // Task IDs on critical path
  criticalChain: string[]; // Task IDs on critical chain
  resourceConflicts: ResourceConflict[];
  resourceUtilization: Record<string, number>; // Resource ID -> utilization rate
  totalDuration: number; // 总工期（天）
  totalHours: number; // 总工时
  workingHoursConfig?: WorkingHoursConfig; // 工作时间配置
  warnings: string[];
  recommendations: string[];
}

export interface ResourceConflict {
  resourceId: string;
  resourceName: string;
  tasks: string[]; // Conflicting task IDs
  timeRange: { start: Date; end: Date };
  severity: 'low' | 'medium' | 'high';
  suggestedResolution?: string;
}

// 智能分析结果
export interface IntelligentAnalysis {
  scheduleOptimization: string;
  resourceAllocation: ResourceAllocation[];
  riskMitigation: RiskMitigation[];
  tradeoffAnalysis: Tradeoff[];
}

export interface ResourceAllocation {
  resourceId: string;
  resourceName: string;
  assignedTasks: string[];
  efficiency: number; // 0-1
  recommendations: string[];
}

export interface RiskMitigation {
  taskId: string;
  taskName: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  mitigationStrategies: string[];
}

export interface Tradeoff {
  scenario: string;
  description: string;
  pros: string[];
  cons: string[];
  impact: {
    duration: number;
    quality: number;
  };
}

// 场景类型
export type ScenarioType = 'basic' | 'complex' | 'composite';

// 输入数据类型
export interface BasicScenarioInput {
  tasks: Omit<Task, 'projectId' | 'tags' | 'riskFactor' | 'materialRequirements'>[];
  resources: Resource[];
  projectDeadline: Date;
}

export interface ComplexScenarioInput {
  projects: Omit<Project, 'tasks'>[];
  tasks: Task[];
  dependencies: { taskId: string; dependsOn: string[] }[];
  sharedResourcePool: Resource[];
}

export interface CompositeScenarioInput {
  tasks: Task[];
  resources: Resource[];
  constraints: {
    maxConcurrentTasks?: number;
    riskTolerance?: number; // 0-1
  };
  procurementData?: {
    materialId: string;
    leadTime: number;
    supplier: string;
  }[];
}
