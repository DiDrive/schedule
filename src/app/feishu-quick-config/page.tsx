'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, ArrowRight, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FeishuQuickConfigPage() {
  const [appToken, setAppToken] = useState('');
  const [feishuUrl, setFeishuUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const extractAppTokenFromUrl = (url: string) => {
    const match = url.match(/\/base\/([a-zA-Z0-9]+)/);
    return match ? match[1] : '';
  };

  const handleUrlChange = (url: string) => {
    setFeishuUrl(url);
    const extractedToken = extractAppTokenFromUrl(url);
    if (extractedToken) {
      setAppToken(extractedToken);
    }
  };

  const loadFromLocalStorage = () => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      const config = JSON.parse(configStr);
      setAppToken(config.appToken || '');
      fetchTables(config.appToken);
    }
  };

  const fetchTables = async (token: string) => {
    setIsLoading(true);
    setTables([]);
    setError(null);

    try {
      const configStr = localStorage.getItem('feishu-config');
      if (!configStr) {
        setError('请先配置飞书集成信息（App ID 和 App Secret）');
        return;
      }

      const config = JSON.parse(configStr);

      // 获取 access token
      const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: config.appId,
          app_secret: config.appSecret,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.code !== 0) {
        throw new Error(`获取 Access Token 失败: ${tokenData.msg}`);
      }

      // 获取多维表的表格列表
      const tablesResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${token}/tables`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.tenant_access_token}`,
          },
        }
      );

      const tablesData = await tablesResponse.json();

      if (tablesData.code !== 0) {
        throw new Error(tablesData.msg);
      }

      setTables(tablesData.data?.items || []);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (appToken) {
      fetchTables(appToken);
    }
  };

  const openBase = () => {
    if (appToken) {
      window.open(`https://vbangessentials.feishu.cn/base/${appToken}`, '_blank');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const updateConfig = (tableId: string, tableName: string) => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      const config = JSON.parse(configStr);

      // 根据表格名称自动映射
      const mapping: { [key: string]: string } = {
        '人员表': 'resources',
        '项目表': 'projects',
        '任务表': 'tasks',
        '排期表': 'schedules',
      };

      const key = mapping[tableName];
      if (key) {
        config.tableIds[key] = tableId;
        localStorage.setItem('feishu-config', JSON.stringify(config));
        alert(`已更新 ${tableName} 的 Table ID 为：${tableId}`);
      } else {
        alert(`无法自动识别表格类型：${tableName}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书快速配置
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            快速获取和配置 Table IDs
          </p>
        </div>

        {/* 步骤说明 */}
        <Card>
          <CardHeader>
            <CardTitle>配置步骤</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                <p className="font-medium">创建多维表并添加表格</p>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  在飞书中创建多维表，并至少创建一个表格（如：人员表、项目表、任务表、排期表）
                </p>
              </li>
              <li>
                <p className="font-medium">获取 App Token</p>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  复制多维表 URL 中的 App Token（base/后面的部分）
                </p>
              </li>
              <li>
                <p className="font-medium">提取 Table IDs</p>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  输入 App Token，系统会自动获取所有表格的 Table IDs
                </p>
              </li>
              <li>
                <p className="font-medium">更新配置</p>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  点击「更新配置」按钮，将 Table IDs 添加到系统配置中
                </p>
              </li>
            </ol>

            <div className="flex gap-2 pt-2">
              <Button onClick={loadFromLocalStorage} variant="outline">
                从配置加载 App Token
              </Button>
              <Button onClick={() => window.open('/feishu-create-base-guide', '_blank')} variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                创建指南
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* App Token 输入 */}
        <Card>
          <CardHeader>
            <CardTitle>输入多维表信息</CardTitle>
            <CardDescription>
              输入你的多维表 URL 或 App Token，系统会自动获取所有表格
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 方法1：从 URL 提取 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">方法 1：粘贴多维表 URL（推荐）</label>
              <input
                type="text"
                placeholder="https://vbangessentials.feishu.cn/base/bascxxxxxxxxxxxx?table=tblxxxxxxxx"
                value={feishuUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
              {feishuUrl && appToken && (
                <p className="text-xs text-green-600">
                  ✓ 已提取 App Token: {appToken}
                </p>
              )}
            </div>

            <div className="text-center text-sm text-slate-400">
              - 或 -
            </div>

            {/* 方法2：直接输入 App Token */}
            <div className="space-y-2">
              <label className="text-sm font-medium">方法 2：直接输入 App Token</label>
              <input
                type="text"
                placeholder="例如：bascxxxxxxxxxxxx"
                value={appToken}
                onChange={(e) => setAppToken(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={loadFromLocalStorage} variant="outline" size="sm">
                从配置加载
              </Button>
              <Button onClick={handleRefresh} disabled={isLoading || !appToken} className="flex-1">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    获取中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    获取表格列表
                  </>
                )}
              </Button>
              {appToken && (
                <Button variant="outline" onClick={openBase}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  打开
                </Button>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 表格列表 */}
        {tables.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                找到 {tables.length} 个表格
              </CardTitle>
              <CardDescription>
                点击「更新配置」将 Table ID 添加到系统中
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tables.map((table: any, index: number) => (
                <div key={index} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-lg">{table.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {table.fields?.length || 0} 个字段
                      </p>
                    </div>
                    <Badge variant="secondary">{table.id}</Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateConfig(table.id, table.name)}
                    >
                      <ArrowRight className="h-3 w-3 mr-2" />
                      更新配置
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(table.id)}
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      复制
                    </Button>
                  </div>
                </div>
              ))}

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>自动映射</AlertTitle>
                <AlertDescription>
                  系统会根据表格名称自动映射到对应的配置项：
                  <br />
                  • 人员表 → resources
                  <br />
                  • 项目表 → projects
                  <br />
                  • 任务表 → tasks
                  <br />
                  • 排期表 → schedules
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {tables.length === 0 && !isLoading && !error && (
          <Alert>
            <RefreshCw className="h-4 w-4" />
            <AlertTitle>等待输入</AlertTitle>
            <AlertDescription>
              请输入 App Token 并点击「获取表格列表」按钮
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
