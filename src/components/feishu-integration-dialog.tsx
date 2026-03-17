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
import { AlertCircle, CheckCircle2, RefreshCw, Globe } from 'lucide-react';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableIds: {
    resources: string;
    projects: string;
    tasks: string;
    schedules: string;
    requirements1: string;
    requirements2: string;
  };
  enableAutoSync: boolean;
  autoSyncInterval: number;
  dataSourceMode: 'legacy' | 'new';
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
    dataSourceMode: 'new',
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failed'>('unknown');

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
  }, [open]);

  const handleSave = () => {
    localStorage.setItem('feishu-config', JSON.stringify(config));
    console.log('[Feishu Config] 保存配置:', config);
    onSave?.(config);
    
    const modeText = config.dataSourceMode === 'new' ? '需求表模式' : '传统模式';
    const tableInfo = config.dataSourceMode === 'new' 
      ? `人员表: ${config.tableIds.resources || '未填写'}\n需求表1: ${config.tableIds.requirements1 || '未填写'}`
      : `人员表: ${config.tableIds.resources || '未填写'}\n项目表: ${config.tableIds.projects || '未填写'}\n任务表: ${config.tableIds.tasks || '未填写'}`;
    
    alert(`配置已保存！\n\n数据源模式: ${modeText}\n${tableInfo}`);
    onOpenChange(false);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
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
      setConnectionStatus(result.success ? 'success' : 'failed');
    } catch (error) {
      setConnectionStatus('failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleReset = () => {
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
    setConnectionStatus('unknown');
    alert('配置已重置！');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            飞书集成配置
          </DialogTitle>
          <DialogDescription>
            配置飞书应用信息，从飞书多维表加载数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 飞书应用信息 */}
          <Card>
            <CardHeader>
              <CardTitle>飞书应用信息</CardTitle>
              <CardDescription>
                请在飞书开放平台创建企业自建应用
                <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
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
                  placeholder="••••••••••••••••"
                  value={config.appSecret}
                  onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appToken">App Token (多维表应用 Token)</Label>
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
                disabled={isTestingConnection || !config.appId || !config.appSecret}
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

          {/* 数据源模式选择 */}
          <Card>
            <CardHeader>
              <CardTitle>数据源模式</CardTitle>
              <CardDescription>选择使用的数据表结构</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <label 
                  className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                    config.dataSourceMode === 'new' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setConfig({ ...config, dataSourceMode: 'new' })}
                >
                  <input
                    type="radio"
                    name="dataSourceMode"
                    checked={config.dataSourceMode === 'new'}
                    onChange={() => setConfig({ ...config, dataSourceMode: 'new' })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">需求表模式</div>
                    <div className="text-sm text-slate-500">使用需求表，包含项目和任务信息（推荐）</div>
                  </div>
                </label>
                <label 
                  className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors ${
                    config.dataSourceMode === 'legacy' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setConfig({ ...config, dataSourceMode: 'legacy' })}
                >
                  <input
                    type="radio"
                    name="dataSourceMode"
                    checked={config.dataSourceMode === 'legacy'}
                    onChange={() => setConfig({ ...config, dataSourceMode: 'legacy' })}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">传统模式</div>
                    <div className="text-sm text-slate-500">使用人员表+项目表+任务表三张表</div>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 表格 ID 配置 */}
          <Card>
            <CardHeader>
              <CardTitle>表格 ID 配置</CardTitle>
              <CardDescription>
                请填写多维表中各表格的 Table ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 人员表 - 两种模式都需要 */}
              <div className="space-y-2">
                <Label htmlFor="table-resources">
                  人员表 Table ID <span className="text-red-500">*</span>
                </Label>
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

              {/* 需求表模式 */}
              {config.dataSourceMode === 'new' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="table-requirements1">
                      需求表 Table ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="table-requirements1"
                      placeholder="tblxxxxxxxx"
                      value={config.tableIds.requirements1}
                      onChange={(e) => setConfig({
                        ...config,
                        tableIds: { ...config.tableIds, requirements1: e.target.value }
                      })}
                    />
                    <p className="text-xs text-slate-500">包含客户名称、需求项目、平面/后期工时等信息的需求表</p>
                  </div>
                </>
              )}

              {/* 传统模式 */}
              {config.dataSourceMode === 'legacy' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="table-projects">
                      项目表 Table ID <span className="text-red-500">*</span>
                    </Label>
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
                    <Label htmlFor="table-tasks">
                      任务表 Table ID <span className="text-red-500">*</span>
                    </Label>
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
                </>
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
