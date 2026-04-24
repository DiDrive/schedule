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
import { loadAllData, syncAllData } from '@/storage/database/db-service';

interface SyncProgress {
  current: number;
  total: number;
  currentPhase: string;
}

function toIsoStringOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapTaskToDbPayload(task: any) {
  return {
    id: task.id,
    name: task.name || '',
    description: task.description || '',
    estimated_hours: task.estimatedHours || 0,
    assigned_resources: Array.isArray(task.assignedResources) ? task.assignedResources : [],
    deadline: toIsoStringOrUndefined(task.deadline),
    priority: task.priority || 'normal',
    status: task.status || 'pending',
    task_type: task.taskType || undefined,
    project_id: task.projectId || undefined,
    project_name: task.projectName || undefined,
    start_date: toIsoStringOrUndefined(task.startDate),
    end_date: toIsoStringOrUndefined(task.endDate),
    category: task.category || undefined,
    sub_type: task.subType || undefined,
    language: task.language || undefined,
    dubbing: task.dubbing || undefined,
    contact_person: task.contactPerson || undefined,
    business_month: task.businessMonth || undefined,
    local_sub_tasks: task.localSubTasks || undefined,
    resource_assignments: task.resourceAssignments || undefined,
  };
}

function mapResourceToDbPayload(resource: any) {
  return {
    id: resource.id,
    name: resource.name || '',
    type: resource.type || 'human',
    work_type: resource.workType || undefined,
    level: resource.level || undefined,
    capacity: resource.capacity || 8,
    is_active: resource.isActive ?? true,
    metadata: {
      efficiency: resource.efficiency ?? 1,
      skills: resource.skills ?? [],
      availability: resource.availability ?? 1,
      color: resource.color,
    },
  };
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

      // 写入数据库，确保多端读取一致（失败时不阻塞飞书加载）
      let dbSyncWarning = '';
      try {
        await syncAllData({
          resources: resources.map((r: any) => mapResourceToDbPayload(r)),
          tasks: tasks.map((t: any) => mapTaskToDbPayload(t)),
          projects: projects.map((p: any) => ({ ...p })),
        });
      } catch (dbError) {
        console.warn('[飞书加载] 数据库同步失败，已回落本地缓存模式:', dbError);
        dbSyncWarning = '\n\n⚠️ 数据库未配置或不可用，当前仅保存在本浏览器。';
      }

      const modeText = dataSourceMode === 'new' ? '需求表模式' : '传统模式';
      const loadModeText = config.requirementsLoadMode === 'all' ? '全部' : 
                          config.requirementsLoadMode === 'requirements1' ? '仅需求表1' : '仅需求表2';

      // 更新消息，保持 loading 状态
      setSyncMessage(`加载完成！人员: ${resources.length}, 项目: ${projects.length}, 任务: ${tasks.length}。正在刷新页面...`);
      
      // 延迟刷新，让用户看到成功消息
      setTimeout(() => {
        if (dbSyncWarning) {
          alert(`飞书数据已加载到本地缓存。${dbSyncWarning}`);
        }
        window.location.reload();
      }, 500);
      
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
    const projectsStr = localStorage.getItem('complex-scenario-projects');

    let localTasks = tasksStr ? JSON.parse(tasksStr) : [];
    let scheduleResult = scheduleResultStr ? JSON.parse(scheduleResultStr) : null;
    let sharedResources = resourcesStr ? JSON.parse(resourcesStr) : [];
    let localProjects = projectsStr ? JSON.parse(projectsStr) : [];
    
    // 本地无排期结果时，回退到数据库任务（跨设备一致）
    if (!scheduleResult || !scheduleResult.tasks || scheduleResult.tasks.length === 0) {
      try {
        const dbData = await loadAllData();
        const dbTasks = (dbData.tasks || []).map((dbTask: any) => ({
          id: dbTask.id,
          name: dbTask.name,
          estimatedHours: dbTask.estimated_hours || 0,
          priority: dbTask.priority || 'normal',
          status: dbTask.status || 'pending',
          taskType: dbTask.task_type || '',
          projectId: dbTask.project_id || '',
          projectName: dbTask.project_name || '',
          assignedResources: (dbTask.assigned_resources as string[]) || [],
          startDate: dbTask.start_date || '',
          endDate: dbTask.end_date || '',
          deadline: dbTask.deadline || '',
          subType: dbTask.sub_type || '',
          language: dbTask.language || '',
        }));
        if (dbTasks.length > 0) {
          localTasks = dbTasks;
          scheduleResult = { tasks: dbTasks };
        }

        const dbResources = (dbData.resources || []).map((dbRes: any) => ({
          id: dbRes.id,
          name: dbRes.name,
        }));
        if (dbResources.length > 0) {
          sharedResources = dbResources;
        }

        if (Array.isArray(dbData.projects) && dbData.projects.length > 0) {
          localProjects = dbData.projects;
        }
      } catch (error) {
        console.error('[同步调试] 数据库回退读取失败:', error);
      }
    }

    // 创建 projectId -> projectName 的映射
    const projectIdToName = new Map(localProjects.map((p: any) => [p.id, p.name]));

    // 检查是否有排期数据
    if (!scheduleResult || !scheduleResult.tasks || scheduleResult.tasks.length === 0) {
      alert('⚠️ 没有排期数据可同步\n\n请先点击"生成排期"按钮，或确认数据库中已有排期任务数据。');
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
      // 准备同步数据（每次同步会删除所有旧记录，重新创建）
      const syncTasks = scheduleResult.tasks.map((task: any) => {
        const resource = sharedResources.find((r: any) => r.id === task.assignedResources?.[0]);
        const originalTask = localTasks.find((t: Task) => t.id === task.id);
        
        // 通过 projectId 查找项目名称
        const projectName = projectIdToName.get(task.projectId || originalTask?.projectId) || '';
        
        return {
          id: task.id,
          name: task.name,
          projectName: projectName,
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
          subType: originalTask?.subType || '',
          language: originalTask?.language || '',
        };
      });

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

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: syncTasks }),
      });

      const result = await response.json();

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
    <div className="min-h-screen max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
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
      <main className="w-full max-w-full overflow-x-hidden px-4 py-6">
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
