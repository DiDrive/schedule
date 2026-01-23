'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, GitBranch, Users, AlertTriangle, CheckCircle2, Network } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { complexScenarioSample } from '@/lib/sample-data';
import { Task, ScheduleResult } from '@/types/schedule';

type ProjectInfo = Omit<typeof complexScenarioSample.projects[0], 'tasks'>;

export default function ComplexScenario() {
  const [projects] = useState<ProjectInfo[]>(complexScenarioSample.projects);
  const [tasks] = useState<Task[]>(complexScenarioSample.tasks);
  const [sharedResources] = useState(complexScenarioSample.sharedResourcePool);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [activeProject, setActiveProject] = useState<string>('all');

  const handleGenerateSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      const result = generateSchedule(tasks, sharedResources, new Date());
      setScheduleResult(result);
      setIsComputing(false);
    }, 500);
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 9) return 'bg-red-500 text-white';
    if (priority >= 7) return 'bg-orange-500 text-white';
    if (priority >= 5) return 'bg-yellow-500 text-white';
    return 'bg-slate-500 text-white';
  };

  const filteredTasks = activeProject === 'all' 
    ? tasks 
    : tasks.filter(t => t.projectId === activeProject);

  const getProjectById = (projectId: string) => {
    return projects.find(p => p.id === projectId);
  };

  return (
    <div className="space-y-6">
      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-purple-500" />
            多项目概览
          </CardTitle>
          <CardDescription>
            当前管理 {projects.length} 个并行项目，共享资源池
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {projects.map(project => (
              <div key={project.id} className="rounded-lg border p-4 hover:border-purple-300 dark:hover:border-purple-700">
                <div className="mb-3 flex items-start justify-between">
                  <h4 className="font-semibold">{project.name}</h4>
                  <Badge className={getPriorityColor(project.priority)}>
                    优先级 {project.priority}
                  </Badge>
                </div>
                <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                  {project.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <GitBranch className="h-4 w-4" />
                    <span>{tasks.filter(t => t.projectId === project.id).length} 个任务</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Users className="h-4 w-4" />
                    <span>{project.resourcePool.length} 个资源</span>
                  </div>
                  {project.deadline && (
                    <div className="text-slate-600 dark:text-slate-400">
                      截止: {project.deadline.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
        <Button 
          onClick={handleGenerateSchedule} 
          disabled={isComputing}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {isComputing ? '计算中...' : '生成综合排期'}
        </Button>
      </div>

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
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>平均资源利用率</CardDescription>
                  <CardTitle className="text-2xl">
                    {Math.round(
                      Object.values(scheduleResult.resourceUtilization).reduce((a, b) => a + b, 0) / 
                      Object.keys(scheduleResult.resourceUtilization).length * 100
                    )}%
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Multi-Project Gantt */}
            <Card>
              <CardHeader>
                <CardTitle>多项目综合甘特图</CardTitle>
                <CardDescription>
                  {activeProject === 'all' ? '所有项目时间线' : getProjectById(activeProject)?.name} 可视化
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTasks.map(task => {
                    const isCritical = scheduleResult.criticalChain.includes(task.id);
                    const project = getProjectById(task.projectId || '');
                    const startDate = task.startDate || new Date();
                    const endDate = task.endDate || new Date();
                    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                    
                    // Color by project
                    const projectColors: Record<string, string> = {
                      'proj-1': 'bg-blue-500',
                      'proj-2': 'bg-green-500',
                      'proj-3': 'bg-purple-500'
                    };
                    const barColor = projectColors[task.projectId || ''] || 'bg-slate-500';

                    return (
                      <div key={task.id} className="space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="w-56">
                            <div className="text-sm font-medium">{task.name}</div>
                            {project && (
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                {project.name}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 relative">
                            <div className="absolute left-0 top-0 h-6 rounded bg-slate-100 dark:bg-slate-800">
                              <div
                                className={`absolute top-0 h-6 rounded ${isCritical ? 'bg-red-500' : barColor}`}
                                style={{
                                  left: `${((startDate.getTime() - scheduleResult.tasks[0].startDate!.getTime()) / (1000 * 60 * 60 * 24)) * 2}%`,
                                  width: `${Math.max(duration * 2, 2)}%`
                                }}
                              />
                            </div>
                          </div>
                          <div className="w-36 text-xs text-slate-600 dark:text-slate-400">
                            {startDate.toLocaleDateString()}
                          </div>
                          {task.dependencies && task.dependencies.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              依赖: {task.dependencies.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
