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
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Settings, Globe } from 'lucide-react';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableIds: {
    resources: string;
    projects: string;
    tasks: string;
    schedules: string;
  };
  enableAutoSync: boolean;
  autoSyncInterval: number; // 分钟
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
    },
    enableAutoSync: true,
    autoSyncInterval: 5,
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: null,
    lastSyncStatus: 'success',
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failed'>('unknown');
  const [isSyncing, setIsSyncing] = useState(false);

  // 从 localStorage 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('feishu-config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
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
  }, []);

  const handleSave = () => {
    localStorage.setItem('feishu-config', JSON.stringify(config));
    onSave?.(config);
    onOpenChange(false);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      // 这里调用测试连接的 API
      // const response = await fetch('/api/feishu/test-connection', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     appId: config.appId,
      //     appSecret: config.appSecret,
      //     appToken: config.appToken,
      //   }),
      // });

      // 模拟测试连接
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (config.appId && config.appSecret && config.appToken) {
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
            配置飞书应用信息，实现数据双向同步。系统与飞书多维表的数据将自动保持一致。
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

              <Card>
                <CardHeader>
                  <CardTitle>所需权限</CardTitle>
                  <CardDescription>
                    请在飞书开放平台为应用配置以下权限
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                    <span className="text-sm">多维表操作</span>
                    <Badge variant="secondary">bitable:app</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                    <span className="text-sm">用户信息</span>
                    <Badge variant="secondary">contact:user.base:readonly</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                    <span className="text-sm">发送消息</span>
                    <Badge variant="secondary">im:message</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tables" className="space-y-4 mt-0">
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

              <Card>
                <CardHeader>
                  <CardTitle>表格结构说明</CardTitle>
                  <CardDescription>
                    请严格按照文档要求创建表格字段
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
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
                  <a
                    href="/docs/feishu-table-design.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mt-2 block"
                  >
                    查看详细表格结构文档 →
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
                  <Button
                    variant="outline"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        同步中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        立即同步
                      </>
                    )}
                  </Button>
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

        <DialogFooter>
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
