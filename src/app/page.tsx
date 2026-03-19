'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Globe, Info, Loader2, Settings } from 'lucide-react';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import FeishuConfigHelper from '@/components/feishu-config-helper';
import { loadFeishuConfig, validateConfig } from '@/lib/feishu-config';
import { Task } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [showFeishuDialog, setShowFeishuDialog] = useState(false);
  const [showConfigHelper, setShowConfigHelper] = useState(false);
  const [isSyncingToFeishu, setIsSyncingToFeishu] = useState(false);
  const [isLoadingFromFeishu, setIsLoadingFromFeishu] = useState(false);

  // 从飞书加载数据
  const handleLoadFromFeishu = async () => {
    const config = loadFeishuConfig();
    if (!config) {
      alert('请先配置飞书集成信息');
      return;
    }

    // 验证配置
    const { valid, missingFields } = validateConfig(config);
    if (!valid) {
      alert(`配置不完整！\n\n缺少的字段:\n${missingFields.map(f => `• ${f}`).join('\n')}`);
      return;
    }

    const dataSourceMode = config.dataSourceMode;
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;

    setIsLoadingFromFeishu(true);
    try {
      // 构建请求 URL
      let url = `/api/feishu/load-data?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
        `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources)}` +
        `&data_source_mode=${encodeURIComponent(dataSourceMode)}` +
        `&requirements_load_mode=${encodeURIComponent(config.requirementsLoadMode || 'all')}`;
      
      if (dataSourceMode === 'new') {
        const req1Id = config.newMode.tableIds.requirements1;
        const req2Id = config.newMode.tableIds.requirements2;
        const loadMode = config.requirementsLoadMode || 'all';

        if ((loadMode === 'all' || loadMode === 'requirements1') && req1Id) {
          url += `&requirements1_table_id=${encodeURIComponent(req1Id)}`;
        }
        if ((loadMode === 'all' || loadMode === 'requirements2') && req2Id) {
          url += `&requirements2_table_id=${encodeURIComponent(req2Id)}`;
        }
      } else {
        url += `&projects_table_id=${encodeURIComponent(config.legacyMode.tableIds.projects)}` +
          `&tasks_table_id=${encodeURIComponent(config.legacyMode.tableIds.tasks)}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        alert(`加载数据失败：${result.error}`);
        return;
      }

      const { resources, projects, tasks } = result.data;
      localStorage.setItem('complex-scenario-resources', JSON.stringify(resources));
      localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
      localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));
      localStorage.setItem('complex-scenario-data-source', JSON.stringify({
        source: 'feishu',
        loadMode: config.requirementsLoadMode || 'all',
        taskCount: tasks.length,
        timestamp: Date.now()
      }));

      const modeText = dataSourceMode === 'new' ? '需求表模式' : '传统模式';
      const loadModeText = config.requirementsLoadMode === 'all' ? '全部' : 
                          config.requirementsLoadMode === 'requirements1' ? '仅需求表1' : '仅需求表2';

      alert(`✅ 成功从飞书加载数据！\n\n模式: ${modeText}\n加载范围: ${loadModeText}\n\n人员: ${resources.length}\n项目: ${projects.length}\n任务: ${tasks.length}`);

      // 刷新页面以加载数据
      window.location.reload();
    } catch (error) {
      console.error('飞书数据加载失败:', error);
      alert(`加载数据失败：${error instanceof Error ? error.message : '请检查网络连接和配置信息'}`);
    } finally {
      setIsLoadingFromFeishu(false);
    }
  };

  // 同步到飞书（带进度显示，防止大数据量时崩溃）
  const handleSyncToFeishu = async () => {
    const config = loadFeishuConfig();
    if (!config) {
      alert('请先配置飞书集成信息');
      return;
    }

    const modeConfig = config.dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    
    // 读取数据
    const tasksStr = localStorage.getItem('complex-scenario-tasks');
    const scheduleResultStr = localStorage.getItem('complex-scenario-schedule-result');
    const resourcesStr = localStorage.getItem('complex-scenario-resources');

    const tasks = tasksStr ? JSON.parse(tasksStr) : [];
    const scheduleResult = scheduleResultStr ? JSON.parse(scheduleResultStr) : null;
    const sharedResources = resourcesStr ? JSON.parse(resourcesStr) : [];

    if (tasks.length === 0 && !scheduleResult) {
      alert('没有数据可同步');
      return;
    }

    setIsSyncingToFeishu(true);
    const results: string[] = [];

    try {
      // 同步排期（分批处理，每批100条）
      if (scheduleResult?.tasks?.length > 0 && modeConfig.tableIds.schedules) {
        const syncTasks = scheduleResult.tasks.map((task: any) => {
          const resource = sharedResources.find((r: any) => r.id === task.assignedResources?.[0]);
          const project = tasks.find((t: Task) => t.id === task.id);
          return {
            id: task.id,
            name: task.name,
            projectName: project?.projectName || '',
            assignedResourceId: task.assignedResources?.[0] || '',
            assignedResourceName: resource?.name || '',
            startDate: task.startDate || '',
            endDate: task.endDate || '',
            estimatedHours: task.estimatedHours,
            status: task.status,
            priority: task.priority,
            taskType: task.taskType || '',
          };
        });

        // 分批同步，每批100条
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < syncTasks.length; i += batchSize) {
          batches.push(syncTasks.slice(i, i + batchSize));
        }

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < batches.length; i++) {
          // 显示进度
          console.log(`[同步进度] 正在同步第 ${i + 1}/${batches.length} 批数据...`);
          
          const url = `/api/feishu/sync-schedule?app_id=${encodeURIComponent(config.appId)}` +
            `&app_secret=${encodeURIComponent(config.appSecret)}` +
            `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
            `&schedules_table_id=${encodeURIComponent(modeConfig.tableIds.schedules)}` +
            `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources || '')}`;
          
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tasks: batches[i] }),
            });

            const result = await response.json();
            if (result.success) {
              successCount += result.stats.success || batches[i].length;
              errorCount += result.stats.error || 0;
            } else {
              errorCount += batches[i].length;
            }
          } catch (batchError) {
            errorCount += batches[i].length;
            console.error(`[同步错误] 第 ${i + 1} 批同步失败:`, batchError);
          }

          // 每批之间等待100ms，避免请求过快
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        results.push(`✅ 排期：成功 ${successCount}，失败 ${errorCount}`);
      } else {
        results.push('⚠️ 没有排期数据或未配置排期表ID');
      }

      alert(`同步完成！\n\n${results.join('\n')}`);
    } catch (error) {
      console.error('同步失败:', error);
      alert(`同步失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSyncingToFeishu(false);
    }
  };

  // 页面级别的一次性数据清理
  const hasCleanedUp = useRef(false);
  useEffect(() => {
    if (hasCleanedUp.current) return;
    hasCleanedUp.current = true;

    const data = localStorage.getItem('complex-scenario-tasks');
    if (!data) return;

    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const idSet = new Set<string>();
      const problemTasks: string[] = [];
      parsed.forEach((t: Task) => {
        if (idSet.has(t.id)) {
          problemTasks.push(`${t.name} (${t.id})`);
        }
        idSet.add(t.id);
      });

      const hasDuplicateIds = problemTasks.length > 0;
      const hasNestedIds = parsed.some((t: Task) => {
        const subCount = (t.id.match(/-sub-/g) || []).length;
        return subCount >= 2;
      });

      if (hasDuplicateIds || hasNestedIds) {
        console.warn('清除所有旧数据以修复重复ID问题');
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

  // 检查是否从诊断页面跳转过来
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

      {/* Dialogs */}
      <FeishuIntegrationDialog
        open={showFeishuDialog}
        onOpenChange={setShowFeishuDialog}
        onSave={(newConfig) => {
          console.log('[Page] 配置已更新');
        }}
      />
      
      <FeishuConfigHelper
        open={showConfigHelper}
        onOpenChange={setShowConfigHelper}
      />
    </div>
  );
}
