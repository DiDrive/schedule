'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Copy, ExternalLink, ArrowRight, Lightbulb, AlertCircle, Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TableInfo {
  id: string;
  name: string;
}

export default function FeishuAppTokenGuidePage() {
  const [feishuUrl, setFeishuUrl] = useState('');
  const [extractedAppToken, setExtractedAppToken] = useState('');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  // 从 localStorage 加载配置
  const loadCurrentConfig = () => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      try {
        setCurrentConfig(JSON.parse(configStr));
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
  };

  const extractAppTokenFromUrl = (url: string) => {
    // 飞书多维表 URL 格式: https://bytedance.feishu.cn/base/{appToken}?xxx
    // 或: https://xxx.feishu.cn/base/{appToken}
    const match = url.match(/\/base\/([a-zA-Z0-9]+)/);
    if (match) {
      return match[1];
    }
    return '';
  };

  const handleExtract = () => {
    const token = extractAppTokenFromUrl(feishuUrl);
    setExtractedAppToken(token);
    if (token) {
      fetchTablesForToken(token);
    }
  };

  const fetchTablesForToken = async (appToken: string) => {
    setIsLoading(true);
    setTables([]);
    setError(null);
    setRawResponse(null);

    try {
      // 从 localStorage 读取配置以获取 appId 和 appSecret
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
        setError(`获取 Access Token 失败: ${tokenData.msg} (错误码: ${tokenData.code})`);
        setRawResponse(JSON.stringify(tokenData, null, 2));
        return;
      }

      // 获取多维表的表格列表
      const tablesResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`,
        {
          headers: {
            Authorization: `Bearer ${tokenData.tenant_access_token}`,
          },
        }
      );

      const tablesData = await tablesResponse.json();

      // 保存原始响应
      setRawResponse(JSON.stringify(tablesData, null, 2));

      if (tablesData.code !== 0) {
        setError(`获取表格列表失败: ${tablesData.msg} (错误码: ${tablesData.code})`);
        return;
      }

      setTables(tablesData.data?.items || []);
    } catch (error: any) {
      setError(error.message);
      setRawResponse(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const applyToken = () => {
    if (!extractedAppToken) return;

    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      const config = JSON.parse(configStr);
      config.appToken = extractedAppToken;
      localStorage.setItem('feishu-config', JSON.stringify(config));
      alert('App Token 已更新，请前往配置页面设置对应的 Table IDs');
      window.location.href = '/?tab=feishu';
    } else {
      alert('请先配置飞书集成信息');
    }
  };

  // 初始化时加载当前配置
  useEffect(() => {
    loadCurrentConfig();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书 App Token 配置指南
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            帮助你找到正确的 App Token 和对应的 Table IDs
          </p>
        </div>

        {/* 问题说明 */}
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>为什么会出现这个页面？</AlertTitle>
          <AlertDescription>
            你当前的配置中，App Token 与 Table IDs 不匹配。每个多维表都有独立的 App Token，
            只有属于该多维表的 Table IDs 才能正常工作。你需要找到包含这4个表格（人员表、项目表、任务表、排期表）的正确多维表。
          </AlertDescription>
        </Alert>

        {/* 当前配置 */}
        {currentConfig && (
          <Card>
            <CardHeader>
              <CardTitle>当前配置</CardTitle>
              <CardDescription>系统当前使用的 App Token</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                <code className="text-sm">{currentConfig.appToken}</code>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 方法1：从 URL 提取 */}
        <Card>
          <CardHeader>
            <CardTitle>方法 1：从飞书多维表 URL 提取 App Token</CardTitle>
            <CardDescription>
              如果你知道包含这4个表格的飞书多维表链接，可以直接从 URL 中提取 App Token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">粘贴飞书多维表 URL</label>
              <Input
                placeholder="https://bytedance.feishu.cn/base/bascxxxxxxxxxxxxxxx?xxx"
                value={feishuUrl}
                onChange={(e) => setFeishuUrl(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                在飞书多维表中，点击右上角"分享"或直接复制浏览器地址栏的链接
              </p>
            </div>

            <Button onClick={handleExtract} disabled={!feishuUrl || isLoading}>
              {isLoading ? '获取中...' : '提取 App Token'}
            </Button>

            {extractedAppToken && (
              <div className="space-y-3">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>提取成功</AlertTitle>
                  <AlertDescription>
                    App Token: <code className="ml-2">{extractedAppToken}</code>
                  </AlertDescription>
                </Alert>

                {tables.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">该多维表包含 {tables.length} 个表格:</p>
                    <div className="space-y-2">
                      {tables.map((table) => (
                        <div key={table.id} className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-slate-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{table.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs">{table.id}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(table.id)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {tables.length >= 4 && (
                      <Button onClick={applyToken} className="w-full mt-4">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        使用这个 App Token 并配置 Table IDs
                      </Button>
                    )}
                    {tables.length < 4 && (
                      <Alert variant="destructive" className="mt-4">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>表格数量不足</AlertTitle>
                        <AlertDescription>
                          该多维表只包含 {tables.length} 个表格，但系统需要 4 个表格（人员表、项目表、任务表、排期表）。
                          请找到正确的多维表，或在当前多维表中创建缺少的表格。
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {tables.length === 0 && !isLoading && (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>未找到表格</AlertTitle>
                      <AlertDescription>
                        该 App Token 对应的多维表中没有任何表格。
                      </AlertDescription>
                    </Alert>

                    {error && (
                      <Alert>
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>错误信息</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{error}</p>
                          {error.includes('permission') && (
                            <div className="space-y-2">
                              <Button
                                size="sm"
                                onClick={() => window.open('/feishu-permission-guide', '_blank')}
                                className="mr-2"
                              >
                                <ExternalLink className="h-3 w-3 mr-2" />
                                查看权限问题解决方案
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open('/feishu-create-base-guide', '_blank')}
                              >
                                <Plus className="h-3 w-3 mr-2" />
                                创建新多维表（推荐）
                              </Button>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {rawResponse && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">API 原始响应：</p>
                        <pre className="text-xs p-3 rounded bg-slate-100 dark:bg-slate-800 overflow-auto max-h-64">
                          {rawResponse}
                        </pre>
                      </div>
                    )}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>可能的原因</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>1. 你的飞书应用没有访问这个多维表的权限</p>
                        <p>2. 多维表未授权给你的应用</p>
                        <p>3. URL 中的 App Token 不正确</p>
                      </AlertDescription>
                    </Alert>

                    <Alert>
                      <Lightbulb className="h-4 w-4" />
                      <AlertTitle>解决方案</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p><strong>方案 1：</strong>在飞书多维表中，点击右上角"更多" → "分享"，将多维表分享给你的飞书应用</p>
                        <p><strong>方案 2：</strong>在飞书开放平台中，为应用添加"多维表格"权限，并授权访问这个多维表</p>
                        <p><strong>方案 3：</strong>使用从 URL 中提取的 Table ID（如 {extractedAppToken && feishuUrl.match(/table=([a-zA-Z0-9]+)/)?.[1]}）直接更新到配置中</p>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 方法2：手动查找 */}
        <Card>
          <CardHeader>
            <CardTitle>方法 2：在飞书开放平台查找</CardTitle>
            <CardDescription>
              如果你有飞书开放平台的管理权限，可以直接在那里查找
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>打开 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">飞书开放平台</a></li>
              <li>找到你创建的企业自建应用</li>
              <li>进入应用，点击左侧菜单"权限管理"</li>
              <li>在"多维表格"权限中，查看授权的多维表列表</li>
              <li>找到包含你需要同步的多维表，复制其 App Token</li>
              <li>点击多维表，查看内部的所有表格，获取对应的 Table IDs</li>
            </ol>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://open.feishu.cn/app', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              打开飞书开放平台
            </Button>
          </CardContent>
        </Card>

        {/* 重要提示 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="destructive">重要</Badge>
              App Token 和 Table ID 的关系
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>App Token</strong>: 标识一个特定的多维表（类似一个 Excel 文件）
            </p>
            <p>
              <strong>Table ID</strong>: 标识多维表中的一个特定表格（类似 Excel 中的一个 Sheet）
            </p>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                ⚠️ 必须确保 Table ID 属于对应的 App Token，否则会报 Forbidden 错误
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
