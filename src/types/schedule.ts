// 基础数据类型
export interface Resource {
  id: string;
  name: string;
  type: 'human' | 'material' | 'equipment';
  skills?: string[];
  availability: number; // 0-1, 可用性系数
  hourlyRate?: number;
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
  
  // 排期结果
  startDate?: Date;
  endDate?: Date;
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
}

// 排期算法结果
export interface ScheduleResult {
  tasks: Task[];
  projects: Project[];
  criticalPath: string[]; // Task IDs on critical path
  criticalChain: string[]; // Task IDs on critical chain
  resourceConflicts: ResourceConflict[];
  resourceUtilization: Record<string, number>; // Resource ID -> utilization rate
  totalDuration: number; // Days
  totalCost?: number;
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
    cost: number;
    quality: number;
  };
}

// 场景类型
export type ScenarioType = 'basic' | 'complex' | 'composite';

// 输入数据类型
export interface BasicScenarioInput {
  tasks: Omit<Task, 'projectId' | 'dependencies' | 'tags' | 'riskFactor' | 'materialRequirements'>[];
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
    budgetLimit?: number;
    riskTolerance?: number; // 0-1
  };
  procurementData?: {
    materialId: string;
    leadTime: number;
    supplier: string;
  }[];
}
