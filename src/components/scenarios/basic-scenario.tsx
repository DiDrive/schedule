'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Plus, Trash2, CheckCircle, TrendingUp, Settings, Calendar } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { defaultWorkingHours } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult, ResourceLevel } from '@/types/schedule';
import GanttChart from '@/components/gantt-chart';

// 辅助函数：将 Date 或字符串转换为 YYYY-MM-DD 格式
const formatDateToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

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
  }
];

export default function BasicScenario() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [activeView, setActiveView] = useState<'gantt' | 'table'>('gantt');

  useEffect(() => {
    const savedTasks = localStorage.getItem('basic-scenario-tasks');
    const savedResources = localStorage.getItem('basic-scenario-resources');

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
      setResources(JSON.parse(savedResources));
    } else {
      setResources(defaultResources);
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('basic-scenario-tasks', JSON.stringify(tasks));
    }
    if (resources.length > 0) {
      localStorage.setItem('basic-scenario-resources', JSON.stringify(resources));
    }
  }, [tasks, resources]);

  const handleGenerateSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      const result = generateSchedule(tasks, resources, new Date(), defaultWorkingHours);
      setScheduleResult(result);
      setIsComputing(false);
    }, 500);
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: `新任务 ${tasks.length + 1}`,
      description: '',
      estimatedHours: 8,
      assignedResources: [],
      priority: 'normal',
      status: 'pending',
      taskType: '平面' // 默认为平面
    };
    setTasks([...tasks, newTask]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleTaskChange = (taskId: string, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

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
    setResources([...resources, newResource]);
  };

  const handleDeleteResource = (resourceId: string) => {
    setResources(resources.filter(r => r.id !== resourceId));
  };

  const handleResourceChange = (resourceId: string, field: keyof Resource, value: any) => {
    setResources(resources.map(r => r.id === resourceId ? { ...r, [field]: value } : r));
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'senior': return 'bg-purple-500 text-white';
      case 'junior': return 'bg-blue-500 text-white';
      case 'assistant': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const formatDateTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" />
                可用资源池
              </CardTitle>
              <CardDescription>
                管理团队成员，设置等级和效率，系统会自动分配任务
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
            {resources.filter(r => r.type === 'human').map(resource => {
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

      <Card>
        <CardHeader>
          <CardTitle>任务管理</CardTitle>
          <CardDescription>
            定义项目任务、预估工时、设置优先级和依赖关系
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button onClick={handleAddTask} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              添加任务
            </Button>
            <Button
              onClick={handleGenerateSchedule}
              disabled={isComputing || tasks.length === 0}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isComputing ? '计算中...' : '生成排期'}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">任务名称</TableHead>
                  <TableHead>任务类型</TableHead>
                  <TableHead>预估工时</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead className="w-[180px]">依赖任务</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => (
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
                        value={task.taskType || 'none'}
                        onValueChange={(value) => handleTaskChange(task.id, 'taskType', value !== 'none' ? value : '')}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="未指定" />
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
                      <Input
                        type="date"
                        value={formatDateToInputValue(task.deadline)}
                        onChange={(e) => handleTaskChange(task.id, 'deadline', new Date(e.target.value))}
                        className="w-36 h-8"
                      />
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
                          {tasks.filter(t => t.id !== task.id).map(dependencyTask => (
                            <SelectItem key={dependencyTask.id} value={dependencyTask.id}>
                              {dependencyTask.name}
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {scheduleResult && (
        <>
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
                <CardDescription>关键路径</CardDescription>
                <CardTitle className="text-2xl">{scheduleResult.criticalPath.length} 个任务</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>资源冲突</CardDescription>
                <CardTitle className={`text-2xl ${scheduleResult.resourceConflicts.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {scheduleResult.resourceConflicts.length} 个
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>排期结果</CardTitle>
                <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
                  <TabsList>
                    <TabsTrigger value="gantt">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      甘特图
                    </TabsTrigger>
                    <TabsTrigger value="table">
                      <Calendar className="h-4 w-4 mr-2" />
                      列表视图
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {activeView === 'gantt' && (
                <GanttChart
                  scheduleResult={scheduleResult}
                  resources={resources}
                />
              )}

              {activeView === 'table' && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务名称</TableHead>
                        <TableHead>负责人</TableHead>
                        <TableHead>开始时间</TableHead>
                        <TableHead>结束时间</TableHead>
                        <TableHead>工时</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleResult.tasks.map(task => {
                        const resource = resources.find(r => r.id === task.assignedResources[0]);
                        return (
                          <TableRow key={task.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {task.isCritical && (
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                )}
                                <span className="font-medium">{task.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {resource ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: resource.color }}
                                  />
                                  <span className="text-sm">{resource.name}</span>
                                  <Badge className={getLevelBadgeColor(resource.level || 'junior')} variant="secondary">
                                    {resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理'}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-slate-400">未分配</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {task.startDate && formatDateTime(task.startDate)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {task.endDate && formatDateTime(task.endDate)}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{task.estimatedHours}h</span>
                            </TableCell>
                            <TableCell>
                              {task.isCritical ? (
                                <Badge variant="destructive">关键路径</Badge>
                              ) : (
                                <Badge variant="outline">普通</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {scheduleResult.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  优化建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scheduleResult.recommendations.map((rec, index) => (
                    <div key={index} className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
