'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Plus, Trash2, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { basicScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export default function BasicScenario() {
  const [tasks, setTasks] = useState<Task[]>(basicScenarioSample.tasks);
  const [resources] = useState<Resource[]>(basicScenarioSample.resources);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const handleGenerateSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      const result = generateSchedule(tasks, resources, new Date());
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
      assignedResources: [resources[0].id],
      priority: 'normal',
      status: 'pending'
    };
    setTasks([...tasks, newTask]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleTaskChange = (taskId: string, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const getResourceName = (resourceId: string) => {
    return resources.find(r => r.id === resourceId)?.name || resourceId;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      case 'low': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>任务管理</CardTitle>
          <CardDescription>
            定义项目任务、预估工时、分配资源和设置优先级
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
                  <TableHead>预估工时</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>截止日期</TableHead>
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
                      <Input
                        type="number"
                        value={task.estimatedHours}
                        onChange={(e) => handleTaskChange(task.id, 'estimatedHours', parseInt(e.target.value))}
                        className="w-24 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.assignedResources[0]}
                        onValueChange={(value) => handleTaskChange(task.id, 'assignedResources', [value])}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {resources.map(resource => (
                            <SelectItem key={resource.id} value={resource.id}>
                              {resource.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        value={task.deadline ? task.deadline.toISOString().split('T')[0] : ''}
                        onChange={(e) => handleTaskChange(task.id, 'deadline', new Date(e.target.value))}
                        className="w-36 h-8"
                      />
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

      {/* Schedule Result */}
      {scheduleResult && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>总工期</CardDescription>
                <CardTitle className="text-2xl">{scheduleResult.totalDuration} 天</CardTitle>
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

          {/* Gantt Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                甘特图排期
              </CardTitle>
              <CardDescription>任务时间线可视化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduleResult.tasks.map(task => {
                  const isCritical = scheduleResult.criticalPath.includes(task.id);
                  const startDate = task.startDate || new Date();
                  const endDate = task.endDate || new Date();
                  const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                  
                  return (
                    <div key={task.id} className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="w-48 font-medium text-sm">{task.name}</div>
                        <div className="flex-1 relative">
                          <div className="absolute left-0 top-0 h-6 rounded bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`absolute top-0 h-6 rounded ${
                                isCritical ? 'bg-red-500' : 'bg-blue-500'
                              }`}
                              style={{
                                left: `${((startDate.getTime() - scheduleResult.tasks[0].startDate!.getTime()) / (1000 * 60 * 60 * 24)) * 3}%`,
                                width: `${Math.max(duration * 3, 2)}%`
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-32 text-xs text-slate-600 dark:text-slate-400">
                          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                        </div>
                        {isCritical && (
                          <Badge variant="destructive" className="text-xs">
                            关键路径
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Critical Path */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                关键路径分析
              </CardTitle>
              <CardDescription>
                影响项目总工期的关键任务链路，任何延迟都会影响项目交付
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {scheduleResult.criticalPath.map((taskId, index) => {
                  const task = scheduleResult.tasks.find(t => t.id === taskId);
                  if (!task) return null;
                  
                  return (
                    <div key={taskId} className="flex items-center">
                      <Badge variant="outline" className="border-red-500 text-red-600">
                        {task.name}
                      </Badge>
                      {index < scheduleResult.criticalPath.length - 1 && (
                        <div className="mx-2 text-red-500">→</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Resource Conflicts */}
          {scheduleResult.resourceConflicts.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  资源冲突警告
                </CardTitle>
                <CardDescription>
                  检测到以下资源分配冲突，建议优先解决
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scheduleResult.resourceConflicts.map((conflict, index) => (
                    <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={conflict.severity === 'high' ? 'destructive' : 'secondary'}>
                          {conflict.severity === 'high' ? '高优先级' : conflict.severity === 'medium' ? '中优先级' : '低优先级'}
                        </Badge>
                        <span className="font-medium">{conflict.resourceName}</span>
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

          {/* Recommendations */}
          {scheduleResult.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>优化建议</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {scheduleResult.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300">{rec}</span>
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
