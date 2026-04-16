'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, RefreshCw, Globe, Info } from 'lucide-react';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  dataSourceMode: 'legacy' | 'new';
  
  // 需求表加载模式：'all' 全部 | 'requirements1' 仅需求表1 | 'requirements2' 仅需求表2
  requirementsLoadMode?: 'all' | 'requirements1' | 'requirements2';
  
  // 需求表模式配置（独立的多维表）
  newMode: {
    appToken: string;
    tableIds: {
      resources: string;
      requirements1: string;
      requirements2: string;
      schedules: string;
    };
    viewIds?: {
      requirements2Matrix?: string;
    };
  };
  
  // 传统模式配置（独立的多维表）
  legacyMode: {
    appToken: string;
    tableIds: {
      resources: string;
      projects: string;
      tasks: string;
      schedules: string;
    };
  };
  
  enableAutoSync: boolean;
  autoSyncInterval: number;
}

interface FeishuIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (config: FeishuConfig) => void;
  onSync?: () => Promise<void>;
}

const defaultConfig: FeishuConfig = {
  appId: '',
  appSecret: '',
  dataSourceMode: 'new',
  requirementsLoadMode: 'all',
  newMode: {
    appToken: '',
    tableIds: {
      resources: '',
      requirements1: '',
      requirements2: '',
      schedules: '',
    },
    viewIds: {
      requirements2Matrix: '',
    },
  },
  legacyMode: {
    appToken: '',
    tableIds: {
      resources: '',
      projects: '',
      tasks: '',
      schedules: '',
    },
  },
  enableAutoSync: true,
  autoSyncInterval: 5,
};

export default function FeishuIntegrationDialog({
  open,
  onOpenChange,
  onSave,
  onSync,
}: FeishuIntegrationDialogProps) {
  const [config, setConfig] = useState<FeishuConfig>(defaultConfig);
  const [testMode, setTestMode] = useState<'new' | 'legacy'>('new');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{[key in 'new' | 'legacy']?: 'success' | 'failed'}>({});
  const [connectionError, setConnectionError] = useState<{[key in 'new' | 'legacy']?: string}>({});

  // 从 localStorage 加载配置
  useEffect(() => {
    if (!open) return;
    
    const savedConfig = localStorage.getItem('feishu-config');
    console.log('[Feishu Dialog] 加载配置:', savedConfig);
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({
          appId: parsed.appId || '',
          appSecret: parsed.appSecret || '',
          dataSourceMode: parsed.dataSourceMode || 'new',
          requirementsLoadMode: parsed.requirementsLoadMode || 'all',
          newMode: {
            appToken: parsed.newMode?.appToken || '',
            tableIds: {
              resources: parsed.newMode?.tableIds?.resources || '',
              requirements1: parsed.newMode?.tableIds?.requirements1 || '',
              requirements2: parsed.newMode?.tableIds?.requirements2 || '',
              schedules: parsed.newMode?.tableIds?.schedules || '',
            },
            viewIds: {
              requirements2Matrix: parsed.newMode?.viewIds?.requirements2Matrix || '',
            },
          },
          legacyMode: {
            appToken: parsed.legacyMode?.appToken || '',
            tableIds: {
              resources: parsed.legacyMode?.tableIds?.resources || '',
              projects: parsed.legacyMode?.tableIds?.projects || '',
              tasks: parsed.legacyMode?.tableIds?.tasks || '',
              schedules: parsed.legacyMode?.tableIds?.schedules || '',
            },
          },
          enableAutoSync: parsed.enableAutoSync ?? true,
          autoSyncInterval: parsed.autoSyncInterval ?? 5,
        });
      } catch (error) {
        console.error('Failed to load Feishu config:', error);
      }
    }
    setConnectionStatus({});
    setConnectionError({});
  }, [open]);

  // 测试连接
  const handleTestConnection = async (mode: 'new' | 'legacy') => {
    const modeConfig = mode === 'new' ? config.newMode : config.legacyMode;
    
    if (!config.appId || !config.appSecret || !modeConfig.appToken) {
      setConnectionStatus(prev => ({ ...prev, [mode]: 'failed' }));
      setConnectionError(prev => ({ ...prev, [mode]: '请先填写 App ID、App Secret 和 App Token' }));
      return;
    }
    
    setTestMode(mode);
    setIsTestingConnection(true);
    setConnectionStatus(prev => ({ ...prev, [mode]: undefined }));
    setConnectionError(prev => ({ ...prev, [mode]: undefined }));
    
    try {
      const response = await fetch('/api/feishu/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId.trim(),
          appSecret: config.appSecret.trim(),
          appToken: modeConfig.appToken.trim(),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus(prev => ({ ...prev, [mode]: 'success' }));
      } else {
        setConnectionStatus(prev => ({ ...prev, [mode]: 'failed' }));
        setConnectionError(prev => ({ ...prev, [mode]: data.error || '连接失败' }));
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, [mode]: 'failed' }));
      setConnectionError(prev => ({ ...prev, [mode]: error instanceof Error ? error.message : '网络错误' }));
    } finally {
      setIsTestingConnection(false);
    }
  };

  // 保存配置
  const handleSave = () => {
    const cleanedConfig: FeishuConfig = {
      appId: config.appId.trim(),
      appSecret: config.appSecret.trim(),
      dataSourceMode: config.dataSourceMode,
      requirementsLoadMode: config.requirementsLoadMode || 'all',
      newMode: {
        appToken: config.newMode.appToken.trim(),
        tableIds: {
          resources: config.newMode.tableIds.resources.trim(),
          requirements1: config.newMode.tableIds.requirements1.trim(),
          requirements2: config.newMode.tableIds.requirements2.trim(),
          schedules: config.newMode.tableIds.schedules.trim(),
        },
        viewIds: {
          requirements2Matrix: config.newMode.viewIds?.requirements2Matrix?.trim() || '',
        },
      },
      legacyMode: {
        appToken: config.legacyMode.appToken.trim(),
        tableIds: {
          resources: config.legacyMode.tableIds.resources.trim(),
          projects: config.legacyMode.tableIds.projects.trim(),
          tasks: config.legacyMode.tableIds.tasks.trim(),
          schedules: config.legacyMode.tableIds.schedules.trim(),
        },
      },
      enableAutoSync: config.enableAutoSync,
      autoSyncInterval: config.autoSyncInterval,
    };
    
    console.log('[Feishu Dialog] 保存配置:', JSON.stringify(cleanedConfig, null, 2));
    console.log('[Feishu Dialog] requirements2:', cleanedConfig.newMode.tableIds.requirements2);
    
    // 验证当前选中模式的必填字段
    const missingFields: string[] = [];
    
    if (!cleanedConfig.appId) missingFields.push('App ID');
    if (!cleanedConfig.appSecret) missingFields.push('App Secret');
    
    if (cleanedConfig.dataSourceMode === 'new') {
      if (!cleanedConfig.newMode.appToken) missingFields.push('需求表模式 App Token');
      if (!cleanedConfig.newMode.tableIds.resources) missingFields.push('需求表模式 人员表 ID');
      // 根据加载选项决定是否验证需求表1
      const loadMode = cleanedConfig.requirementsLoadMode || 'all';
      if (loadMode === 'all' || loadMode === 'requirements1') {
        if (!cleanedConfig.newMode.tableIds.requirements1) missingFields.push('需求表模式 需求表1 ID');
      }
    } else {
      if (!cleanedConfig.legacyMode.appToken) missingFields.push('传统模式 App Token');
      if (!cleanedConfig.legacyMode.tableIds.resources) missingFields.push('传统模式 人员表 ID');
      if (!cleanedConfig.legacyMode.tableIds.projects) missingFields.push('传统模式 项目表 ID');
      if (!cleanedConfig.legacyMode.tableIds.tasks) missingFields.push('传统模式 任务表 ID');
    }
    
    if (missingFields.length > 0) {
      alert(`请填写当前模式的必填项：\n\n${missingFields.map(f => `• ${f}`).join('\n')}\n\n（带红色 * 号的字段）`);
      return;
    }
    
    localStorage.setItem('feishu-config', JSON.stringify(cleanedConfig));
    setConfig(cleanedConfig);
    onSave?.(cleanedConfig);
    
    const modeText = cleanedConfig.dataSourceMode === 'new' ? '需求表模式' : '传统模式';
    const loadModeText = cleanedConfig.requirementsLoadMode === 'all' ? '全部加载' : 
                       cleanedConfig.requirementsLoadMode === 'requirements1' ? '仅需求表1' : '仅需求表2';
    
    alert(`✅ 配置已保存！\n\n模式: ${modeText}\n加载范围: ${loadModeText}`);
    onOpenChange(false);
  };

  // 重置配置
  const handleReset = () => {
    localStorage.removeItem('feishu-config');
    setConfig(defaultConfig);
    setConnectionStatus({});
    setConnectionError({});
    alert('配置已重置！');
  };

  // 更新需求表模式字段
  const updateNewMode = (field: string, value: string) => {
    if (field === 'appToken') {
      setConfig(prev => ({
        ...prev,
        newMode: { ...prev.newMode, appToken: value.trim() }
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        newMode: {
          ...prev.newMode,
          tableIds: { ...prev.newMode.tableIds, [field]: value.trim() }
        }
      }));
    }
  };

  // 更新传统模式字段
  const updateLegacyMode = (field: string, value: string) => {
    if (field === 'appToken') {
      setConfig(prev => ({
        ...prev,
        legacyMode: { ...prev.legacyMode, appToken: value.trim() }
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        legacyMode: {
          ...prev.legacyMode,
          tableIds: { ...prev.legacyMode.tableIds, [field]: value.trim() }
        }
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            飞书集成配置
          </DialogTitle>
          <DialogDescription>
            配置飞书应用信息，两种模式的表格在不同的多维表中，需要分别配置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 飞书应用信息 - 共用 */}
          <Card>
            <CardHeader>
              <CardTitle>飞书应用信息 <span className="text-sm font-normal text-slate-500">（两种模式共用）</span></CardTitle>
              <CardDescription>应用凭证，两种模式共用同一套应用信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appId">App ID <span className="text-red-500">*</span></Label>
                <Input
                  id="appId"
                  placeholder="cli_xxxxxxxxx"
                  value={config.appId}
                  onChange={(e) => setConfig(prev => ({ ...prev, appId: e.target.value.trim() }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appSecret">App Secret <span className="text-red-500">*</span></Label>
                <Input
                  id="appSecret"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={config.appSecret}
                  onChange={(e) => setConfig(prev => ({ ...prev, appSecret: e.target.value.trim() }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* 数据源模式选择 */}
          <Card>
            <CardHeader>
              <CardTitle>数据源模式 <span className="text-red-500">*</span></CardTitle>
              <CardDescription>选择当前使用的数据源模式</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <label 
                  className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                    config.dataSourceMode === 'new' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setConfig(prev => ({ ...prev, dataSourceMode: 'new' }))}
                >
                  <input
                    type="radio"
                    name="dataSourceMode"
                    checked={config.dataSourceMode === 'new'}
                    onChange={() => setConfig(prev => ({ ...prev, dataSourceMode: 'new' }))}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">需求表模式</div>
                    <div className="text-sm text-slate-500">人员表 + 需求表1 + 需求表2 + 排期表</div>
                  </div>
                </label>
                <label 
                  className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                    config.dataSourceMode === 'legacy' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setConfig(prev => ({ ...prev, dataSourceMode: 'legacy' }))}
                >
                  <input
                    type="radio"
                    name="dataSourceMode"
                    checked={config.dataSourceMode === 'legacy'}
                    onChange={() => setConfig(prev => ({ ...prev, dataSourceMode: 'legacy' }))}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">传统模式</div>
                    <div className="text-sm text-slate-500">人员表 + 项目表 + 任务表 + 排期表</div>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 需求表模式配置 */}
          <Card className={`border-2 ${config.dataSourceMode === 'new' ? 'border-blue-500' : 'border-gray-200'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                需求表模式配置
                {config.dataSourceMode === 'new' && <span className="text-sm font-normal text-blue-600">（当前使用）</span>}
              </CardTitle>
              <CardDescription>独立的多维表应用，包含人员表和需求表</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-appToken">
                  App Token（多维表应用） {config.dataSourceMode === 'new' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="new-appToken"
                  placeholder="bascxxxxxxxxxxxx"
                  value={config.newMode.appToken}
                  onChange={(e) => updateNewMode('appToken', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-resources">
                  人员表 Table ID {config.dataSourceMode === 'new' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="new-resources"
                  placeholder="tblxxxxxxxx"
                  value={config.newMode.tableIds.resources}
                  onChange={(e) => updateNewMode('resources', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-requirements1">
                  需求表1 Table ID {config.dataSourceMode === 'new' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="new-requirements1"
                  placeholder="tblxxxxxxxx"
                  value={config.newMode.tableIds.requirements1}
                  onChange={(e) => updateNewMode('requirements1', e.target.value)}
                />
                <p className="text-xs text-slate-500">包含客户名称、需求项目、工时等信息</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-requirements2">需求表2 Table ID</Label>
                <Input
                  id="new-requirements2"
                  placeholder="tblxxxxxxxx（可选）"
                  value={config.newMode.tableIds.requirements2}
                  onChange={(e) => updateNewMode('requirements2', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-requirements2-view">矩阵日历视图 ID（可选）</Label>
                <Input
                  id="new-requirements2-view"
                  placeholder="vewxxxxxxxx（用于矩阵日历筛选）"
                  value={config.newMode.viewIds?.requirements2Matrix || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    newMode: {
                      ...prev.newMode,
                      viewIds: {
                        ...prev.newMode.viewIds,
                        requirements2Matrix: e.target.value
                      }
                    }
                  }))}
                />
                <p className="text-xs text-slate-500">
                  设置后，矩阵日历将只显示此视图筛选后的数据
                </p>
              </div>

              {/* 需求表加载选项 */}
              <div className="space-y-2">
                <Label>数据加载选项</Label>
                <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="requirementsLoadMode"
                      checked={config.requirementsLoadMode === 'all'}
                      onChange={() => setConfig(prev => ({ ...prev, requirementsLoadMode: 'all' }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">全部加载</span>
                    <span className="text-xs text-slate-500">（需求表1 + 需求表2）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="requirementsLoadMode"
                      checked={config.requirementsLoadMode === 'requirements1'}
                      onChange={() => setConfig(prev => ({ ...prev, requirementsLoadMode: 'requirements1' }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">仅加载需求表1</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="requirementsLoadMode"
                      checked={config.requirementsLoadMode === 'requirements2'}
                      onChange={() => setConfig(prev => ({ ...prev, requirementsLoadMode: 'requirements2' }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">仅加载需求表2</span>
                  </label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-schedules">排期表 Table ID</Label>
                <Input
                  id="new-schedules"
                  placeholder="tblxxxxxxxx（可选）"
                  value={config.newMode.tableIds.schedules}
                  onChange={(e) => updateNewMode('schedules', e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                onClick={() => handleTestConnection('new')}
                disabled={isTestingConnection || !config.appId || !config.appSecret || !config.newMode.appToken}
                className="w-full"
              >
                {isTestingConnection && testMode === 'new' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    测试连接中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    测试连接
                  </>
                )}
              </Button>
              {connectionStatus.new === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-50 rounded">
                  <CheckCircle2 className="h-4 w-4" />
                  连接成功！
                </div>
              )}
              {connectionStatus.new === 'failed' && (
                <div className="flex flex-col gap-1 text-sm text-red-600 p-2 bg-red-50 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>连接失败：{connectionError.new}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 传统模式配置 */}
          <Card className={`border-2 ${config.dataSourceMode === 'legacy' ? 'border-green-500' : 'border-gray-200'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                传统模式配置
                {config.dataSourceMode === 'legacy' && <span className="text-sm font-normal text-green-600">（当前使用）</span>}
              </CardTitle>
              <CardDescription>独立的多维表应用，包含人员表、项目表和任务表</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legacy-appToken">
                  App Token（多维表应用） {config.dataSourceMode === 'legacy' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="legacy-appToken"
                  placeholder="bascxxxxxxxxxxxx"
                  value={config.legacyMode.appToken}
                  onChange={(e) => updateLegacyMode('appToken', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="legacy-resources">
                  人员表 Table ID {config.dataSourceMode === 'legacy' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="legacy-resources"
                  placeholder="tblxxxxxxxx"
                  value={config.legacyMode.tableIds.resources}
                  onChange={(e) => updateLegacyMode('resources', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="legacy-projects">
                  项目表 Table ID {config.dataSourceMode === 'legacy' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="legacy-projects"
                  placeholder="tblxxxxxxxx"
                  value={config.legacyMode.tableIds.projects}
                  onChange={(e) => updateLegacyMode('projects', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="legacy-tasks">
                  任务表 Table ID {config.dataSourceMode === 'legacy' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="legacy-tasks"
                  placeholder="tblxxxxxxxx"
                  value={config.legacyMode.tableIds.tasks}
                  onChange={(e) => updateLegacyMode('tasks', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="legacy-schedules">排期表 Table ID</Label>
                <Input
                  id="legacy-schedules"
                  placeholder="tblxxxxxxxx（可选）"
                  value={config.legacyMode.tableIds.schedules}
                  onChange={(e) => updateLegacyMode('schedules', e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                onClick={() => handleTestConnection('legacy')}
                disabled={isTestingConnection || !config.appId || !config.appSecret || !config.legacyMode.appToken}
                className="w-full"
              >
                {isTestingConnection && testMode === 'legacy' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    测试连接中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    测试连接
                  </>
                )}
              </Button>
              {connectionStatus.legacy === 'success' && (
                <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-50 rounded">
                  <CheckCircle2 className="h-4 w-4" />
                  连接成功！
                </div>
              )}
              {connectionStatus.legacy === 'failed' && (
                <div className="flex flex-col gap-1 text-sm text-red-600 p-2 bg-red-50 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>连接失败：{connectionError.legacy}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="destructive" onClick={handleReset}>
            重置配置
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { FeishuConfig };
