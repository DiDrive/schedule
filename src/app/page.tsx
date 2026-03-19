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

    let config = JSON.parse(configStr);
    
    // 兼容性处理：检测旧配置格式并转换
    if (config.appToken && !config.newMode && !config.legacyMode) {
      console.log('[Page] 检测到旧配置格式，自动转换...');
      const oldTableIds = config.tableIds || {};
      const dataSourceMode = config.dataSourceMode || 'new';
      
      config = {
        appId: config.appId,
        appSecret: config.appSecret,
        dataSourceMode: dataSourceMode,
        newMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            requirements1: oldTableIds.requirements1 || '',
            requirements2: oldTableIds.requirements2 || '',
            schedules: oldTableIds.schedules || '',
          },
        },
        legacyMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            projects: oldTableIds.projects || '',
            tasks: oldTableIds.tasks || '',
            schedules: oldTableIds.schedules || '',
          },
        },
      };
    }
    
    const dataSourceMode = config.dataSourceMode || 'new';
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    
    // 验证配置
    if (!config.appId || !config.appSecret || !modeConfig?.appToken) {
      alert('飞书配置不完整，请填写 App ID、App Secret 和当前模式的 App Token');
      return;
    }
    
    // 根据模式验证必填的 Table ID
    if (dataSourceMode === 'new') {
      if (!modeConfig?.tableIds?.resources || !modeConfig?.tableIds?.requirements1) {
        alert('需求表模式配置不完整，请填写人员表和需求表1的 Table ID');
        return;
      }
    } else {
      if (!modeConfig?.tableIds?.resources || !modeConfig?.tableIds?.projects || !modeConfig?.tableIds?.tasks) {
        alert('传统模式配置不完整，请填写人员表、项目表和任务表的 Table ID');
        return;
      }
    }

    setIsLoadingFromFeishu(true);
    try {
      // 构建请求 URL
      let url = `/api/feishu/load-data?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
        `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources)}` +
        `&data_source_mode=${encodeURIComponent(dataSourceMode)}`;
      
      // 需求表加载模式
      const requirementsLoadMode = config.requirementsLoadMode || 'all';
      url += `&requirements_load_mode=${encodeURIComponent(requirementsLoadMode)}`;
      
      console.log('[Page Load] 需求表加载模式:', requirementsLoadMode);
      
      if (dataSourceMode === 'new') {
        // 需求表模式 - 根据加载模式决定传递哪些表 ID
        const req1Id = config.newMode?.tableIds?.requirements1;
        const req2Id = config.newMode?.tableIds?.requirements2;
        
        console.log('[Page Load] 需求表1 ID:', req1Id || '(未设置)');
        console.log('[Page Load] 需求表2 ID:', req2Id || '(未设置)');
        
        if ((requirementsLoadMode === 'all' || requirementsLoadMode === 'requirements1') && req1Id) {
          url += `&requirements1_table_id=${encodeURIComponent(req1Id)}`;
          console.log('[Page Load] ✅ 添加需求表1参数');
        }
        if ((requirementsLoadMode === 'all' || requirementsLoadMode === 'requirements2') && req2Id) {
          url += `&requirements2_table_id=${encodeURIComponent(req2Id)}`;
          console.log('[Page Load] ✅ 添加需求表2参数');
        }
      } else {
        // 传统模式
        url += `&projects_table_id=${encodeURIComponent(modeConfig.tableIds.projects)}` +
          `&tasks_table_id=${encodeURIComponent(modeConfig.tableIds.tasks)}`;
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

      const stats = result.stats || {};
      const modeText = dataSourceMode === 'new' ? '需求表模式' : '传统模式';
      const message = `成功从飞书多维表加载数据！

📊 数据源模式: ${modeText}

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

  // 同步到飞书（同步项目、任务和排期）
  const handleSyncToFeishu = async () => {
    console.log('[Feishu Sync] 开始同步到飞书');

    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    let config = JSON.parse(configStr);
    
    // 兼容性处理：检测旧配置格式并转换
    if (config.appToken && !config.newMode && !config.legacyMode) {
      console.log('[Page Sync] 检测到旧配置格式，自动转换...');
      const oldTableIds = config.tableIds || {};
      const dataSourceMode = config.dataSourceMode || 'new';
      
      config = {
        appId: config.appId,
        appSecret: config.appSecret,
        dataSourceMode: dataSourceMode,
        newMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            requirements1: oldTableIds.requirements1 || '',
            requirements2: oldTableIds.requirements2 || '',
            schedules: oldTableIds.schedules || '',
          },
        },
        legacyMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            projects: oldTableIds.projects || '',
            tasks: oldTableIds.tasks || '',
            schedules: oldTableIds.schedules || '',
          },
        },
      };
    }
    
    const dataSourceMode = config.dataSourceMode || 'new';
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    
    const results: string[] = [];

    // 从 localStorage 读取数据
    const projectsStr = localStorage.getItem('complex-scenario-projects');
    const tasksStr = localStorage.getItem('complex-scenario-tasks');
    const scheduleResultStr = localStorage.getItem('complex-scenario-schedule-result');
    const resourcesStr = localStorage.getItem('complex-scenario-resources');

    const projects = projectsStr ? JSON.parse(projectsStr) : [];
    const tasks = tasksStr ? JSON.parse(tasksStr) : [];
    const scheduleResult = scheduleResultStr ? JSON.parse(scheduleResultStr) : null;
    const sharedResources = resourcesStr ? JSON.parse(resourcesStr) : [];

    console.log('[Feishu Sync] 数据读取结果:', {
      projectsCount: projects.length,
      tasksCount: tasks.length,
      hasSchedule: !!scheduleResult,
      hasResources: sharedResources.length > 0,
      dataSourceMode,
      modeConfig,
    });

    const getProjectById = (id: string) => projects.find((p: any) => p.id === id);

    setIsSyncingToFeishu(true);

    // 同步项目（仅传统模式支持）
    if (dataSourceMode === 'legacy' && projects.length > 0 && modeConfig?.tableIds?.projects) {
      console.log('[Feishu Sync] 准备同步项目:', projects.length, '个');
      try {
        const response = await fetch('/api/feishu/sync-projects-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projects: projects,
            tasks: [],
            config: {
              appId: config.appId,
              appSecret: config.appSecret,
              appToken: modeConfig.appToken,
              tableIds: { 
                projects: modeConfig.tableIds.projects || '', 
                tasks: modeConfig.tableIds.tasks || '',
                resources: modeConfig.tableIds.resources || '',
              },
            },
          }),
        });
        const result = await response.json();
        console.log('[Feishu Sync] 项目同步结果:', result);
        if (result.success) {
          const deleted = result.stats.projects.deleted || 0;
          const projectResult = deleted > 0 
            ? `✅ 项目：创建 ${result.stats.projects.created}，更新 ${result.stats.projects.updated}，删除 ${deleted}`
            : `✅ 项目：创建 ${result.stats.projects.created}，更新 ${result.stats.projects.updated}`;
          results.push(projectResult);
        } else {
          results.push(`❌ 项目：${result.message}`);
        }
      } catch (error) {
        console.error('[Feishu Sync] 项目同步错误:', error);
        results.push(`❌ 项目：${error instanceof Error ? error.message : '同步失败'}`);
      }
    } else {
      console.log('[Feishu Sync] 跳过项目同步，原因:', {
        isLegacyMode: dataSourceMode === 'legacy',
        hasProjects: projects.length > 0,
        hasProjectTableId: !!modeConfig?.tableIds?.projects
      });
    }

    // 同步任务（仅传统模式支持）
    if (dataSourceMode === 'legacy' && tasks.length > 0 && modeConfig?.tableIds?.tasks) {
      console.log('[Feishu Sync] 准备同步任务:', tasks.length, '个');
      
      // 创建项目ID到项目名称的映射
      const projectIdToName = new Map<string, string>();
      projects.forEach((p: any) => {
        if (p.id) projectIdToName.set(p.id, p.name);
      });
      
      // 将任务中的项目ID替换为项目名称
      const tasksWithProjectNames = tasks.map((task: any) => ({
        ...task,
        projectName: task.projectId ? projectIdToName.get(task.projectId) || '' : ''
      }));
      
      try {
        const response = await fetch('/api/feishu/sync-projects-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projects: [],
            tasks: tasksWithProjectNames,
            projectsMap: Object.fromEntries(projectIdToName), // 传递项目映射
            config: {
              appId: config.appId,
              appSecret: config.appSecret,
              appToken: modeConfig.appToken,
              tableIds: { 
                projects: modeConfig.tableIds.projects || '', 
                tasks: modeConfig.tableIds.tasks || '',
                resources: modeConfig.tableIds.resources || '',
              },
            },
          }),
        });
        const result = await response.json();
        console.log('[Feishu Sync] 任务同步结果:', result);
        if (result.success) {
          const deleted = result.stats.tasks.deleted || 0;
          const taskResult = deleted > 0 
            ? `✅ 任务：创建 ${result.stats.tasks.created}，更新 ${result.stats.tasks.updated}，删除 ${deleted}`
            : `✅ 任务：创建 ${result.stats.tasks.created}，更新 ${result.stats.tasks.updated}`;
          results.push(taskResult);
        } else {
          results.push(`❌ 任务：${result.message}`);
        }
      } catch (error) {
        console.error('[Feishu Sync] 任务同步错误:', error);
        results.push(`❌ 任务：${error instanceof Error ? error.message : '同步失败'}`);
      }
    } else {
      console.log('[Feishu Sync] 跳过任务同步，原因:', {
        isLegacyMode: dataSourceMode === 'legacy',
        hasTasks: tasks.length > 0,
        hasTaskTableId: !!modeConfig?.tableIds?.tasks
      });
    }

    // 同步排期
    if (scheduleResult && scheduleResult.tasks && scheduleResult.tasks.length > 0 && modeConfig?.tableIds?.schedules) {
      try {
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
        if (result.success) {
          results.push(`✅ 排期：成功 ${result.stats.success}，失败 ${result.stats.error}`);
        } else {
          results.push(`❌ 排期：${result.error || '未知错误'}`);
        }
      } catch (error) {
        results.push(`❌ 排期：${error instanceof Error ? error.message : '同步失败'}`);
      }
    }

    setIsSyncingToFeishu(false);

    // 显示汇总结果
    if (results.length > 0) {
      alert(`同步完成！\n\n${results.join('\n')}`);
    } else {
      alert('没有数据可同步或未配置飞书表格 ID');
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
