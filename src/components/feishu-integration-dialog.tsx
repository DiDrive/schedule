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
  const [connectionError, setConnectionError] = useState<string>('');

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
    setConnectionStatus('unknown');
    setConnectionError('');
  }, [open]);

  // 更新字段并自动去除空格
  const updateField = (field: keyof FeishuConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value.trim() }));
  };

  const updateTableId = (field: keyof FeishuConfig['tableIds'], value: string) => {
    setConfig(prev => ({
      ...prev,
      tableIds: { ...prev.tableIds, [field]: value.trim() }
    }));
  };

  const handleSave = () => {
    // 验证必填字段
    if (!config.appId || !config.appSecret || !config.appToken) {
      alert('请填写 App ID、App Secret 和 App Token');
      return;
    }
    
    if (!config.tableIds.resources) {
      alert('请填写人员表 Table ID');
      return;
    }
    
    if (config.dataSourceMode === 'new') {
      if (!config.tableIds.requirements1) {
        alert('请填写需求表1 Table ID');
        return;
      }
    } else {
      if (!config.tableIds.projects || !config.tableIds.tasks) {
        alert('请填写项目表和任务表 Table ID');
        return;
      }
    }
    
    localStorage.setItem('feishu-config', JSON.stringify(config));
    console.log('[Feishu Config] 保存配置:', config);
    onSave?.(config);
    
    const modeText = config.dataSourceMode === 'new' ? '需求表模式' : '传统模式';
    let tableInfo = `人员表: ${config.tableIds.resources}\n`;
    
    if (config.dataSourceMode === 'new') {
      tableInfo += `需求表1: ${config.tableIds.requirements1}\n`;
      tableInfo += `需求表2: ${config.tableIds.requirements2 || '未填写'}\n`;
      tableInfo += `排期表: ${config.tableIds.schedules || '未填写'}`;
    } else {
      tableInfo += `项目表: ${config.tableIds.projects}\n`;
      tableInfo += `任务表: ${config.tableIds.tasks}\n`;
      tableInfo += `排期表: ${config.tableIds.schedules || '未填写'}`;
    }
    
    alert(`配置已保存！\n\n数据源模式: ${modeText}\n${tableInfo}`);
    onOpenChange(false);
  };

  const handleTestConnection = async () => {
    if (!config.appId || !config.appSecret || !config.appToken) {
      setConnectionStatus('failed');
      setConnectionError('请先填写 App ID、App Secret 和 App Token');
      return;
    }
    
    setIsTestingConnection(true);
    setConnectionError('');
    
    try {
      const response = await fetch('/api/feishu/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId.trim(),
          appSecret: config.appSecret.trim(),
          appToken: config.appToken.trim(),
        }),
      });
      const result = await response.json();
      
      if (result.success) {
        setConnectionStatus('success');
        setConnectionError('');
      } else {
        setConnectionStatus('failed');
        setConnectionError(result.error || '连接失败');
      }
    } catch (error) {
      setConnectionStatus('failed');
      setConnectionError(error instanceof Error ? error.message : '网络错误');
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
    setConnectionError('');
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
                <Label htmlFor="appId">App ID <span className="text-red-500">*</span></Label>
                <Input
                  id="appId"
                  placeholder="cli_xxxxxxxxx"
                  value={config.appId}
                  onChange={(e) => updateField('appId', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appSecret">App Secret <span className="text-red-500">*</span></Label>
                <Input
                  id="appSecret"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={config.appSecret}
                  onChange={(e) => updateField('appSecret', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appToken">App Token (多维表应用 Token) <span className="text-red-500">*</span></Label>
                <Input
                  id="appToken"
                  placeholder="bascxxxxxxxxxxxx"
                  value={config.appToken}
                  onChange={(e) => updateField('appToken', e.target.value)}
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
                <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-50 rounded">
                  <CheckCircle2 className="h-4 w-4" />
                  连接成功！
                </div>
              )}
              {connectionStatus === 'failed' && (
                <div className="flex items-center gap-2 text-sm text-red-600 p-2 bg-red-50 rounded">
                  <AlertCircle className="h-4 w-4" />
                  连接失败：{connectionError}
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
                    <div className="text-sm text-slate-500">人员表 + 需求表 + 排期表（推荐）</div>
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
                    <div className="text-sm text-slate-500">人员表 + 项目表 + 任务表 + 排期表</div>
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
                请填写多维表中各表格的 Table ID（注意不要有多余空格）
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
                  onChange={(e) => updateTableId('resources', e.target.value)}
                />
              </div>

              {/* 需求表模式 */}
              {config.dataSourceMode === 'new' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-slate-500 mb-3">需求表配置：</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="table-requirements1">
                      需求表1 Table ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="table-requirements1"
                      placeholder="tblxxxxxxxx"
                      value={config.tableIds.requirements1}
                      onChange={(e) => updateTableId('requirements1', e.target.value)}
                    />
                    <p className="text-xs text-slate-500">第一个需求表，包含客户名称、需求项目、工时等信息</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="table-requirements2">
                      需求表2 Table ID
                    </Label>
                    <Input
                      id="table-requirements2"
                      placeholder="tblxxxxxxxx（可选）"
                      value={config.tableIds.requirements2}
                      onChange={(e) => updateTableId('requirements2', e.target.value)}
                    />
                    <p className="text-xs text-slate-500">第二个需求表（可选，后续可能有更多）</p>
                  </div>
                </>
              )}

              {/* 传统模式 */}
              {config.dataSourceMode === 'legacy' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-slate-500 mb-3">项目与任务表配置：</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="table-projects">
                      项目表 Table ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="table-projects"
                      placeholder="tblxxxxxxxx"
                      value={config.tableIds.projects}
                      onChange={(e) => updateTableId('projects', e.target.value)}
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
                      onChange={(e) => updateTableId('tasks', e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* 排期表 - 两种模式都需要 */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-slate-500 mb-3">排期结果表配置：</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-schedules">
                  排期表 Table ID
                </Label>
                <Input
                  id="table-schedules"
                  placeholder="tblxxxxxxxx（可选，用于同步排期结果）"
                  value={config.tableIds.schedules}
                  onChange={(e) => updateTableId('schedules', e.target.value)}
                />
                <p className="text-xs text-slate-500">排期结果将同步到此表（可选）</p>
              </div>
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
