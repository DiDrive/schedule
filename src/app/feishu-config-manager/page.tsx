'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FeishuConfigManagerPage() {
  const [config, setConfig] = useState<any>(null);
  const [lastModified, setLastModified] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const loadConfig = () => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      const parsed = JSON.parse(configStr);
      setConfig(parsed);
      setLastModified(new Date().toLocaleString('zh-CN'));
    } else {
      setConfig(null);
      setMessage('未找到飞书配置');
      setMessageType('error');
    }
  };

  const clearConfig = () => {
    if (confirm('确定要清除所有飞书配置吗？')) {
      localStorage.removeItem('feishu-config');
      localStorage.removeItem('feishu-sync-status');
      setConfig(null);
      setMessage('配置已清除');
      setMessageType('success');
    }
  };

  const updateConfig = () => {
    if (!config) return;

    const newAppToken = prompt('请输入正确的 App Token：');
    if (newAppToken) {
      config.appToken = newAppToken;
      localStorage.setItem('feishu-config', JSON.stringify(config));
      loadConfig();
      setMessage('App Token 已更新');
      setMessageType('success');
    }
  };

  const updateTableId = (tableKey: string, tableName: string) => {
    if (!config) return;

    const newTableId = prompt(`请输入 ${tableName} 的 Table ID：`, config.tableIds?.[tableKey] || '');
    if (newTableId) {
      if (!config.tableIds) config.tableIds = {};
      config.tableIds[tableKey] = newTableId;
      localStorage.setItem('feishu-config', JSON.stringify(config));
      loadConfig();
      setMessage(`${tableName} Table ID 已更新`);
      setMessageType('success');
    }
  };

  const updateAllTableIds = () => {
    if (!config) return;

    const newTableIds: any = {};

    const resourcesId = prompt('请输入人员表的 Table ID：', config.tableIds?.resources || '');
    if (resourcesId) newTableIds.resources = resourcesId;

    const projectsId = prompt('请输入项目表的 Table ID：', config.tableIds?.projects || '');
    if (projectsId) newTableIds.projects = projectsId;

    const tasksId = prompt('请输入任务表的 Table ID：', config.tableIds?.tasks || '');
    if (tasksId) newTableIds.tasks = tasksId;

    const schedulesId = prompt('请输入排期表的 Table ID：', config.tableIds?.schedules || '');
    if (schedulesId) newTableIds.schedules = schedulesId;

    if (Object.keys(newTableIds).length > 0) {
      config.tableIds = { ...config.tableIds, ...newTableIds };
      localStorage.setItem('feishu-config', JSON.stringify(config));
      loadConfig();
      setMessage('Table IDs 已更新');
      setMessageType('success');
    }
  };

  const copyConfig = () => {
    if (config) {
      navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setMessage('配置已复制到剪贴板');
      setMessageType('success');
    }
  };

  const validateConfig = () => {
    if (!config) {
      setMessage('未找到配置');
      setMessageType('error');
      return;
    }

    const issues: string[] = [];

    if (!config.appId) issues.push('缺少 App ID');
    if (!config.appSecret) issues.push('缺少 App Secret');
    if (!config.appToken) issues.push('缺少 App Token');
    if (!config.tableIds) issues.push('缺少 Table IDs');
    else {
      if (!config.tableIds.resources) issues.push('缺少人员表 Table ID');
      if (!config.tableIds.projects) issues.push('缺少项目表 Table ID');
      if (!config.tableIds.tasks) issues.push('缺少任务表 Table ID');
      if (!config.tableIds.schedules) issues.push('缺少排期表 Table ID');
    }

    if (issues.length > 0) {
      setMessage(`配置不完整：${issues.join(', ')}`);
      setMessageType('error');
    } else {
      setMessage('配置完整，可以继续');
      setMessageType('success');
    }
  };

  const refreshTests = () => {
    // 清除可能的缓存
    sessionStorage.clear();
    loadConfig();
    setMessage('已刷新，请重新测试');
    setMessageType('success');
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书配置管理
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            查看、验证和更新飞书配置
          </p>
        </div>

        {/* 操作按钮 */}
        <Card>
          <CardHeader>
            <CardTitle>操作</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={loadConfig} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新加载配置
            </Button>
            <Button onClick={validateConfig} variant="outline">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              验证配置
            </Button>
            <Button onClick={refreshTests} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              清除缓存并刷新
            </Button>
            <Button onClick={updateConfig} variant="outline">
              更新 App Token
            </Button>
            <Button onClick={copyConfig} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              复制配置
            </Button>
            <Button onClick={clearConfig} variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              清除配置
            </Button>
          </CardContent>
        </Card>

        {/* 消息提示 */}
        {message && (
          <Alert variant={messageType === 'error' ? 'destructive' : 'default'}>
            {messageType === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>{messageType === 'success' ? '提示' : '错误'}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* 配置详情 */}
        {config && (
          <Card>
            <CardHeader>
              <CardTitle>配置详情</CardTitle>
              <CardDescription>
                最后更新：{lastModified}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-3">
                <h3 className="font-medium">飞书应用信息</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">App ID</p>
                    <code className="text-sm">{config.appId?.substring(0, 12)}...</code>
                  </div>
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">App Secret</p>
                    <code className="text-sm">{config.appSecret?.substring(0, 8)}...</code>
                  </div>
                </div>
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">App Token</p>
                  <code className="text-sm font-medium">{config.appToken}</code>
                </div>
              </div>

              {/* Table IDs */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">表格 ID 配置</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={updateAllTableIds}
                  >
                    批量更新
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">人员表</p>
                      <code className="text-sm">{config.tableIds?.resources || '未配置'}</code>
                    </div>
                    <div className="flex gap-2 items-center">
                      {config.tableIds?.resources && <Badge variant="secondary">已配置</Badge>}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateTableId('resources', '人员表')}
                      >
                        编辑
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">项目表</p>
                      <code className="text-sm">{config.tableIds?.projects || '未配置'}</code>
                    </div>
                    <div className="flex gap-2 items-center">
                      {config.tableIds?.projects && <Badge variant="secondary">已配置</Badge>}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateTableId('projects', '项目表')}
                      >
                        编辑
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">任务表</p>
                      <code className="text-sm">{config.tableIds?.tasks || '未配置'}</code>
                    </div>
                    <div className="flex gap-2 items-center">
                      {config.tableIds?.tasks && <Badge variant="secondary">已配置</Badge>}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateTableId('tasks', '任务表')}
                      >
                        编辑
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">排期表</p>
                      <code className="text-sm">{config.tableIds?.schedules || '未配置'}</code>
                    </div>
                    <div className="flex gap-2 items-center">
                      {config.tableIds?.schedules && <Badge variant="secondary">已配置</Badge>}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateTableId('schedules', '排期表')}
                      >
                        编辑
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 其他配置 */}
              <div className="space-y-3">
                <h3 className="font-medium">其他配置</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">自动同步</p>
                    <Badge variant={config.enableAutoSync ? 'default' : 'secondary'}>
                      {config.enableAutoSync ? '启用' : '禁用'}
                    </Badge>
                  </div>
                  <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">同步间隔</p>
                    <Badge variant="secondary">{config.autoSyncInterval} 分钟</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!config && (
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertTitle>未找到配置</AlertTitle>
            <AlertDescription>
              请先在飞书集成对话框中配置飞书信息
            </AlertDescription>
          </Alert>
        )}

        {/* 快速链接 */}
        <Card>
          <CardHeader>
            <CardTitle>快速链接</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/?tab=feishu'}>
              飞书集成配置
            </Button>
            <Button variant="outline" onClick={() => window.open('/feishu-batch-test', '_blank')}>
              批量测试
            </Button>
            <Button variant="outline" onClick={() => window.open('/feishu-quick-config', '_blank')}>
              快速配置
            </Button>
            <Button variant="outline" onClick={() => window.open('/feishu-diagnostic', '_blank')}>
              诊断工具
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
