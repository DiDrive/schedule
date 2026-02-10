'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface DiagnosticResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
}

export default function FeishuOAuthDiagnosticPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addDiagnostic = (step: string, status: 'pending' | 'running' | 'success' | 'error', message: string, details?: any) => {
    setDiagnostics(prev => {
      // 更新现有步骤或添加新步骤
      const existingIndex = prev.findIndex(d => d.step === step);
      if (existingIndex !== -1) {
        const newDiagnostics = [...prev];
        newDiagnostics[existingIndex] = { step, status, message, details };
        return newDiagnostics;
      }
      return [...prev, { step, status, message, details }];
    });
  };

  const runDiagnostic = async () => {
    setIsRunning(true);
    setDiagnostics([]);

    try {
      // 步骤 1: 检查 localStorage 配置
      addDiagnostic('检查前端配置', 'running', '正在检查配置...');
      const configStr = localStorage.getItem('feishu-config');
      if (configStr) {
        const config = JSON.parse(configStr);
        addDiagnostic('检查前端配置', 'success', '前端配置已找到', {
          appId: config.appId || '未设置',
          appSecret: config.appSecret ? '已设置' : '未设置',
          appToken: config.appToken || '未设置',
          hasTableIds: Object.keys(config.tableIds || {}).length > 0
        });
      } else {
        addDiagnostic('检查前端配置', 'error', '前端配置未找到');
      }

      // 步骤 2: 检查飞书应用凭证
      addDiagnostic('验证飞书应用凭证', 'running', '正在验证 App ID 和 App Secret...');
      const appId = 'cli_a90ff12d93635bc4';
      const appSecret = 'n2rCClUbnOVZoOMMsBDyxfGwtZd1oFO5';

      const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.code === 0) {
        addDiagnostic('验证飞书应用凭证', 'success', '飞书应用凭证有效', {
          tenantAccessToken: tokenData.tenant_access_token ? '已获取' : '未获取',
          expire: tokenData.expire ? `${tokenData.expire}秒` : '未知'
        });
      } else {
        addDiagnostic('验证飞书应用凭证', 'error', `飞书应用凭证无效: ${tokenData.msg}`, tokenData);
      }

      // 步骤 3: 检查 OAuth 端点
      addDiagnostic('测试 OAuth 端点', 'running', '正在测试 OAuth 端点...');

      const oauthResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          app_id: appId,
          app_secret: appSecret,
          code: 'test_code',
        }),
      });

      const oauthData = await oauthResponse.json();

      addDiagnostic('测试 OAuth 端点', oauthData.code === 0 ? 'success' : 'error', 'OAuth 端点响应', {
        code: oauthData.code,
        message: oauthData.message || oauthData.msg,
        status: oauthResponse.status
      });

      if (oauthData.code === 99991668) {
        addDiagnostic('OAuth 问题诊断', 'success', '授权码无效（预期行为，使用测试 code）', {
          '说明': '测试代码返回预期错误，说明 OAuth 端点配置正确',
          '建议': '使用真实扫码登录流程获取有效授权码',
        });
      }

    } catch (error) {
      addDiagnostic('诊断过程', 'error', `诊断失败: ${error instanceof Error ? error.message : String(error)}`, error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书 OAuth 诊断工具
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            检测飞书扫码登录配置问题
          </p>
        </div>

        {/* 操作按钮 */}
        <Card>
          <CardHeader>
            <CardTitle>诊断操作</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={runDiagnostic} disabled={isRunning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              重新运行诊断
            </Button>
          </CardContent>
        </Card>

        {/* 诊断结果 */}
        {diagnostics.length > 0 && (
          <div className="space-y-3">
            {diagnostics.map((result, index) => (
              <Card key={index} className={
                result.status === 'success' ? 'border-green-300 dark:border-green-700' :
                result.status === 'error' ? 'border-red-300 dark:border-red-700' :
                result.status === 'running' ? 'border-blue-300 dark:border-blue-700' :
                'border-slate-300 dark:border-slate-700'
              }>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {result.status === 'running' && <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />}
                        {result.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        {result.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                        {result.status === 'pending' && <div className="h-5 w-5 rounded-full bg-slate-300" />}
                        <span className="font-medium text-slate-900 dark:text-white">{result.step}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">{result.message}</p>
                      {result.details && (
                        <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded ml-7 overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 解决方案建议 */}
        {diagnostics.some(d => d.status === 'error' && d.message.includes('20014')) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>常见错误解决方案</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-2 text-sm">
                <p>请检查飞书开放平台的以下配置：</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>访问 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                    飞书开放平台
                    <ExternalLink className="h-3 w-3" />
                  </a></li>
                  <li>找到应用 <code>cli_a90ff12d93635bc4</code></li>
                  <li>进入"权限管理" → "权限配置"，启用以下权限：
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-600">
                      <li>获取用户基本信息</li>
                      <li>获取用户邮箱</li>
                    </ul>
                  </li>
                  <li>进入"安全设置" → "重定向 URL"，添加：
                    <code className="ml-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      https://kdck9rbnvr.coze.site/feishu-oauth-callback
                    </code>
                  </li>
                  <li>保存配置并重新尝试</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
