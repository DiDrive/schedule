'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Globe, Info, Loader2, Settings } from 'lucide-react';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import FeishuConfigHelper from '@/components/feishu-config-helper';
import { SyncLoadingOverlay, LoadingOverlay } from '@/components/sync-loading-overlay';
import { loadFeishuConfig, validateConfig } from '@/lib/feishu-config';
import { Task } from '@/types/schedule';

interface SyncProgress {
  current: number;
  total: number;
  currentPhase: string;
}

export default function ProjectScheduleSystem() {
  const [showFeishuDialog, setShowFeishuDialog] = useState(false);
  const [showConfigHelper, setShowConfigHelper] = useState(false);
  const [isSyncingToFeishu, setIsSyncingToFeishu] = useState(false);
  const [isLoadingFromFeishu, setIsLoadingFromFeishu] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');

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
    setSyncMessage('正在连接飞书...');
    
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

      setSyncMessage('正在获取数据...');
      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        setIsLoadingFromFeishu(false);
        alert(`加载数据失败：${result.error}`);
        return;
      }

      const { resources, projects, tasks } = result.data;
      
      setSyncMessage('正在保存数据...');
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

      // 先关闭蒙版，再显示提示
      setIsLoadingFromFeishu(false);
      setSyncMessage('');

      alert(`✅ 成功从飞书加载数据！\n\n模式: ${modeText}\n加载范围: ${loadModeText}\n\n人员: ${resources.length}\n项目: ${projects.length}\n任务: ${tasks.length}`);

      // 刷新页面以加载数据
      window.location.reload();
    } catch (error) {
      console.error('飞书数据加载失败:', error);
      setIsLoadingFromFeishu(false);
      setSyncMessage('');
      alert(`加载数据失败：${error instanceof Error ? error.message : '请检查网络连接和配置信息'}`);
    }
  };

  // 同步到飞书（优化版本）
  const handleSyncToFeishu = async () => {
    const config = loadFeishuConfig();
    if (!config) {
      alert('请先配置飞书集成信息');
      return;
    }

    const dataSourceMode = config.dataSourceMode;
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    
    // 读取数据
    const tasksStr = localStorage.getItem('complex-scenario-tasks');
    const scheduleResultStr = localStorage.getItem('complex-scenario-schedule-result');
    const resourcesStr = localStorage.getItem('complex-scenario-resources');

    const localTasks = tasksStr ? JSON.parse(tasksStr) : [];
    const scheduleResult = scheduleResultStr ? JSON.parse(scheduleResultStr) : null;
    const sharedResources = resourcesStr ? JSON.parse(resourcesStr) : [];

    console.log('[同步调试] 本地任务数:', localTasks.length);
    console.log('[同步调试] 排期结果:', scheduleResult ? `存在，${scheduleResult.tasks?.length} 个任务` : '不存在');
    console.log('[同步调试] 资源数:', sharedResources.length);
    console.log('[同步调试] 数据源模式:', dataSourceMode);
    console.log('[同步调试] 排期表ID:', modeConfig.tableIds.schedules);

    // 检查是否有排期数据
    if (!scheduleResult || !scheduleResult.tasks || scheduleResult.tasks.length === 0) {
      alert('⚠️ 没有排期数据可同步\n\n请先点击"生成排期"按钮生成排期结果，然后再同步到飞书。');
      return;
    }

    // 检查是否配置了排期表ID
    if (!modeConfig.tableIds.schedules) {
      alert('⚠️ 未配置排期表ID\n\n请在飞书配置中设置排期表的 Table ID。');
      return;
    }

    setIsSyncingToFeishu(true);
    setSyncMessage('准备同步数据...');
    setSyncProgress({
      current: 0,
      total: 1,
      currentPhase: '初始化...'
    });

    try {
      // 准备同步数据
      // 排期表是独立的，每次同步会清空后重新创建所有记录
      // 所以每个子任务（平面/后期）都会有独立的排期记录
      const syncTasks = scheduleResult.tasks.map((task: any) => {
        const resource = sharedResources.find((r: any) => r.id === task.assignedResources?.[0]);
        const originalTask = localTasks.find((t: Task) => t.id === task.id);
        
        return {
          id: task.id,
          name: task.name,
          projectName: originalTask?.projectName || '',
          assignedResourceId: task.assignedResources?.[0] || '',
          assignedResourceName: resource?.name || '',
          startDate: task.startDate || '',
          endDate: task.endDate || '',
          estimatedHours: task.estimatedHours || originalTask?.estimatedHours || 0,
          estimatedHoursGraphic: task.estimatedHoursGraphic || originalTask?.estimatedHoursGraphic || 0,
          estimatedHoursPost: task.estimatedHoursPost || originalTask?.estimatedHoursPost || 0,
          status: task.status || 'pending',
          priority: task.priority || 'normal',
          taskType: task.taskType || originalTask?.taskType || '',
          deadline: task.deadline || originalTask?.deadline || '',
          suggestedDeadline: task.suggestedDeadline || '',
          subTaskDependencyMode: task.subTaskDependencyMode || originalTask?.subTaskDependencyMode || 'parallel',
          subTaskType: task.subTaskType || '',
          parentTaskId: task.parentTaskId || '',
        };
      });

      console.log('[同步调试] 准备同步的任务数:', syncTasks.length);
      setSyncProgress({
        current: 0,
        total: 1,
        currentPhase: `正在同步 ${syncTasks.length} 条排期记录...`
      });

      // 构建请求 URL - 只需要排期表ID
      const url = `/api/feishu/sync-schedule?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
        `&schedules_table_id=${encodeURIComponent(modeConfig.tableIds.schedules)}` +
        `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources || '')}`;

      console.log('[同步调试] 请求URL:', url.substring(0, 100) + '...');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: syncTasks }),
      });

      const result = await response.json();
      console.log('[同步调试] API响应:', result);

      setSyncProgress({
        current: 1,
        total: 1,
        currentPhase: '同步完成'
      });

      // 先关闭蒙版和进度
      setIsSyncingToFeishu(false);
      setSyncProgress(null);
      setSyncMessage('');

      if (result.success) {
        const successCount = result.stats?.success || 0;
        const errorCount = result.stats?.error || 0;
        const errorDetails = result.errors?.length > 0 
          ? `\n\n部分失败详情:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n...还有 ${result.errors.length - 5} 条错误` : ''}`
          : '';
        
        alert(`✅ 同步完成！\n\n成功: ${successCount} 条\n失败: ${errorCount} 条${errorDetails}`);
      } else {
        alert(`❌ 同步失败：${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('[同步调试] 同步失败:', error);
      setIsSyncingToFeishu(false);
      setSyncProgress(null);
      setSyncMessage('');
      alert(`同步失败：${error instanceof Error ? error.message : '未知错误'}`);
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
      {/* 同步蒙版 - 阻止用户操作 */}
      <SyncLoadingOverlay 
        isVisible={isSyncingToFeishu} 
        progress={syncProgress || undefined}
        message={syncMessage}
      />
      
      {/* 加载蒙版 */}
      <LoadingOverlay 
        isVisible={isLoadingFromFeishu} 
        message={syncMessage}
      />

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
                disabled={isLoadingFromFeishu || isSyncingToFeishu}
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
                disabled={isSyncingToFeishu || isLoadingFromFeishu}
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
                disabled={isSyncingToFeishu || isLoadingFromFeishu}
              >
                <Info className="h-4 w-4" />
                配置助手
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFeishuDialog(true)}
                className="gap-2"
                disabled={isSyncingToFeishu || isLoadingFromFeishu}
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
