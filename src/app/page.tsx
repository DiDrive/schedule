'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, GitBranch, Zap, BarChart3, Clock, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import BasicScenario from '@/components/scenarios/basic-scenario';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import CompositeScenario from '@/components/scenarios/composite-scenario';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { generateIntelligentAnalysis } from '@/lib/intelligent-analysis';
import { basicScenarioSample, complexScenarioSample, compositeScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  项目排期优化系统
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  智能排期 · 资源优化 · 风险管控
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3 text-yellow-500" />
              AI 增强
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="basic" className="gap-2">
              <Calendar className="h-4 w-4" />
              基础场景
            </TabsTrigger>
            <TabsTrigger value="complex" className="gap-2">
              <GitBranch className="h-4 w-4" />
              复杂场景
            </TabsTrigger>
            <TabsTrigger value="composite" className="gap-2">
              <Zap className="h-4 w-4" />
              复合场景
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    基础场景
                  </CardTitle>
                  <CardDescription>
                    单项目、明确DDL、简单资源分配
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      甘特图排期可视化
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      关键路径自动识别
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      资源负载平衡建议
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-purple-500" />
                    复杂场景
                  </CardTitle>
                  <CardDescription>
                    多项目并行、依赖关系、共享资源池
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      多项目综合排期
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      资源冲突智能预警
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      关键链识别与可视化
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    复合场景
                  </CardTitle>
                  <CardDescription>
                    多维度约束、风险评估、智能优化
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      AI 智能排期建议
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      资源最优分配方案
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      风险缓解策略分析
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* System Features */}
            <Card>
              <CardHeader>
                <CardTitle>核心功能特性</CardTitle>
                <CardDescription>基于智能算法和数据分析的全方位项目排期解决方案</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold">关键路径算法</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        CPM 算法自动识别项目关键路径，精确计算最早/最晚开始时间
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                      <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold">资源冲突检测</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        实时检测资源分配冲突，提供优化建议和解决方案
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold">风险评估模型</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        多维度风险评估，自动生成缓解策略和备选方案
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                      <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold">智能优化建议</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        AI 驱动的排期优化，提供速度/成本/质量权衡分析
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Basic Scenario Tab */}
          <TabsContent value="basic">
            <BasicScenario />
          </TabsContent>

          {/* Complex Scenario Tab */}
          <TabsContent value="complex">
            <ComplexScenario />
          </TabsContent>

          {/* Composite Scenario Tab */}
          <TabsContent value="composite">
            <CompositeScenario />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
