'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, GitBranch, BarChart3 } from 'lucide-react';
import BasicScenario from '@/components/scenarios/basic-scenario';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { generateIntelligentAnalysis } from '@/lib/intelligent-analysis';
import { basicScenarioSample, complexScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [activeTab, setActiveTab] = useState('basic');

  // 页面级别的一次性数据清理，确保清除所有旧数据
  const hasCleanedUp = useRef(false);
  useEffect(() => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    // 检查所有 localStorage 中的数据是否有重复ID
    const keys = [
      'basic-scenario-tasks',
      'basic-scenario-resources',
      'basic-scenario-schedule-result',
      'complex-scenario-projects',
      'complex-scenario-tasks',
      'complex-scenario-resources',
      'complex-scenario-schedule-result'
    ];

    let needsCleanup = false;

    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        let taskList: Task[] = [];

        // 收集所有任务
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          taskList = parsed.tasks;
        } else if (Array.isArray(parsed)) {
          taskList = parsed;
        }

        // 检查重复ID
        if (taskList.length > 0) {
          const idMap = new Map<string, number>();
          let hasDuplicateIds = false;

          taskList.forEach((t: Task) => {
            const count = idMap.get(t.id) || 0;
            idMap.set(t.id, count + 1);
            if (count > 0) {
              hasDuplicateIds = true;
              console.warn(`发现重复任务ID: ${t.id}`);
            }
          });

          // 检查多次拆分导致的嵌套ID
          const hasNestedIds = taskList.some((t: Task) => {
            const subCount = (t.id.match(/-sub-/g) || []).length;
            return subCount >= 2;
          });

          if (hasDuplicateIds || hasNestedIds) {
            console.warn(`发现数据问题: ${key}，将被清除`);
            needsCleanup = true;
          }
        }
      } catch (e) {
        console.error(`解析数据失败: ${key}`, e);
      }
    }

    if (needsCleanup) {
      console.warn('清除所有旧数据以修复重复ID问题');
      keys.forEach(key => localStorage.removeItem(key));
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
    </div>
  );
}
