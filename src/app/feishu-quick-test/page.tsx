'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function FeishuQuickTestPage() {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [appToken, setAppToken] = useState('');
  const [tableId, setTableId] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [result, setResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isValidatingTable, setIsValidatingTable] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<any>(null);
  const [tableValidation, setTableValidation] = useState<any>(null);

  // 从 localStorage 加载配置
  useEffect(() => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        setAppId(config.appId || '');
        setAppSecret(config.appSecret || '');
        setAppToken(config.appToken || '');
        // 查找第一个有 Table ID 的表格
        const tableIds = config.tableIds || {};
        setTableId(tableIds.resources || tableIds.projects || tableIds.tasks || tableIds.schedules || '');
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
  }, []);

  const runTest = async () => {
    setIsTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/feishu/test-read-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            appId,
            appSecret,
            appToken,
            tableIds: {
              resources: tableId,
              projects: '',
              tasks: '',
              schedules: '',
            },
          },
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const validateAppToken = async () => {
    setIsValidatingToken(true);
    setTokenValidation(null);

    try {
      const response = await fetch('/api/feishu/validate-app-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId,
          appSecret,
          appToken,
        }),
      });

      const data = await response.json();
      setTokenValidation(data);
    } catch (error: any) {
      setTokenValidation({
        success: false,
        error: error.message,
      });
    } finally {
      setIsValidatingToken(false);
    }
  };

  const validateTableId = async () => {
    setIsValidatingTable(true);
    setTableValidation(null);

    try {
      const response = await fetch('/api/feishu/validate-table-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId,
          appSecret,
          appToken,
          tableId,
        }),
      });

      const data = await response.json();
      setTableValidation(data);
    } catch (error: any) {
      setTableValidation({
        success: false,
        error: error.message,
      });
    } finally {
      setIsValidatingTable(false);
    }
  };

  const loadFromLocalStorage = () => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        setAppId(config.appId || '');
        setAppSecret(config.appSecret || '');
        setAppToken(config.appToken || '');
        const tableIds = config.tableIds || {};
        setTableId(tableIds.resources || tableIds.projects || tableIds.tasks || tableIds.schedules || '');
        alert('配置已加载');
      } catch (error) {
        alert('加载配置失败');
      }
    } else {
      alert('未找到配置');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书连接快速测试
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            快速验证飞书配置是否正确
          </p>
        </div>

        {/* 配置表单 */}
        <Card>
          <CardHeader>
            <CardTitle>飞书配置</CardTitle>
            <CardDescription>
              填写飞书应用信息和 Table ID 进行测试
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                onClick={loadFromLocalStorage}
              >
                从 localStorage 加载
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appId">App ID</Label>
                <Input
                  id="appId"
                  placeholder="cli_xxxxxxxxx"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appSecret">App Secret</Label>
                <div className="relative">
                  <Input
                    id="appSecret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="xxxxxxxxxxxx"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appToken">App Token</Label>
              <Input
                id="appToken"
                placeholder="bascxxxxxxxxxxxx"
                value={appToken}
                onChange={(e) => setAppToken(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tableId">Table ID</Label>
              <Input
                id="tableId"
                placeholder="tblxxxxxxxx"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Table ID 可以从飞书多维表的 URL 中获取，通常以 "tbl" 开头
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={validateAppToken}
                disabled={isValidatingToken || !appId || !appSecret || !appToken}
                className="flex-1"
              >
                {isValidatingToken ? '验证中...' : '验证 App Token'}
              </Button>
              <Button
                variant="outline"
                onClick={validateTableId}
                disabled={isValidatingTable || !appId || !appSecret || !appToken || !tableId}
                className="flex-1"
              >
                {isValidatingTable ? '验证中...' : '验证 Table ID'}
              </Button>
            </div>

            <Button
              onClick={runTest}
              disabled={isTesting || !appId || !appSecret || !appToken || !tableId}
              className="w-full"
            >
              {isTesting ? '测试中...' : '开始测试'}
            </Button>
          </CardContent>
        </Card>

        {/* App Token 验证结果 */}
        {tokenValidation && (
          <Card>
            <CardHeader>
              <CardTitle>App Token 验证结果</CardTitle>
              <CardDescription>
                {tokenValidation.success ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    App Token 有效
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    App Token 无效
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokenValidation.success && tokenValidation.data ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">
                      App Token 验证成功
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">应用名称：</span>
                        <span className="font-medium">{tokenValidation.data.app?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">表格数量：</span>
                        <span className="font-medium">{tokenValidation.data.tables?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  {tokenValidation.data.tables && tokenValidation.data.tables.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-slate-700 dark:text-slate-300">表格列表：</h3>
                      <div className="space-y-2">
                        {tokenValidation.data.tables.map((table: any, index: number) => (
                          <div key={index} className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{table.name}</span>
                              <span className="font-mono text-slate-600 dark:text-slate-400">{table.id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>验证失败</AlertTitle>
                  <AlertDescription>
                    {tokenValidation.error || tokenValidation.message || '未知错误'}
                  </AlertDescription>
                  {tokenValidation.code && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">错误码：</span>
                      <Badge variant="destructive">{tokenValidation.code}</Badge>
                    </div>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Table ID 验证结果 */}
        {tableValidation && (
          <Card>
            <CardHeader>
              <CardTitle>Table ID 验证结果</CardTitle>
              <CardDescription>
                {tableValidation.success ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Table ID 有效
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    Table ID 无效
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tableValidation.success && tableValidation.data ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">
                      Table ID 验证成功
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">表格名称：</span>
                        <span className="font-medium">{tableValidation.data.table?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">字段数量：</span>
                        <span className="font-medium">{tableValidation.data.fields?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  {tableValidation.data.fields && tableValidation.data.fields.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-slate-700 dark:text-slate-300">字段列表：</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {tableValidation.data.fields.map((field: any, index: number) => (
                          <div key={index} className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                            <div className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{field.name}</span>
                                {field.isPrimary && <Badge variant="secondary">主键</Badge>}
                              </div>
                              <span className="font-mono text-slate-600 dark:text-slate-400 text-xs">{field.id}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              类型：{field.type}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>验证失败</AlertTitle>
                  <AlertDescription>
                    {tableValidation.error || tableValidation.message || '未知错误'}
                  </AlertDescription>
                  {tableValidation.code && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">错误码：</span>
                      <Badge variant="destructive">{tableValidation.code}</Badge>
                    </div>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* 测试结果 */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>测试结果</CardTitle>
              <CardDescription>
                {result.success ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    测试成功
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    测试失败
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.success && result.data ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">
                      连接成功！
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">表格名称：</span>
                        <span className="font-medium">{result.data.tableName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Table ID：</span>
                        <span className="font-mono text-green-600">{result.data.tableId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">记录数：</span>
                        <span className="font-medium">{result.data.recordCount}</span>
                      </div>
                    </div>
                  </div>

                  {result.data.sampleRecord && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-slate-700 dark:text-slate-300">示例记录：</h3>
                      <pre className="p-4 rounded bg-slate-50 dark:bg-slate-800 text-xs overflow-auto max-h-64">
                        {JSON.stringify(result.data.sampleRecord, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>测试失败</AlertTitle>
                    <AlertDescription>
                      {result.error || result.message || '未知错误'}
                    </AlertDescription>
                  </Alert>

                  {result.code && (
                    <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <h3 className="font-medium text-red-700 dark:text-red-400 mb-2">
                        错误详情
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">错误码：</span>
                          <Badge variant="destructive">{result.code}</Badge>
                        </div>
                        {result.message && (
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">错误消息：</span>
                            <span className="text-red-600">{result.message}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                      常见错误及解决方案
                    </h3>
                    <ul className="space-y-2 text-sm text-amber-600 dark:text-amber-500">
                      <li>
                        <strong>Forbidden (91403)：</strong>
                        应用没有权限访问该表格。请检查飞书应用的权限设置。
                      </li>
                      <li>
                        <strong>NOTEXIST：</strong>
                        表格不存在或已被删除。请检查 Table ID 是否正确。
                      </li>
                      <li>
                        <strong>Unauthorized：</strong>
                        App ID 或 App Secret 不正确。请检查配置信息。
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 帮助信息 */}
        <Card>
          <CardHeader>
            <CardTitle>如何获取配置信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. App ID 和 App Secret</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                登录 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">飞书开放平台</a>，进入应用管理，在"凭证与基础信息"页面获取。
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. App Token</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                打开飞书多维表，从浏览器地址栏的 URL 中提取。格式：<code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">https://xxx.feishu.cn/base/</code><code className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">bascnxxxx</code>
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">3. Table ID</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                打开飞书多维表，点击要访问的表格，从浏览器地址栏的 URL 中提取。格式：<code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">?table=</code><code className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">tblxxxx</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
