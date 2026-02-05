'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, GitBranch, BarChart3, Globe } from 'lucide-react';
import BasicScenario from '@/components/scenarios/basic-scenario';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { generateIntelligentAnalysis } from '@/lib/intelligent-analysis';
import { basicScenarioSample, complexScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [activeTab, setActiveTab] = useState('basic');
  const [showFeishuDialog, setShowFeishuDialog] = useState(false);

  // 处理飞书同步
  const handleFeishuSync = async () => {
    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    const config = JSON.parse(configStr);

    // 获取基础场景数据
    const basicTasksStr = localStorage.getItem('basic-scenario-tasks');
    const basicResourcesStr = localStorage.getItem('basic-scenario-resources');
    const basicScheduleStr = localStorage.getItem('basic-scenario-schedule-result');

    const basicTasks = basicTasksStr ? JSON.parse(basicTasksStr) : [];
    const basicResources = basicResourcesStr ? JSON.parse(basicResourcesStr) : [];
    const basicSchedule = basicScheduleStr ? JSON.parse(basicScheduleStr) : [];

    // 获取复杂场景数据
    const complexTasksStr = localStorage.getItem('complex-scenario-tasks');
    const complexResourcesStr = localStorage.getItem('complex-scenario-resources');
    const complexProjectsStr = localStorage.getItem('complex-scenario-projects');
    const complexScheduleStr = localStorage.getItem('complex-scenario-schedule-result');

    const complexTasks = complexTasksStr ? JSON.parse(complexTasksStr) : [];
    const complexResources = complexResourcesStr ? JSON.parse(complexResourcesStr) : [];
    const complexProjects = complexProjectsStr ? JSON.parse(complexProjectsStr) : [];
    const complexSchedule = complexScheduleStr ? JSON.parse(complexScheduleStr) : [];

    // 合并数据
    const systemData = {
      resources: [...basicResources, ...complexResources],
      projects: complexProjects,
      tasks: [...basicTasks, ...complexTasks],
      schedules: basicSchedule ? [basicSchedule] : (complexSchedule ? [complexSchedule] : []),
    };

    try {
      const response = await fetch('/api/feishu/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          systemData,
          options: {
            conflictResolution: 'feishu', // 以多维表为准
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`同步成功！\n\n统计：\n人员：${result.stats.resources.created} 创建, ${result.stats.resources.updated} 更新\n项目：${result.stats.projects.created} 创建, ${result.stats.projects.updated} 更新\n任务：${result.stats.tasks.created} 创建, ${result.stats.tasks.updated} 更新\n排期：${result.stats.schedules.created} 创建`);
      } else {
        alert(`同步失败：${result.message}\n\n错误详情：\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('飞书同步失败:', error);
      alert('同步失败，请检查网络连接和配置信息');
    }
  };

  // 页面级别的一次性数据清理，确保清除所有旧数据
  const hasCleanedUp = useRef(false);
  useEffect(() => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    // 只检查任务相关的 key，避免跨 key 误判
    const taskKeys = [
      'basic-scenario-tasks',
      'complex-scenario-tasks'
    ];

    let needsCleanup = false;
    let problemTasks: string[] = [];

    for (const key of taskKeys) {
      const data = localStorage.getItem(key);
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);

        if (!Array.isArray(parsed)) continue;

        // 检查重复ID
        const idMap = new Map<string, number>();
        let hasDuplicateIds = false;

        parsed.forEach((t: Task) => {
          const count = idMap.get(t.id) || 0;
          idMap.set(t.id, count + 1);
          if (count > 0) {
            hasDuplicateIds = true;
            console.warn(`发现重复任务ID: ${t.id} (在 ${key} 中)`);
            if (!problemTasks.includes(t.id)) {
              problemTasks.push(t.id);
            }
          }
        });

        // 检查多次拆分导致的嵌套ID
        const hasNestedIds = parsed.some((t: Task) => {
          const subCount = (t.id.match(/-sub-/g) || []).length;
          return subCount >= 2;
        });

        if (hasDuplicateIds || hasNestedIds) {
          console.warn(`发现数据问题: ${key}，将被清除`);
          needsCleanup = true;
        }
      } catch (e) {
        console.error(`解析数据失败: ${key}`, e);
      }
    }

    if (needsCleanup) {
      console.warn('清除所有旧数据以修复重复ID问题');
      console.warn('问题任务ID:', problemTasks);
      // 清除所有场景的数据
      localStorage.removeItem('basic-scenario-tasks');
      localStorage.removeItem('basic-scenario-resources');
      localStorage.removeItem('basic-scenario-schedule-result');
      localStorage.removeItem('basic-scenario-start-date');
      localStorage.removeItem('complex-scenario-projects');
      localStorage.removeItem('complex-scenario-tasks');
      localStorage.removeItem('complex-scenario-resources');
      localStorage.removeItem('complex-scenario-schedule-result');
      alert('检测到数据异常，已自动清理旧数据。请重新开始。');
    }
  }, []);

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
                  唯变项目排期系统
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  智能排期 · 人员优化 · 风险管控
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFeishuDialog(true)}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              飞书集成
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="basic" className="gap-2">
              <Calendar className="h-4 w-4" />
              基础场景
            </TabsTrigger>
            <TabsTrigger value="complex" className="gap-2">
              <GitBranch className="h-4 w-4" />
              复杂场景
            </TabsTrigger>
          </TabsList>

          {/* Basic Scenario Tab */}
          <TabsContent value="basic">
            <BasicScenario />
          </TabsContent>

          {/* Complex Scenario Tab */}
          <TabsContent value="complex">
            <ComplexScenario />
          </TabsContent>
        </Tabs>
      </main>

      {/* 飞书集成对话框 */}
      <FeishuIntegrationDialog
        open={showFeishuDialog}
        onOpenChange={setShowFeishuDialog}
        onSync={handleFeishuSync}
      />
    </div>
  );
}
