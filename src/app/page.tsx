'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, GitBranch, BarChart3, Globe, Info } from 'lucide-react';
import BasicScenario from '@/components/scenarios/basic-scenario';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import FeishuConfigHelper from '@/components/feishu-config-helper';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { generateIntelligentAnalysis } from '@/lib/intelligent-analysis';
import { basicScenarioSample, complexScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [activeTab, setActiveTab] = useState('basic');
  const [showFeishuDialog, setShowFeishuDialog] = useState(false);
  const [showConfigHelper, setShowConfigHelper] = useState(false);

  // 处理飞书同步（从多维表加载数据）
  const handleFeishuSync = async () => {
    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    const config = JSON.parse(configStr);

    // 验证配置是否完整
    const missingConfigs = [];
    if (!config.appId) missingConfigs.push('App ID');
    if (!config.appSecret) missingConfigs.push('App Secret');
    if (!config.appToken) missingConfigs.push('App Token');
    if (!config.tableIds?.resources) missingConfigs.push('人员表 Table ID');
    if (!config.tableIds?.projects) missingConfigs.push('项目表 Table ID');
    if (!config.tableIds?.tasks) missingConfigs.push('任务表 Table ID');

    if (missingConfigs.length > 0) {
      alert(`配置不完整，请填写以下信息：\n\n${missingConfigs.join('\n')}`);
      return;
    }

    try {
      // 从飞书多维表加载数据
      const response = await fetch(
        `/api/feishu/load-data?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(config.appToken)}` +
        `&resources_table_id=${encodeURIComponent(config.tableIds.resources)}` +
        `&projects_table_id=${encodeURIComponent(config.tableIds.projects)}` +
        `&tasks_table_id=${encodeURIComponent(config.tableIds.tasks)}`
      );

      const result = await response.json();

      if (!result.success) {
        alert(`加载数据失败：${result.error}`);
        return;
      }

      // 保存数据到 localStorage
      const { resources, projects, tasks } = result.data;

      // 清空现有数据
      localStorage.removeItem('basic-scenario-tasks');
      localStorage.removeItem('basic-scenario-resources');
      localStorage.removeItem('complex-scenario-tasks');
      localStorage.removeItem('complex-scenario-resources');
      localStorage.removeItem('complex-scenario-projects');

      // 保存新数据
      localStorage.setItem('basic-scenario-resources', JSON.stringify(resources));
      localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
      localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));
      localStorage.setItem('complex-scenario-resources', JSON.stringify(resources));

      alert(`成功从飞书多维表加载数据！\n\n人员：${resources.length}\n项目：${projects.length}\n任务：${tasks.length}`);

      // 刷新页面以加载数据
      window.location.reload();
    } catch (error) {
      console.error('飞书数据加载失败:', error);
      alert(`加载数据失败：${error instanceof Error ? error.message : '请检查网络连接和配置信息'}`);
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

  // 检查是否从诊断页面跳转过来，如果是则打开飞书配置
  useEffect(() => {
    const shouldOpenConfig = sessionStorage.getItem('return-to-diagnostic');
    if (shouldOpenConfig === 'true') {
      setShowFeishuDialog(true);
      sessionStorage.removeItem('return-to-diagnostic');
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfigHelper(true)}
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                配置助手
              </Button>
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

      {/* 飞书配置助手 */}
      <FeishuConfigHelper
        open={showConfigHelper}
        onOpenChange={setShowConfigHelper}
      />
    </div>
  );
}
