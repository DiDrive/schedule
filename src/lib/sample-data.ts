import { Task, Resource, Project, BasicScenarioInput, ComplexScenarioInput, CompositeScenarioInput, WorkingHoursConfig } from '@/types/schedule';

// 示例资源
export const sampleResources: Resource[] = [
  {
    id: 'res-1',
    name: '张三',
    type: 'human',
    skills: ['frontend', 'react', 'typescript'],
    availability: 0.9,
    color: '#3b82f6' // blue-500
  },
  {
    id: 'res-2',
    name: '李四',
    type: 'human',
    skills: ['backend', 'java', 'spring'],
    availability: 1.0,
    color: '#10b981' // green-500
  },
  {
    id: 'res-3',
    name: '王五',
    type: 'human',
    skills: ['design', 'ui', 'ux'],
    availability: 0.8,
    color: '#f59e0b' // orange-500
  },
  {
    id: 'res-4',
    name: '赵六',
    type: 'human',
    skills: ['testing', 'qa', 'automation'],
    availability: 0.85,
    color: '#8b5cf6' // purple-500
  },
  {
    id: 'res-5',
    name: '测试服务器',
    type: 'equipment',
    availability: 1.0,
    color: '#ef4444' // red-500
  }
];

// 默认工作时间配置
export const defaultWorkingHours: WorkingHoursConfig = {
  startHour: 9.5, // 9:30
  endHour: 19, // 19:00
  workDays: [1, 2, 3, 4, 5] // 周一到周五
};

// 基础场景示例 - 电商网站开发
export const basicScenarioSample: BasicScenarioInput = {
  tasks: [
    {
      id: 'task-1',
      name: '需求分析与设计',
      description: '完成产品需求文档和UI设计稿',
      estimatedHours: 24,
      assignedResources: ['res-3'],
      deadline: new Date('2024-02-15'),
      priority: 'urgent',
      status: 'pending',
      dependencies: []
    },
    {
      id: 'task-2',
      name: '前端页面开发',
      description: '完成所有前端页面的开发',
      estimatedHours: 80,
      assignedResources: ['res-1'],
      deadline: new Date('2024-03-01'),
      priority: 'high',
      status: 'pending',
      dependencies: ['task-1']
    },
    {
      id: 'task-3',
      name: '后端API开发',
      description: '完成所有后端API接口',
      estimatedHours: 96,
      assignedResources: ['res-2'],
      deadline: new Date('2024-03-05'),
      priority: 'high',
      status: 'pending',
      dependencies: ['task-1']
    },
    {
      id: 'task-4',
      name: '数据库设计与实现',
      description: '完成数据库表结构和数据迁移',
      estimatedHours: 32,
      assignedResources: ['res-2'],
      deadline: new Date('2024-02-28'),
      priority: 'high',
      status: 'pending',
      dependencies: ['task-1']
    },
    {
      id: 'task-5',
      name: '系统集成测试',
      description: '完成前后端集成和系统测试',
      estimatedHours: 40,
      assignedResources: ['res-4'],
      deadline: new Date('2024-03-15'),
      priority: 'high',
      status: 'pending',
      dependencies: ['task-2', 'task-3', 'task-4']
    }
  ],
  resources: sampleResources,
  projectDeadline: new Date('2024-03-20')
};

// 复杂场景示例 - 多项目并行
export const complexScenarioSample: ComplexScenarioInput = {
  projects: [
    {
      id: 'proj-1',
      name: '电商平台升级',
      description: '电商平台性能优化和功能升级',
      priority: 9,
      deadline: new Date('2024-04-30'),
      resourcePool: ['res-1', 'res-2', 'res-3', 'res-4'],
      color: '#3b82f6' // blue
    },
    {
      id: 'proj-2',
      name: '移动APP开发',
      description: 'iOS和Android客户端开发',
      priority: 8,
      deadline: new Date('2024-05-15'),
      resourcePool: ['res-1', 'res-3'],
      color: '#10b981' // green
    },
    {
      id: 'proj-3',
      name: '数据中台建设',
      description: '数据仓库和BI系统建设',
      priority: 7,
      deadline: new Date('2024-06-01'),
      resourcePool: ['res-2', 'res-5'],
      color: '#f59e0b' // orange
    }
  ],
  tasks: [
    // 电商平台任务
    {
      id: 'task-p1-1',
      name: '性能分析',
      description: '分析当前系统性能瓶颈',
      estimatedHours: 16,
      assignedResources: ['res-2'],
      projectId: 'proj-1',
      priority: 'high',
      status: 'pending',
      dependencies: []
    },
    {
      id: 'task-p1-2',
      name: '缓存优化',
      description: '实现Redis缓存策略',
      estimatedHours: 40,
      assignedResources: ['res-2'],
      projectId: 'proj-1',
      priority: 'high',
      status: 'pending',
      dependencies: ['task-p1-1']
    },
    {
      id: 'task-p1-3',
      name: 'UI重构',
      description: '重构前端UI组件',
      estimatedHours: 64,
      assignedResources: ['res-1', 'res-3'],
      projectId: 'proj-1',
      priority: 'normal',
      status: 'pending',
      dependencies: ['task-p1-1']
    },
    // 移动APP任务
    {
      id: 'task-p2-1',
      name: '原型设计',
      description: '完成APP交互原型',
      estimatedHours: 24,
      assignedResources: ['res-3'],
      projectId: 'proj-2',
      priority: 'urgent',
      status: 'pending',
      dependencies: []
    },
    {
      id: 'task-p2-2',
      name: 'iOS开发',
      description: '完成iOS版本开发',
      estimatedHours: 120,
      assignedResources: ['res-1'],
      projectId: 'proj-2',
      priority: 'high',
      status: 'pending',
      dependencies: ['task-p2-1']
    },
    // 数据中台任务
    {
      id: 'task-p3-1',
      name: '需求调研',
      description: '调研各业务线数据需求',
      estimatedHours: 32,
      assignedResources: ['res-2'],
      projectId: 'proj-3',
      priority: 'high',
      status: 'pending',
      dependencies: []
    },
    {
      id: 'task-p3-2',
      name: '数据建模',
      description: '设计数据仓库模型',
      estimatedHours: 48,
      assignedResources: ['res-2'],
      projectId: 'proj-3',
      priority: 'high',
      status: 'pending',
      dependencies: ['task-p3-1']
    },
    {
      id: 'task-p3-3',
      name: 'ETL开发',
      description: '开发数据抽取转换加载',
      estimatedHours: 80,
      assignedResources: ['res-2'],
      projectId: 'proj-3',
      priority: 'normal',
      status: 'pending',
      dependencies: ['task-p3-2']
    }
  ],
  dependencies: [],
  sharedResourcePool: sampleResources
};

// 复合场景示例 - 复杂约束
export const compositeScenarioSample: CompositeScenarioInput = {
  tasks: [
    {
      id: 'task-c1',
      name: '智能推荐系统',
      description: '开发AI推荐引擎',
      estimatedHours: 160,
      assignedResources: ['res-2'],
      priority: 'high',
      status: 'pending',
      tags: ['machine-learning', 'ai', 'backend'],
      riskFactor: 0.8,
      materialRequirements: [
        {
          materialId: 'gpu-server',
          quantity: 2,
          leadTime: 14
        }
      ]
    },
    {
      id: 'task-c2',
      name: '实时数据流处理',
      description: '搭建实时数据处理平台',
      estimatedHours: 96,
      assignedResources: ['res-2'],
      priority: 'high',
      status: 'pending',
      tags: ['streaming', 'bigdata', 'backend'],
      riskFactor: 0.6,
      materialRequirements: [
        {
          materialId: 'stream-server',
          quantity: 1,
          leadTime: 7
        }
      ]
    },
    {
      id: 'task-c3',
      name: '用户行为分析',
      description: '开发用户行为追踪和分析',
      estimatedHours: 64,
      assignedResources: ['res-1'],
      priority: 'normal',
      status: 'pending',
      tags: ['analytics', 'frontend'],
      riskFactor: 0.4
    },
    {
      id: 'task-c4',
      name: '可视化仪表盘',
      description: '开发数据可视化仪表盘',
      estimatedHours: 48,
      assignedResources: ['res-1', 'res-3'],
      priority: 'normal',
      status: 'pending',
      tags: ['visualization', 'ui', 'frontend'],
      riskFactor: 0.3
    },
    {
      id: 'task-c5',
      name: '性能优化',
      description: '系统性能优化和调优',
      estimatedHours: 32,
      assignedResources: ['res-2'],
      priority: 'urgent',
      status: 'pending',
      tags: ['optimization', 'backend'],
      riskFactor: 0.5
    },
    {
      id: 'task-c6',
      name: '安全审计',
      description: '进行系统安全审计',
      estimatedHours: 24,
      assignedResources: ['res-4'],
      priority: 'high',
      status: 'pending',
      tags: ['security', 'testing'],
      riskFactor: 0.4
    }
  ],
  resources: sampleResources,
  constraints: {
    maxConcurrentTasks: 3,
    riskTolerance: 0.6
  },
  procurementData: [
    {
      materialId: 'gpu-server',
      leadTime: 14,
      supplier: '云服务商A'
    },
    {
      materialId: 'stream-server',
      leadTime: 7,
      supplier: '云服务商B'
    }
  ]
};
