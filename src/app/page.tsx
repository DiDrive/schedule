'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Globe, Info, Loader2, Settings } from 'lucide-react';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import FeishuConfigHelper from '@/components/feishu-config-helper';
import { Task } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [showFeishuDialog, setShowFeishuDialog] = useState(false);
  const [showConfigHelper, setShowConfigHelper] = useState(false);
  const [isSyncingToFeishu, setIsSyncingToFeishu] = useState(false);
  const [isLoadingFromFeishu, setIsLoadingFromFeishu] = useState(false);

  // 从飞书加载数据
  const handleLoadFromFeishu = async () => {
    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    const config = JSON.parse(configStr);
    if (!config.appId || !config.appSecret || !config.appToken ||
        !config.tableIds?.resources || !config.tableIds?.projects || !config.tableIds?.tasks) {
      alert('飞书配置不完整，请填写 App ID、App Secret、App Token 和所有 Table ID');
      return;
    }

    // 询问是否清理旧数据
    const shouldClear = confirm('是否清理旧数据后再加载？\n\n建议：是（确保数据一致性）\n否（保留可能存在的冲突）');
    if (shouldClear) {
      console.log('[Feishu Load] 清理旧数据...');
      localStorage.removeItem('complex-scenario-projects');
      localStorage.removeItem('complex-scenario-tasks');
      localStorage.removeItem('complex-scenario-resources');
      localStorage.removeItem('complex-scenario-schedule-result');
      alert('旧数据已清理，开始从飞书加载新数据...');
    }

    setIsLoadingFromFeishu(true);
    try {
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

      const { resources, projects, tasks } = result.data;
      localStorage.setItem('complex-scenario-resources', JSON.stringify(resources));
      localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
      localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));

      const stats = result.stats || {};
      const message = `成功从飞书多维表加载数据！

📊 数据统计：
  • 人员：${resources.length} 个
  • 项目：${projects.length} 个
  • 任务：${tasks.length} 个

👤 负责人映射：
  • 已设置负责人：${stats.tasksWithAssignee || 0} 个
  • 自动分配：${stats.tasksWithoutAssignee || 0} 个`;

      alert(message);

      // 刷新页面以加载数据
      window.location.reload();
    } catch (error) {
      console.error('飞书数据加载失败:', error);
      alert(`加载数据失败：${error instanceof Error ? error.message : '请检查网络连接和配置信息'}`);
    } finally {
      setIsLoadingFromFeishu(false);
    }
  };

  // 同步到飞书
  const handleSyncToFeishu = async () => {
    console.log('[Feishu Sync] 开始同步到飞书');

    // 从 localStorage 读取排期结果
    const scheduleResultStr = localStorage.getItem('complex-scenario-schedule-result');
    if (!scheduleResultStr) {
      alert('请先生成排期结果');
      return;
    }

    let scheduleResult;
    try {
      scheduleResult = JSON.parse(scheduleResultStr);
    } catch (error) {
      alert('排期结果数据格式错误');
      return;
    }

    if (!scheduleResult || !scheduleResult.tasks || scheduleResult.tasks.length === 0) {
      alert('请先生成排期结果');
      return;
    }

    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    const config = JSON.parse(configStr);
    if (!config.appId || !config.appSecret || !config.appToken || !config.tableIds?.schedules) {
      alert('飞书配置不完整，请填写 App ID、App Secret、App Token 和排期表 Table ID');
      return;
    }

    setIsSyncingToFeishu(true);

    try {
      // 从 localStorage 读取资源和项目数据
      const resourcesStr = localStorage.getItem('complex-scenario-resources');
      const projectsStr = localStorage.getItem('complex-scenario-projects');
      
      const sharedResources = resourcesStr ? JSON.parse(resourcesStr) : [];
      const projects = projectsStr ? JSON.parse(projectsStr) : [];

      const getProjectById = (id: string) => projects.find((p: any) => p.id === id);

      // 准备同步数据
      const syncTasks = scheduleResult.tasks.map((task: any) => {
        const resource = sharedResources.find((r: any) => r.id === task.assignedResources[0]);
        const project = getProjectById(task.projectId || '');

        return {
          id: task.id,
          name: task.name,
          projectName: project?.name || '',
          assignedResourceId: task.assignedResources[0] || '',
          assignedResourceName: resource?.name || '',
          startDate: task.startDate ? task.startDate : '',
          endDate: task.endDate ? task.endDate : '',
          estimatedHours: task.estimatedHours,
          status: task.status,
          priority: task.priority,
          taskType: task.taskType || '',
        };
      });

      console.log('[Feishu Sync] 准备同步', syncTasks.length, '个任务');

      // 调用同步接口
      const url = `/api/feishu/sync-schedule?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(config.appToken)}` +
        `&schedules_table_id=${encodeURIComponent(config.tableIds.schedules)}` +
        `&resources_table_id=${encodeURIComponent(config.tableIds.resources || '')}`;
      
      console.log('[Feishu Sync] 同步URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: syncTasks,
        }),
      });

      const result = await response.json();
      console.log('[Feishu Sync] 同步结果:', result);

      if (result.success) {
        alert(`同步成功！\n\n成功: ${result.stats.success}\n失败: ${result.stats.error}`);
        if (result.errors && result.errors.length > 0) {
          console.error('同步错误详情:', result.errors);
        }
      } else {
        alert(`同步失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('[Feishu Sync] 同步异常:', error);
      alert(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSyncingToFeishu(false);
    }
  };

  // 页面级别的一次性数据清理
  const hasCleanedUp = useRef(false);
  useEffect(() => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    // 只检查复杂场景的任务
    const data = localStorage.getItem('complex-scenario-tasks');
    if (!data) return;

    try {
      const parsed = JSON.parse(data);

      if (!Array.isArray(parsed)) return;

      // 检查重复ID
      const idMap = new Map<string, number>();
      let hasDuplicateIds = false;
      let problemTasks: string[] = [];

      parsed.forEach((t: Task) => {
        const count = idMap.get(t.id) || 0;
        idMap.set(t.id, count + 1);
        if (count > 0) {
          hasDuplicateIds = true;
          console.warn(`发现重复任务ID: ${t.id}`);
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
        console.warn('清除所有旧数据以修复重复ID问题');
        console.warn('问题任务ID:', problemTasks);
        localStorage.removeItem('complex-scenario-projects');
        localStorage.removeItem('complex-scenario-tasks');
        localStorage.removeItem('complex-scenario-resources');
        localStorage.removeItem('complex-scenario-schedule-result');
        alert('检测到数据异常，已自动清理旧数据。请重新开始。');
      }
    } catch (e) {
      console.error('解析数据失败:', e);
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
                onClick={handleLoadFromFeishu}
                disabled={isLoadingFromFeishu}
                className="gap-2"
              >
                {isLoadingFromFeishu ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {isLoadingFromFeishu ? '加载中...' : '从飞书加载'}
              </Button>
              <Button
                variant="outline"
                onClick={handleSyncToFeishu}
                disabled={isSyncingToFeishu}
                className="gap-2"
              >
                {isSyncingToFeishu ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {isSyncingToFeishu ? '同步中...' : '同步到飞书'}
              </Button>
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
                <Settings className="h-4 w-4" />
                飞书配置
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <ComplexScenario />
      </main>

      {/* 飞书集成对话框 */}
      <FeishuIntegrationDialog
        open={showFeishuDialog}
        onOpenChange={setShowFeishuDialog}
        onSync={async () => {}}
      />

      {/* 飞书配置助手 */}
      <FeishuConfigHelper
        open={showConfigHelper}
        onOpenChange={setShowConfigHelper}
      />
    </div>
  );
}
