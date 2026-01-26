'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, GitBranch, Users, AlertTriangle, CheckCircle2, Network, Plus, Trash2, Settings } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { defaultWorkingHours } from '@/lib/sample-data';
import { Task, ScheduleResult, Project, Resource, ResourceLevel } from '@/types/schedule';
import GanttChart from '@/components/gantt-chart';

// 辅助函数：将 Date 或字符串转换为 YYYY-MM-DD 格式
const formatDateToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

// 辅助函数：格式化日期时间
const formatDateTime = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};

// 默认项目数据
const defaultProjects: Project[] = [
  {
    id: 'proj-1',
    name: '宣传片项目',
    description: '企业宣传视频制作',
    priority: 9,
    deadline: new Date('2024-04-30'),
    resourcePool: ['res-1', 'res-2', 'res-3', 'res-4'],
    color: '#3b82f6',
    tasks: []
  },
  {
    id: 'proj-2',
    name: '广告片项目',
    description: '产品广告视频制作',
    priority: 8,
    deadline: new Date('2024-05-15'),
    resourcePool: ['res-1', 'res-3'],
    color: '#10b981',
    tasks: []
  },
  {
    id: 'proj-3',
    name: '纪录片项目',
    description: '企业纪录片制作',
    priority: 7,
    deadline: new Date('2024-06-01'),
    resourcePool: ['res-2', 'res-5'],
    color: '#f59e0b',
    tasks: []
  }
];

// 默认任务数据（自动分配资源）
const defaultTasks: Task[] = [
  {
    id: 'task-p1-1',
    name: '概念设计',
    description: '设计视频整体风格和创意',
    estimatedHours: 16,
    assignedResources: [], // 自动分配
    projectId: 'proj-1',
    priority: 'high',
    status: 'pending',
    taskType: '平面',
    dependencies: []
  },
  {
    id: 'task-p1-2',
    name: '分镜设计',
    description: '绘制详细的分镜脚本',
    estimatedHours: 40,
    assignedResources: [], // 自动分配
    projectId: 'proj-1',
    priority: 'high',
    status: 'pending',
    taskType: '平面',
    dependencies: ['task-p1-1']
  },
  {
    id: 'task-p1-3',
    name: '视频剪辑',
    description: '完成视频剪辑和拼接',
    estimatedHours: 64,
    assignedResources: [], // 自动分配
    projectId: 'proj-1',
    priority: 'normal',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p1-2']
  },
  {
    id: 'task-p2-1',
    name: '品牌VI设计',
    description: '设计品牌视觉识别',
    estimatedHours: 24,
    assignedResources: [], // 自动分配
    projectId: 'proj-2',
    priority: 'urgent',
    status: 'pending',
    taskType: '平面',
    dependencies: []
  },
  {
    id: 'task-p2-2',
    name: '产品包装设计',
    description: '完成产品包装设计',
    estimatedHours: 40,
    assignedResources: [], // 自动分配
    projectId: 'proj-2',
    priority: 'high',
    status: 'pending',
    taskType: '平面',
    dependencies: ['task-p2-1']
  },
  {
    id: 'task-p2-3',
    name: '特效制作',
    description: '制作视频特效和动画',
    estimatedHours: 80,
    assignedResources: [], // 自动分配
    projectId: 'proj-2',
    priority: 'high',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p2-2']
  },
  {
    id: 'task-p3-1',
    name: '采访拍摄',
    description: '进行人物采访拍摄',
    estimatedHours: 32,
    assignedResources: [], // 自动分配
    projectId: 'proj-3',
    priority: 'high',
    status: 'pending',
    taskType: '后期',
    dependencies: []
  },
  {
    id: 'task-p3-2',
    name: '字幕制作',
    description: '制作视频字幕和图示',
    estimatedHours: 48,
    assignedResources: [], // 自动分配
    projectId: 'proj-3',
    priority: 'high',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p3-1']
  },
  {
    id: 'task-p3-3',
    name: '调色和音频处理',
    description: '完成画面调色和音频处理',
    estimatedHours: 56,
    assignedResources: [], // 自动分配
    projectId: 'proj-3',
    priority: 'normal',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p3-2']
  }
];

// 默认共享资源（带等级和效率）
const defaultResources: Resource[] = [
  {
    id: 'res-1',
    name: '张设计师',
    type: 'human',
    workType: '平面',
    level: 'senior',
    efficiency: 1.5,
    skills: ['平面设计', '品牌VI', 'UI设计'],
    availability: 0.9,
    color: '#3b82f6'
  },
  {
    id: 'res-2',
    name: '李后期',
    type: 'human',
    workType: '后期',
    level: 'senior',
    efficiency: 1.5,
    skills: ['视频剪辑', '特效制作', '调色'],
    availability: 1.0,
    color: '#10b981'
  },
  {
    id: 'res-3',
    name: '王平面',
    type: 'human',
    workType: '平面',
    level: 'junior',
    efficiency: 1.0,
    skills: ['插画设计', '分镜设计', '排版'],
    availability: 0.8,
    color: '#f59e0b'
  },
  {
    id: 'res-4',
    name: '赵后期',
    type: 'human',
    workType: '后期',
    level: 'junior',
    efficiency: 1.0,
    skills: ['字幕制作', '音频处理', '剪辑'],
    availability: 0.85,
    color: '#8b5cf6'
  },
  {
    id: 'res-5',
    name: '小助理',
    type: 'human',
    workType: '后期',
    level: 'assistant',
    efficiency: 0.7,
    skills: ['基础剪辑', '素材整理', '字幕制作'],
    availability: 0.9,
    color: '#ec4899'
  },
  {
    id: 'res-6',
    name: '测试服务器',
    type: 'equipment',
    availability: 1.0,
    color: '#ef4444'
  }
];

export default function ComplexScenario() {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [sharedResources, setSharedResources] = useState<Resource[]>(defaultResources);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [activeProject, setActiveProject] = useState<string>('all');

  // 数据持久化
  useEffect(() => {
    const savedProjects = localStorage.getItem('complex-scenario-projects');
    const savedTasks = localStorage.getItem('complex-scenario-tasks');
    const savedResources = localStorage.getItem('complex-scenario-resources');
    const savedScheduleResult = localStorage.getItem('complex-scenario-schedule-result');

    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      // 将日期字符串转换回 Date 对象
      const projectsWithDates = parsed.map((p: Project) => ({
        ...p,
        deadline: p.deadline ? new Date(p.deadline) : undefined,
        startDate: p.startDate ? new Date(p.startDate) : undefined
      }));
      setProjects(projectsWithDates);
    }
    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);
      // 将日期字符串转换回 Date 对象
      const tasksWithDates = parsed.map((t: Task) => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined
      }));
      setTasks(tasksWithDates);
    }
    if (savedResources) {
      setSharedResources(JSON.parse(savedResources));
    }
    if (savedScheduleResult) {
      const parsed = JSON.parse(savedScheduleResult);
      // 将日期字符串转换回 Date 对象
      const scheduleResultWithDates = {
        ...parsed,
        tasks: parsed.tasks.map((t: Task) => ({
          ...t,
          deadline: t.deadline ? new Date(t.deadline) : undefined,
          startDate: t.startDate ? new Date(t.startDate) : undefined,
          endDate: t.endDate ? new Date(t.endDate) : undefined
        })),
        resourceConflicts: parsed.resourceConflicts.map((rc: any) => ({
          ...rc,
          timeRange: {
            start: new Date(rc.timeRange.start),
            end: new Date(rc.timeRange.end)
          }
        })),
        projects: parsed.projects.map((p: Project) => ({
          ...p,
          deadline: p.deadline ? new Date(p.deadline) : undefined,
          startDate: p.startDate ? new Date(p.startDate) : undefined
        }))
      };
      setScheduleResult(scheduleResultWithDates);
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
    if (tasks.length > 0) localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));
    if (sharedResources.length > 0) localStorage.setItem('complex-scenario-resources', JSON.stringify(sharedResources));
    if (scheduleResult) localStorage.setItem('complex-scenario-schedule-result', JSON.stringify(scheduleResult));
  }, [projects, tasks, sharedResources, scheduleResult]);

  const handleGenerateSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      const result = generateSchedule(tasks, sharedResources, new Date(), defaultWorkingHours);
      setScheduleResult(result);
      setIsComputing(false);
    }, 500);
  };

  const handleTaskChange = (taskId: string, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    // 同时从其他任务的依赖中移除该任务
    setTasks(tasks.map(t => ({
      ...t,
      dependencies: t.dependencies?.filter(d => d !== taskId)
    })));
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: `新任务 ${tasks.length + 1}`,
      description: '',
      estimatedHours: 8,
      assignedResources: [], // 自动分配
      priority: 'normal',
      status: 'pending',
      projectId: activeProject === 'all' ? projects[0]?.id : activeProject,
      dependencies: [],
      taskType: '平面' // 默认为平面
    };
    setTasks([...tasks, newTask]);
  };

  const handleAddProject = () => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: `新项目 ${projects.length + 1}`,
      description: '',
      priority: 5,
      resourcePool: [],
      color: '#64748b',
      tasks: []
    };
    setProjects([...projects, newProject]);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(projects.filter(p => p.id !== projectId));
    // 同时删除该项目的所有任务
    setTasks(tasks.filter(t => t.projectId !== projectId));
  };

  const handleProjectChange = (projectId: string, field: keyof Project, value: any) => {
    setProjects(projects.map(p => p.id === projectId ? { ...p, [field]: value } : p));
  };

  const filteredTasks = activeProject === 'all' 
    ? tasks 
    : tasks.filter(t => t.projectId === activeProject);

  const getProjectById = (projectId: string) => {
    return projects.find(p => p.id === projectId);
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'senior': return 'bg-purple-500 text-white';
      case 'junior': return 'bg-blue-500 text-white';
      case 'assistant': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  // 资源管理
  const handleAddResource = () => {
    const newResource: Resource = {
      id: `res-${Date.now()}`,
      name: '新成员',
      type: 'human',
      workType: '平面', // 默认为平面
      level: 'junior',
      efficiency: 1.0,
      availability: 1.0,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };
    setSharedResources([...sharedResources, newResource]);
  };

  const handleDeleteResource = (resourceId: string) => {
    setSharedResources(sharedResources.filter(r => r.id !== resourceId));
  };

  const handleResourceChange = (resourceId: string, field: keyof Resource, value: any) => {
    setSharedResources(sharedResources.map(r => r.id === resourceId ? { ...r, [field]: value } : r));
  };

  return (
    <div className="space-y-6">
      {/* Shared Resource Pool */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" />
                共享资源池
              </CardTitle>
              <CardDescription>
                所有项目共享的资源，系统会根据效率、优先级和工时自动分配
              </CardDescription>
            </div>
            <Button onClick={handleAddResource} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              添加成员
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {sharedResources.filter(r => r.type === 'human').map(resource => {
              const efficiency = resource.efficiency || 1.0;
              return (
                <div key={resource.id} className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: resource.color }}
                      />
                      <Input
                        value={resource.name}
                        onChange={(e) => handleResourceChange(resource.id, 'name', e.target.value)}
                        className="h-6 w-20 text-sm border-0 bg-transparent px-0 focus:ring-0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteResource(resource.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                  <div className="mb-3">
                    <Select
                      value={resource.workType || 'none'}
                      onValueChange={(value) => handleResourceChange(resource.id, 'workType', value !== 'none' ? value : '')}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未指定</SelectItem>
                        <SelectItem value="平面">平面</SelectItem>
                        <SelectItem value="后期">后期</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mb-3">
                    <Select
                      value={resource.level || 'junior'}
                      onValueChange={(value: ResourceLevel) => handleResourceChange(resource.id, 'level', value)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistant">助理</SelectItem>
                        <SelectItem value="junior">初级</SelectItem>
                        <SelectItem value="senior">高级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>效率:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="3.0"
                          value={efficiency}
                          onChange={(e) => handleResourceChange(resource.id, 'efficiency', parseFloat(e.target.value))}
                          className="h-6 w-14 text-right text-xs"
                        />
                        <span>x</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>可用性:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="1.0"
                          value={resource.availability}
                          onChange={(e) => handleResourceChange(resource.id, 'availability', parseFloat(e.target.value))}
                          className="h-6 w-14 text-right text-xs"
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-500" />
              项目管理
            </div>
            <Button
              onClick={handleAddProject}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              添加项目
            </Button>
          </CardTitle>
          <CardDescription>
            当前管理 {projects.length} 个并行项目，共享资源池
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>颜色</TableHead>
                  <TableHead>任务数</TableHead>
                  <TableHead>资源数</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map(project => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Input
                        value={project.name}
                        onChange={(e) => handleProjectChange(project.id, 'name', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={project.description || ''}
                        onChange={(e) => handleProjectChange(project.id, 'description', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={project.priority}
                        onChange={(e) => handleProjectChange(project.id, 'priority', parseInt(e.target.value))}
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={formatDateToInputValue(project.deadline)}
                        onChange={(e) => handleProjectChange(project.id, 'deadline', new Date(e.target.value))}
                        className="w-36 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        value={project.color || '#3b82f6'}
                        onChange={(e) => handleProjectChange(project.id, 'color', e.target.value)}
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tasks.filter(t => t.projectId === project.id).length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {project.resourcePool.length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            共享资源: {sharedResources.length} 个
          </Badge>
          <Badge variant="outline" className="gap-1">
            <GitBranch className="h-3 w-3" />
            总任务: {tasks.length} 个
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleAddTask} 
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            添加任务
          </Button>
          <Button 
            onClick={handleGenerateSchedule} 
            disabled={isComputing}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isComputing ? '计算中...' : '生成综合排期'}
          </Button>
        </div>
      </div>

      {/* Task Management Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-500" />
            任务管理
          </CardTitle>
          <CardDescription>管理所有项目的任务，支持跨项目依赖</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">任务名称</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>任务类型</TableHead>
                  <TableHead>预估工时</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>依赖任务</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => {
                  const project = getProjectById(task.projectId || '');
                  
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Input
                          value={task.name}
                          onChange={(e) => handleTaskChange(task.id, 'name', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.projectId || 'none'}
                          onValueChange={(value) => handleTaskChange(task.id, 'projectId', value !== 'none' ? value : '')}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">未分配</SelectItem>
                            {projects.map(proj => (
                              <SelectItem key={proj.id} value={proj.id}>
                                {proj.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.taskType || 'none'}
                          onValueChange={(value) => handleTaskChange(task.id, 'taskType', value !== 'none' ? value : '')}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">未指定</SelectItem>
                            <SelectItem value="平面">平面</SelectItem>
                            <SelectItem value="后期">后期</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={task.estimatedHours}
                          onChange={(e) => handleTaskChange(task.id, 'estimatedHours', parseInt(e.target.value))}
                          className="w-24 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.priority}
                          onValueChange={(value) => handleTaskChange(task.id, 'priority', value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="urgent">紧急</SelectItem>
                            <SelectItem value="high">高</SelectItem>
                            <SelectItem value="normal">普通</SelectItem>
                            <SelectItem value="low">低</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.dependencies && task.dependencies.length > 0 ? task.dependencies[0] : 'none'}
                          onValueChange={(value) => handleTaskChange(task.id, 'dependencies', value !== 'none' ? [value] : [])}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="无依赖" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无依赖</SelectItem>
                            {tasks.filter(t => t.id !== task.id).map(depTask => (
                              <SelectItem key={depTask.id} value={depTask.id}>
                                {depTask.name} ({getProjectById(depTask.projectId || '')?.name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Results */}
      {scheduleResult && (
        <Tabs value={activeProject} onValueChange={setActiveProject} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">全部项目</TabsTrigger>
            {projects.map(project => (
              <TabsTrigger key={project.id} value={project.id}>
                {project.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeProject} className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>总工期</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.totalDuration} 天</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>总工时</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.totalHours} 小时</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>资源冲突</CardDescription>
                  <CardTitle className={`text-2xl ${scheduleResult.resourceConflicts.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {scheduleResult.resourceConflicts.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>关键链</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.criticalChain.length} 个任务</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Multi-Project Gantt */}
            <Card>
              <CardHeader>
                <CardTitle>多项目综合甘特图</CardTitle>
                <CardDescription>
                  {activeProject === 'all' ? '所有项目时间线' : getProjectById(activeProject)?.name} 可视化（工作时间：9:30 - 19:00）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GanttChart
                  scheduleResult={scheduleResult}
                  resources={sharedResources}
                  projects={projects.map(p => ({
                    id: p.id,
                    color: p.color || '#3b82f6',
                    name: p.name
                  }))}
                />
              </CardContent>
            </Card>

            {/* Task Table View */}
            <Card>
              <CardHeader>
                <CardTitle>排期结果表格</CardTitle>
                <CardDescription>
                  详细展示任务、负责人、时间段等信息
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务名称</TableHead>
                        <TableHead>所属项目</TableHead>
                        <TableHead>任务类型</TableHead>
                        <TableHead>负责人</TableHead>
                        <TableHead>开始时间</TableHead>
                        <TableHead>结束时间</TableHead>
                        <TableHead>工时</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleResult.tasks
                        .filter(task => activeProject === 'all' || task.projectId === activeProject)
                        .map(task => {
                        const project = getProjectById(task.projectId || '');
                        const resourceNames = task.assignedResources
                          .map(id => sharedResources.find(r => r.id === id)?.name)
                          .filter(Boolean)
                          .join(', ');
                        const isCritical = scheduleResult.criticalPath.includes(task.id);

                        return (
                          <TableRow key={task.id}>
                            <TableCell className="font-medium">
                              {task.name}
                              {isCritical && (
                                <Badge variant="destructive" className="ml-2 text-xs">关键</Badge>
                              )}
                            </TableCell>
                            <TableCell>{project?.name || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={task.taskType === '平面' ? 'default' : 'secondary'}>
                                {task.taskType || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>{resourceNames || '-'}</TableCell>
                            <TableCell>
                              {task.startDate ? formatDateTime(task.startDate) : '-'}
                            </TableCell>
                            <TableCell>
                              {task.endDate ? formatDateTime(task.endDate) : '-'}
                            </TableCell>
                            <TableCell>{task.estimatedHours}h</TableCell>
                            <TableCell>
                              <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                                {task.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Dependency Visualization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-500" />
                  任务依赖关系
                </CardTitle>
                <CardDescription>展示任务间的前置依赖关系</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredTasks
                    .filter(task => task.dependencies && task.dependencies.length > 0)
                    .map(task => (
                      <div key={task.id} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-medium">{task.name}</span>
                          <Badge variant="outline" className="text-xs">依赖于</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {task.dependencies?.map(depId => {
                            const depTask = tasks.find(t => t.id === depId);
                            if (!depTask) return null;
                            return (
                              <Badge key={depId} variant="secondary">
                                {depTask.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Resource Conflicts */}
            {scheduleResult.resourceConflicts.length > 0 && (
              <Card className="border-orange-200 dark:border-orange-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-5 w-5" />
                    跨项目资源冲突
                  </CardTitle>
                  <CardDescription>
                    检测到 {scheduleResult.resourceConflicts.length} 个资源在不同项目间的冲突
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scheduleResult.resourceConflicts.map((conflict, index) => (
                      <div key={index} className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant={conflict.severity === 'high' ? 'destructive' : 'secondary'}>
                            {conflict.severity === 'high' ? '高' : conflict.severity === 'medium' ? '中' : '低'}
                          </Badge>
                          <span className="font-medium">{conflict.resourceName}</span>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {conflict.tasks.map(taskId => {
                            const task = tasks.find(t => t.id === taskId);
                            const project = task ? getProjectById(task.projectId || '') : null;
                            return (
                              <Badge key={taskId} variant="outline">
                                {task?.name} {project && `(${project.name})`}
                              </Badge>
                            );
                          })}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {conflict.suggestedResolution}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resource Utilization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  资源利用率分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sharedResources.map(resource => {
                    const utilization = scheduleResult.resourceUtilization[resource.id] || 0;
                    const utilizationPercent = Math.round(utilization * 100);
                    
                    return (
                      <div key={resource.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{resource.name}</span>
                          <span className={utilizationPercent > 90 ? 'text-red-500' : utilizationPercent < 50 ? 'text-orange-500' : 'text-green-500'}>
                            {utilizationPercent}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className={`h-2 rounded-full ${
                              utilizationPercent > 90 ? 'bg-red-500' : 
                              utilizationPercent < 50 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${utilizationPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {scheduleResult.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    优化建议
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scheduleResult.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                        <span className="text-slate-700 dark:text-slate-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
