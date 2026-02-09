'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, ExternalLink, Plus, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TableTestResult {
  tableId: string;
  tableName: string;
  exists: boolean;
  belongsToApp: boolean;
  error?: string;
  rawResponse?: string;
}

export default function FeishuBatchTestPage() {
  const [config, setConfig] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<TableTestResult[]>([]);

  // 从 localStorage 加载配置
  useEffect(() => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      try {
        setConfig(JSON.parse(configStr));
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
  }, []);

  const runBatchTest = async () => {
    if (!config) {
      alert('请先配置飞书集成信息');
      return;
    }

    setIsTesting(true);
    setResults([]);

    const tableNames: { [key: string]: string } = {
      resources: '人员表',
      projects: '项目表',
      tasks: '任务表',
      schedules: '排期表',
    };

    const tables = Object.entries(tableNames).map(([key, name]) => ({
      key,
      name,
      tableId: config.tableIds[key],
    }));

    for (const table of tables) {
      try {
        const response = await fetch('/api/feishu/check-table-ownership', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appId: config.appId,
            appSecret: config.appSecret,
            appToken: config.appToken,
            tableId: table.tableId,
          }),
        });

        const data = await response.json();

        setResults(prev => [
          ...prev,
          {
            tableId: table.tableId,
            tableName: table.name,
            exists: data.success && data.data?.exists,
            belongsToApp: data.success && data.data?.exists,
            error: data.success ? undefined : data.error,
            rawResponse: data.rawResponse,
          },
        ]);
      } catch (error: any) {
        setResults(prev => [
          ...prev,
          {
            tableId: table.tableId,
            tableName: table.name,
            exists: false,
            belongsToApp: false,
            error: error.message,
          },
        ]);
      }
    }

    setIsTesting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书批量测试
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            批量测试所有配置的 Table ID
          </p>
        </div>

        {/* 配置信息 */}
        {config && (
          <Card>
            <CardHeader>
              <CardTitle>配置信息</CardTitle>
              <CardDescription>
                当前配置的 App Token 和 Table IDs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">App Token：</p>
                <code className="text-sm px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                  {config.appToken}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Table IDs：</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="font-medium">人员表：</span>
                    <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{config.tableIds.resources || '未配置'}</code>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium">项目表：</span>
                    <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{config.tableIds.projects || '未配置'}</code>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium">任务表：</span>
                    <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{config.tableIds.tasks || '未配置'}</code>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium">排期表：</span>
                    <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{config.tableIds.schedules || '未配置'}</code>
                  </div>
                </div>
              </div>
              <Button
                onClick={runBatchTest}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    开始批量测试
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 测试结果 */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>测试结果</CardTitle>
              <CardDescription>
                所有 Table ID 的测试结果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.belongsToApp
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {result.belongsToApp ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">{result.tableName}</span>
                      </div>
                      <Badge variant={result.belongsToApp ? 'secondary' : 'destructive'}>
                        {result.belongsToApp ? '有效' : '无效'}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Table ID：</span>
                        <code className="text-xs">{result.tableId}</code>
                      </div>
                      {result.error && (
                        <div className="text-red-600 dark:text-red-400">
                          错误：{result.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* 总结 */}
                {results.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>测试总结</AlertTitle>
                    <AlertDescription>
                      {results.every(r => r.belongsToApp) ? (
                        <span className="text-green-600">所有 Table ID 都有效！</span>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-red-600">
                            有 {results.filter(r => !r.belongsToApp).length} 个 Table ID 无效。
                            这意味着这些 Table ID 不属于当前的 App Token。
                          </p>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">解决方法：</p>
                            <ol className="list-decimal list-inside text-sm space-y-1 text-slate-600 dark:text-slate-400">
                              <li>在飞书多维表中复制页面链接</li>
                              <li>访问 App Token 配置指南，从链接中提取正确的 App Token</li>
                              <li>获取该 App Token 下可用的 Table IDs</li>
                              <li>更新配置中的 App Token 和 Table IDs</li>
                            </ol>
                            <div className="flex gap-2 mt-2">
                              <Button
                                onClick={() => window.open('/feishu-app-token-guide', '_blank')}
                                size="sm"
                              >
                                <ExternalLink className="h-3 w-3 mr-2" />
                                提取 App Token
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => window.open('/feishu-quick-config', '_blank')}
                                size="sm"
                              >
                                <ArrowRight className="h-3 w-3 mr-2" />
                                快速配置
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => window.open('/feishu-create-base-guide', '_blank')}
                                size="sm"
                              >
                                <Plus className="h-3 w-3 mr-2" />
                                创建新多维表
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
