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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, RefreshCw, Settings, Globe } from 'lucide-react';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableIds: {
    resources: string;
    projects: string;
    tasks: string;
    schedules: string;
    // 新增：两个需求表ID（用于新的多维表结构）
    requirements1: string; // 需求表1
    requirements2: string; // 需求表2
  };
  enableAutoSync: boolean;
  autoSyncInterval: number; // 分钟
  // 数据源模式：'legacy'（旧的三表结构）或 'new'（新的需求表结构）
  dataSourceMode: 'legacy' | 'new';
}

interface SyncStatus {
  lastSyncTime: Date | null;
  lastSyncStatus: 'success' | 'failed' | 'syncing';
  lastSyncError?: string;
}

interface FeishuIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (config: FeishuConfig) => void;
  onSync?: () => Promise<void>;
}

export default function FeishuIntegrationDialog({
  open,
  onOpenChange,
  onSave,
  onSync,
}: FeishuIntegrationDialogProps) {
  const [config, setConfig] = useState<FeishuConfig>({
    appId: '',
    appSecret: '',
    appToken: '',
    tableIds: {
      resources: '',
      projects: '',
      tasks: '',
      schedules: '',
      requirements1: '',
      requirements2: '',
    },
    enableAutoSync: true,
    autoSyncInterval: 5,
    dataSourceMode: 'new', // 默认使用新的需求表结构
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: null,
    lastSyncStatus: 'success',
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failed'>('unknown');
  const [isSyncing, setIsSyncing] = useState(false);

  // 从 localStorage 加载配置（只在组件初始化时加载一次）
  useEffect(() => {
    const savedConfig = localStorage.getItem('feishu-config');
    console.log('[Feishu Dialog] 初始化，加载配置:', savedConfig);
    
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        console.log('[Feishu Dialog] 解析后的配置:', parsed);
        // 确保所有字段都有默认值，避免 undefined 导致的 controlled/uncontrolled 警告
        setConfig({
          appId: parsed.appId || '',
          appSecret: parsed.appSecret || '',
          appToken: parsed.appToken || '',
          tableIds: {
            resources: parsed.tableIds?.resources || '',
            projects: parsed.tableIds?.projects || '',
            tasks: parsed.tableIds?.tasks || '',
            schedules: parsed.tableIds?.schedules || '',
            requirements1: parsed.tableIds?.requirements1 || '',
            requirements2: parsed.tableIds?.requirements2 || '',
          },
          enableAutoSync: parsed.enableAutoSync ?? true,
          autoSyncInterval: parsed.autoSyncInterval ?? 5,
          dataSourceMode: parsed.dataSourceMode || 'new',
        });
      } catch (error) {
        console.error('Failed to load Feishu config:', error);
      }
    }

    const savedSyncStatus = localStorage.getItem('feishu-sync-status');
    if (savedSyncStatus) {
      try {
        const status = JSON.parse(savedSyncStatus);
        setSyncStatus({
          ...status,
          lastSyncTime: status.lastSyncTime ? new Date(status.lastSyncTime) : null,
        });
      } catch (error) {
        console.error('Failed to load sync status:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    localStorage.setItem('feishu-config', JSON.stringify(config));
    console.log('[Feishu Config] 保存配置:', config);
    onSave?.(config);
    alert(`配置已保存！\n\n数据源模式: ${config.dataSourceMode === 'new' ? '需求表模式' : '传统模式'}\n人员表: ${config.tableIds.resources || '未填写'}\n${config.dataSourceMode === 'new' ? `需求表1: ${config.tableIds.requirements1 || '未填写'}\n需求表2: ${config.tableIds.requirements2 || '未填写'}` : `项目表: ${config.tableIds.projects || '未填写'}\n任务表: ${config.tableIds.tasks || '未填写'}`}`);
    onOpenChange(false);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      // 这里调用测试连接的 API
      const response = await fetch('/api/feishu/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          appSecret: config.appSecret,
          appToken: config.appToken,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('failed');
      }
    } catch (error) {
      setConnectionStatus('failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus({ ...syncStatus, lastSyncStatus: 'syncing' });

    try {
      await onSync?.();
      setSyncStatus({
        lastSyncTime: new Date(),
        lastSyncStatus: 'success',
      });
      localStorage.setItem('feishu-sync-status', JSON.stringify({
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'success',
      }));
    } catch (error) {
      setSyncStatus({
        lastSyncTime: new Date(),
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : '同步失败',
      });
      localStorage.setItem('feishu-sync-status', JSON.stringify({
        lastSyncTime: new Date().toISOString(),
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : '同步失败',
      }));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            飞书集成配置
          </DialogTitle>
          <DialogDescription>
            配置飞书应用信息，从飞书多维表加载项目数据，并将排期结果同步回飞书。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">应用配置</TabsTrigger>
            <TabsTrigger value="tables">表格配置</TabsTrigger>
            <TabsTrigger value="sync">同步设置</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent value="config" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>飞书应用信息</CardTitle>
                  <CardDescription>
                    请在飞书开放平台创建企业自建应用，获取应用信息。
                    <a
                      href="https://open.feishu.cn/app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline ml-1"
                    >
                      前往创建 →
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="appId">App ID</Label>
                    <Input
                      id="appId"
                      placeholder="cli_xxxxxxxxx"
                      value={config.appId}
                      onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appSecret">App Secret</Label>
                    <Input
                      id="appSecret"
                      type="password"
                      placeholder="xxxxxxxxxxxx"
                      value={config.appSecret}
                      onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appToken">App Token（多维表应用 Token）</Label>
                    <Input
                      id="appToken"
                      placeholder="bascxxxxxxxxxxxx"
                      value={config.appToken}
                      onChange={(e) => setConfig({ ...config, appToken: e.target.value })}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => window.open('/feishu-app-token-guide', '_blank')}
                        className="px-0 h-auto text-sm text-blue-600"
                      >
                        不知道 App Token？点击这里获取帮助 →
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => window.open('/feishu-create-base-guide', '_blank')}
                        className="px-0 h-auto text-sm text-blue-600"
                      >
                        创建新多维表 →
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="w-full"
                  >
                    {isTestingConnection ? (
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
                  {connectionStatus === 'success' && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      连接成功
                    </div>
                  )}
                  {connectionStatus === 'failed' && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      连接失败，请检查配置信息
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 数据源模式选择 - 放在应用配置页 */}
              <Card>
                <CardHeader>
                  <CardTitle>数据源模式</CardTitle>
                  <CardDescription>
                    选择使用的数据表结构
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded border hover:bg-slate-50">
                      <input
                        type="radio"
                        name="dataSourceMode"
                        checked={config.dataSourceMode === 'new'}
                        onChange={() => setConfig({ ...config, dataSourceMode: 'new' })}
                        className="w-4 h-4"
                      />
                      <div>
                        <span className="font-medium">需求表模式</span>
                        <span className="text-sm text-slate-500 ml-2">（两个需求表，包含项目和任务信息）</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded border hover:bg-slate-50">
                      <input
                        type="radio"
                        name="dataSourceMode"
                        checked={config.dataSourceMode === 'legacy'}
                        onChange={() => setConfig({ ...config, dataSourceMode: 'legacy' })}
                        className="w-4 h-4"
                      />
                      <div>
                        <span className="font-medium">传统模式</span>
                        <span className="text-sm text-slate-500 ml-2">（人员表+项目表+任务表）</span>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* 表格 ID 配置 - 根据模式动态显示 */}
              {config.dataSourceMode === 'new' && (
                <Card>
                  <CardHeader>
                    <CardTitle>需求表 ID 配置</CardTitle>
                    <CardDescription>
                      请填写需求表的 Table ID
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="table-resources-app">人员表 Table ID <span className="text-red-500">*</span></Label>
                      <Input
                        id="table-resources-app"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.resources}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, resources: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-requirements1-app">需求表1 Table ID <span className="text-red-500">*</span></Label>
                      <Input
                        id="table-requirements1-app"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.requirements1}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, requirements1: e.target.value }
                        })}
                      />
                      <p className="text-xs text-slate-500">第一个项目的需求表</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-requirements2-app">需求表2 Table ID</Label>
                      <Input
                        id="table-requirements2-app"
                        placeholder="tblxxxxxxxx（可选）"
                        value={config.tableIds.requirements2}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, requirements2: e.target.value }
                        })}
                      />
                      <p className="text-xs text-slate-500">第二个项目的需求表（可选）</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {config.dataSourceMode === 'legacy' && (
                <Card>
                  <CardHeader>
                    <CardTitle>表格 ID 配置</CardTitle>
                    <CardDescription>
                      请填写传统模式所需的表格 ID
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="table-resources-legacy">人员表 Table ID <span className="text-red-500">*</span></Label>
                      <Input
                        id="table-resources-legacy"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.resources}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, resources: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-projects-legacy">项目表 Table ID <span className="text-red-500">*</span></Label>
                      <Input
                        id="table-projects-legacy"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.projects}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, projects: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-tasks-legacy">任务表 Table ID <span className="text-red-500">*</span></Label>
                      <Input
                        id="table-tasks-legacy"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.tasks}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, tasks: e.target.value }
                        })}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="tables" className="space-y-4 mt-0">
              {/* 数据源模式选择 */}
              <Card>
                <CardHeader>
                  <CardTitle>数据源模式</CardTitle>
                  <CardDescription>
                    选择使用的数据表结构
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dataSourceMode"
                        checked={config.dataSourceMode === 'new'}
                        onChange={() => setConfig({ ...config, dataSourceMode: 'new' })}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">需求表模式</span>
                      <span className="text-sm text-slate-500">（两个需求表，包含项目和任务信息）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dataSourceMode"
                        checked={config.dataSourceMode === 'legacy'}
                        onChange={() => setConfig({ ...config, dataSourceMode: 'legacy' })}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">传统模式</span>
                      <span className="text-sm text-slate-500">（人员表+项目表+任务表）</span>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* 需求表模式配置 */}
              {config.dataSourceMode === 'new' && (
                <Card>
                  <CardHeader>
                    <CardTitle>需求表 ID 配置</CardTitle>
                    <CardDescription>
                      请填写需求表的 Table ID。两个需求表分别对应不同的项目。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="table-resources">人员表 Table ID</Label>
                      <Input
                        id="table-resources"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.resources}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, resources: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-requirements1">需求表1 Table ID</Label>
                      <Input
                        id="table-requirements1"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.requirements1}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, requirements1: e.target.value }
                        })}
                      />
                      <p className="text-xs text-slate-500">第一个项目的需求表</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-requirements2">需求表2 Table ID</Label>
                      <Input
                        id="table-requirements2"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.requirements2}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, requirements2: e.target.value }
                        })}
                      />
                      <p className="text-xs text-slate-500">第二个项目的需求表</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-schedules">排期表 Table ID</Label>
                      <Input
                        id="table-schedules"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.schedules}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, schedules: e.target.value }
                        })}
                      />
                      <p className="text-xs text-slate-500">排期结果同步到此表</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 传统模式配置 */}
              {config.dataSourceMode === 'legacy' && (
                <Card>
                  <CardHeader>
                    <CardTitle>表格 ID 配置</CardTitle>
                    <CardDescription>
                      请在飞书多维表中创建以下表格，并获取对应的 Table ID。
                      <a
                        href="https://www.feishu.cn/hc/zh-CN/articles/360024984973"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                      >
                        如何获取 Table ID →
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="table-resources">人员表 Table ID</Label>
                      <Input
                        id="table-resources"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.resources}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, resources: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-projects">项目表 Table ID</Label>
                      <Input
                        id="table-projects"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.projects}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, projects: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-tasks">任务表 Table ID</Label>
                      <Input
                        id="table-tasks"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.tasks}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, tasks: e.target.value }
                        })}
                      />
                      {!config.tableIds.resources && config.tableIds.tasks && (
                        <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-amber-700 dark:text-amber-400">
                            要同步任务表中的"负责人"字段，必须同时填写人员表Table ID
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table-schedules">排期表 Table ID</Label>
                      <Input
                        id="table-schedules"
                        placeholder="tblxxxxxxxx"
                        value={config.tableIds.schedules}
                        onChange={(e) => setConfig({
                          ...config,
                          tableIds: { ...config.tableIds, schedules: e.target.value }
                        })}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>表格结构说明</CardTitle>
                  <CardDescription>
                    请严格按照文档要求创建表格字段
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {config.dataSourceMode === 'new' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">人员表</Badge>
                        <span className="text-slate-600">人员ID、姓名、工作类型、效率等</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">需求表</Badge>
                        <span className="text-slate-600">脚本名称、需求项目、平面/后期预估工时、对接人、需求日期等</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">排期表</Badge>
                        <span className="text-slate-600">任务名称、任务类型、负责人、开始/结束时间、工时、状态等</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">人员表</Badge>
                        <span className="text-slate-600">8 个字段（ID、姓名、类型、效率等）</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">项目表</Badge>
                        <span className="text-slate-600">8 个字段（ID、名称、状态、日期等）</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">任务表</Badge>
                        <span className="text-slate-600">18 个字段（ID、项目、负责人、依赖等）</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">排期表</Badge>
                        <span className="text-slate-600">12 个字段（ID、项目、工时、利用率等）</span>
                      </div>
                    </>
                  )}
                  <a
                    href="/docs/feishu-table-setup-guide.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mt-2 block"
                  >
                    查看详细创建教程 →
                  </a>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>自动同步设置</CardTitle>
                  <CardDescription>
                    配置定时自动同步，保持系统与飞书数据一致
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>启用自动同步</Label>
                      <p className="text-sm text-slate-500">
                        定时自动同步系统与飞书多维表的数据
                      </p>
                    </div>
                    <Switch
                      checked={config.enableAutoSync}
                      onCheckedChange={(checked) => setConfig({ ...config, enableAutoSync: checked })}
                    />
                  </div>
                  {config.enableAutoSync && (
                    <div className="space-y-2">
                      <Label htmlFor="sync-interval">同步间隔（分钟）</Label>
                      <Input
                        id="sync-interval"
                        type="number"
                        min="1"
                        max="60"
                        value={config.autoSyncInterval}
                        onChange={(e) => setConfig({
                          ...config,
                          autoSyncInterval: parseInt(e.target.value) || 5
                        })}
                      />
                      <p className="text-sm text-slate-500">
                        建议设置为 5-15 分钟，避免过于频繁的请求
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>同步状态</CardTitle>
                  <CardDescription>
                    查看最近的同步状态和时间
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      {syncStatus.lastSyncStatus === 'success' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {syncStatus.lastSyncStatus === 'failed' && (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      {syncStatus.lastSyncStatus === 'syncing' && (
                        <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                      )}
                      <div>
                        <p className="font-medium">
                          {syncStatus.lastSyncStatus === 'success' && '同步成功'}
                          {syncStatus.lastSyncStatus === 'failed' && '同步失败'}
                          {syncStatus.lastSyncStatus === 'syncing' && '同步中...'}
                        </p>
                        {syncStatus.lastSyncTime && (
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {syncStatus.lastSyncTime.toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {syncStatus.lastSyncError && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600">
                      {syncStatus.lastSyncError}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>冲突处理规则</CardTitle>
                  <CardDescription>
                    当两边同时修改数据时的处理策略
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20">
                    <Settings className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-700 dark:text-amber-400">
                      冲突时以飞书多维表数据为准
                    </span>
                  </div>
                  <p className="text-slate-600">
                    系统会比较版本号，当检测到冲突时（两边同时修改），会自动以飞书多维表的数据为准，覆盖系统的数据。
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="destructive" 
            onClick={() => {
              localStorage.removeItem('feishu-config');
              setConfig({
                appId: '',
                appSecret: '',
                appToken: '',
                tableIds: {
                  resources: '',
                  projects: '',
                  tasks: '',
                  schedules: '',
                  requirements1: '',
                  requirements2: '',
                },
                enableAutoSync: true,
                autoSyncInterval: 5,
                dataSourceMode: 'new',
              });
              alert('配置已重置！请重新填写配置信息。');
            }}
          >
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
