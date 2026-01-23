'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Brain, Shield, Zap, AlertTriangle, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { generateIntelligentAnalysis } from '@/lib/intelligent-analysis';
import { compositeScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult, IntelligentAnalysis } from '@/types/schedule';
import AISuggestion from '@/components/ai-suggestion';

export default function CompositeScenario() {
  const [tasks] = useState<Task[]>(compositeScenarioSample.tasks);
  const [resources] = useState<Resource[]>(compositeScenarioSample.resources);
  const [constraints] = useState(compositeScenarioSample.constraints);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [intelligentAnalysis, setIntelligentAnalysis] = useState<IntelligentAnalysis | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const handleGenerateSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      // 生成基础排期
      const schedule = generateSchedule(tasks, resources, new Date());
      setScheduleResult(schedule);
      
      // 生成智能分析
      const analysis = generateIntelligentAnalysis(tasks, resources, constraints);
      setIntelligentAnalysis(analysis);
      
      setIsComputing(false);
    }, 500);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-orange-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Constraints Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            多维度约束
          </CardTitle>
          <CardDescription>
            当前项目配置了以下约束条件
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Clock className="h-4 w-4" />
                最大并发任务
              </div>
              <div className="text-2xl font-bold">
                {constraints.maxConcurrentTasks || '无限制'}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <DollarSign className="h-4 w-4" />
                预算限制
              </div>
              <div className="text-2xl font-bold">
                {constraints.budgetLimit ? `¥${(constraints.budgetLimit / 10000).toFixed(0)}万` : '无限制'}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Shield className="h-4 w-4" />
                风险容忍度
              </div>
              <div className="text-2xl font-bold">
                {constraints.riskTolerance ? `${Math.round(constraints.riskTolerance * 100)}%` : '中'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Tags Overview */}
      <Card>
        <CardHeader>
          <CardTitle>任务标签分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(tasks.flatMap(t => t.tags || []))).map(tag => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Brain className="h-3 w-3" />
            智能分析就绪
          </Badge>
          <Badge variant="outline">
            {tasks.length} 个任务
          </Badge>
        </div>
        <Button 
          onClick={handleGenerateSchedule} 
          disabled={isComputing}
          className="gap-2"
        >
          <Brain className="h-4 w-4" />
          {isComputing ? '智能分析中...' : '生成智能排期'}
        </Button>
      </div>

      {/* Results */}
      {scheduleResult && intelligentAnalysis && (
        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">排期结果</TabsTrigger>
            <TabsTrigger value="optimization">智能优化</TabsTrigger>
            <TabsTrigger value="resources">资源分配</TabsTrigger>
            <TabsTrigger value="risks">风险评估</TabsTrigger>
            <TabsTrigger value="tradeoffs">权衡分析</TabsTrigger>
          </TabsList>

          {/* Schedule Results */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>总工期</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.totalDuration} 天</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>预估成本</CardDescription>
                  <CardTitle className="text-2xl">¥{scheduleResult.totalCost?.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>关键路径</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.criticalPath.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>风险任务</CardDescription>
                  <CardTitle className="text-2xl text-orange-500">
                    {intelligentAnalysis.riskMitigation.filter(r => r.riskLevel === 'high').length}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>排期甘特图</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scheduleResult.tasks.map(task => {
                    const isCritical = scheduleResult.criticalPath.includes(task.id);
                    const startDate = task.startDate || new Date();
                    const endDate = task.endDate || new Date();
                    const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                    
                    return (
                      <div key={task.id} className="space-y-1">
                        <div className="flex items-center gap-4">
                          <div className="w-48 font-medium text-sm">{task.name}</div>
                          <div className="flex-1 relative">
                            <div className="absolute left-0 top-0 h-5 rounded bg-slate-100 dark:bg-slate-800">
                              <div
                                className={`absolute top-0 h-5 rounded ${
                                  isCritical ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{
                                  left: `${((startDate.getTime() - scheduleResult.tasks[0].startDate!.getTime()) / (1000 * 60 * 60 * 24)) * 2}%`,
                                  width: `${Math.max(duration * 2, 2)}%`
                                }}
                              />
                            </div>
                          </div>
                          <div className="w-32 text-xs text-slate-600 dark:text-slate-400">
                            {duration.toFixed(1)} 天
                          </div>
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1">
                              {task.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intelligent Optimization */}
          <TabsContent value="optimization" className="space-y-4">
            {/* 算法生成的优化建议 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  算法优化策略
                </CardTitle>
                <CardDescription>
                  基于数据分析的排期优化策略
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {intelligentAnalysis.scheduleOptimization}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* AI 智能建议 */}
            <AISuggestion
              tasks={tasks}
              resources={resources}
              scheduleResult={scheduleResult}
              constraints={constraints}
            />
          </TabsContent>

          {/* Resource Allocation */}
          <TabsContent value="resources" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {intelligentAnalysis.resourceAllocation.map(allocation => (
                <Card key={allocation.resourceId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{allocation.resourceName}</CardTitle>
                    <CardDescription>
                      效率: {Math.round(allocation.efficiency * 100)}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-2 text-sm text-slate-600 dark:text-slate-400">
                          分配任务数: {allocation.assignedTasks.length}
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className={`h-2 rounded-full ${
                              allocation.efficiency > 0.9 ? 'bg-red-500' : 
                              allocation.efficiency < 0.5 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${allocation.efficiency * 100}%` }}
                          />
                        </div>
                      </div>
                      {allocation.recommendations.length > 0 && (
                        <div className="space-y-1">
                          {allocation.recommendations.map((rec, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                              <TrendingUp className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Risk Assessment */}
          <TabsContent value="risks" className="space-y-4">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>高风险任务</CardDescription>
                  <CardTitle className="text-2xl text-red-500">
                    {intelligentAnalysis.riskMitigation.filter(r => r.riskLevel === 'high').length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>中风险任务</CardDescription>
                  <CardTitle className="text-2xl text-orange-500">
                    {intelligentAnalysis.riskMitigation.filter(r => r.riskLevel === 'medium').length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>低风险任务</CardDescription>
                  <CardTitle className="text-2xl text-green-500">
                    {intelligentAnalysis.riskMitigation.filter(r => r.riskLevel === 'low').length}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="space-y-4">
              {intelligentAnalysis.riskMitigation.map(risk => (
                <Card key={risk.taskId} className={`border-l-4 ${
                  risk.riskLevel === 'high' ? 'border-l-red-500' :
                  risk.riskLevel === 'medium' ? 'border-l-orange-500' :
                  'border-l-green-500'
                }`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{risk.taskName}</CardTitle>
                        <CardDescription className="mt-1">
                          风险等级: <Badge className={getRiskColor(risk.riskLevel)}>{risk.riskLevel}</Badge>
                        </CardDescription>
                      </div>
                      <Shield className={`h-5 w-5 ${
                        risk.riskLevel === 'high' ? 'text-red-500' :
                        risk.riskLevel === 'medium' ? 'text-orange-500' :
                        'text-green-500'
                      }`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {risk.riskFactors.length > 0 && (
                        <div>
                          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            风险因素:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {risk.riskFactors.map((factor, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {risk.mitigationStrategies.length > 0 && (
                        <div>
                          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            缓解策略:
                          </div>
                          <div className="space-y-1">
                            {risk.mitigationStrategies.map((strategy, index) => (
                              <div key={index} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                                <span>{strategy}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tradeoff Analysis */}
          <TabsContent value="tradeoffs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  多维度权衡分析
                </CardTitle>
                <CardDescription>
                  不同优化策略对工期、成本、质量的影响
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {intelligentAnalysis.tradeoffAnalysis.map((tradeoff, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{tradeoff.scenario}</CardTitle>
                    <CardDescription>{tradeoff.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Pros & Cons */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-green-600">优势</div>
                          <ul className="space-y-1">
                            {tradeoff.pros.map((pro, i) => (
                              <li key={i} className="flex items-start gap-1 text-xs text-slate-600 dark:text-slate-400">
                                <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-red-600">劣势</div>
                          <ul className="space-y-1">
                            {tradeoff.cons.map((con, i) => (
                              <li key={i} className="flex items-start gap-1 text-xs text-slate-600 dark:text-slate-400">
                                <AlertTriangle className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                                <span>{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Impact Metrics */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">工期影响</span>
                          <span className={`font-medium ${
                            tradeoff.impact.duration < 0 ? 'text-green-500' : 
                            tradeoff.impact.duration > 0 ? 'text-red-500' : 'text-slate-600'
                          }`}>
                            {tradeoff.impact.duration > 0 ? '+' : ''}{tradeoff.impact.duration}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">成本影响</span>
                          <span className={`font-medium ${
                            tradeoff.impact.cost < 0 ? 'text-green-500' : 
                            tradeoff.impact.cost > 0 ? 'text-red-500' : 'text-slate-600'
                          }`}>
                            {tradeoff.impact.cost > 0 ? '+' : ''}{tradeoff.impact.cost}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">质量影响</span>
                          <span className={`font-medium ${
                            tradeoff.impact.quality > 0 ? 'text-green-500' : 
                            tradeoff.impact.quality < 0 ? 'text-red-500' : 'text-slate-600'
                          }`}>
                            {tradeoff.impact.quality > 0 ? '+' : ''}{tradeoff.impact.quality}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
