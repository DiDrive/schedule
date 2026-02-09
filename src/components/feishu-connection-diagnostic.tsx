'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DiagnosticResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
  timestamp?: string;
}

export default function FeishuConnectionDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setDiagnostics([]);

    // 从 localStorage 读取配置（需要在函数作用域内）
    const configStr = localStorage.getItem('feishu-config');
    let config: any = null;

    const updateStep = (step: string, status: 'pending' | 'running' | 'success' | 'error', message: string, details?: any) => {
      setDiagnostics(prev => {
        const newDiagnostics = [...prev];
        const existingIndex = newDiagnostics.findIndex(d => d.step === step);
        const result: DiagnosticResult = {
          step,
          status,
          message,
          details,
          timestamp: new Date().toISOString(),
        };
        if (existingIndex >= 0) {
          newDiagnostics[existingIndex] = result;
        } else {
          newDiagnostics.push(result);
        }
        return newDiagnostics;
      });
    };

    // 步骤 1: 检查本地配置
    updateStep('检查本地配置', 'running', '正在检查本地配置...');
    try {
      if (!configStr) {
        updateStep('检查本地配置', 'error', '配置未找到', {
          建议: '请先在飞书集成配置中填写配置信息',
        });
        setIsRunning(false);
        return;
      }

      config = JSON.parse(configStr);

      // 验证配置
      const response = await fetch('/api/feishu/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });
      const data = await response.json();

      if (!data.success) {
        updateStep('检查本地配置', 'error', '配置缺失或不完整', {
          缺失: '请检查飞书配置是否已正确填写',
        });
        setIsRunning(false);
        return;
      }
      updateStep('检查本地配置', 'success', '配置已找到', {
        'App ID': `${config.appId.substring(0, 8)}...`,
        'App Secret': `${config.appSecret.substring(0, 8)}...`,
        'App Token': config.appToken,
        '表格数量': Object.keys(config.tableIds).filter(k => config.tableIds[k]).length,
      });
    } catch (error: any) {
      updateStep('检查本地配置', 'error', `配置检查失败: ${error.message}`, error);
      setIsRunning(false);
      return;
    }

    // 步骤 2: 测试获取 Access Token
    updateStep('获取 Access Token', 'running', '正在获取 Access Token...');
    try {
      const response = await fetch('/api/feishu/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });
      const data = await response.json();

      if (data.success && data.data.access_token) {
        updateStep('获取 Access Token', 'success', 'Access Token 获取成功', {
          Token: `${data.data.access_token.substring(0, 20)}...`,
          '过期时间': `${data.data.expire} 秒`,
        });
      } else {
        updateStep('获取 Access Token', 'error', 'Access Token 获取失败', {
          错误: data.error || '未知错误',
          建议: '请检查 App ID 和 App Secret 是否正确',
        });
        setIsRunning(false);
        return;
      }
    } catch (error: any) {
      updateStep('获取 Access Token', 'error', `Access Token 获取失败: ${error.message}`, error);
      setIsRunning(false);
      return;
    }

    // 步骤 3: 测试读取 App 信息
    updateStep('测试读取 App 信息', 'running', '正在测试读取多维表信息...');
    try {
      const response = await fetch('/api/feishu/test-read-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });
      const data = await response.json();

      if (data.success) {
        updateStep('测试读取 App 信息', 'success', '多维表信息读取成功', {
          'App Token': data.data.appToken,
          '表格数量': data.data.tableCount,
          '表格列表': data.data.tables,
        });
      } else {
        updateStep('测试读取 App 信息', 'error', `读取失败: ${data.message}`, {
          错误码: data.code,
          错误消息: data.error,
          可能原因: [
            'App Token 不正确或不存在',
            '应用没有权限访问该多维表',
            '多维表已被删除或归档',
          ],
        });
      }
    } catch (error: any) {
      updateStep('测试读取 App 信息', 'error', `读取失败: ${error.message}`, error);
    }

    // 步骤 4: 测试读取表格记录
    updateStep('测试读取表格记录', 'running', '正在测试读取表格记录...');
    try {
      const response = await fetch('/api/feishu/test-read-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });
      const data = await response.json();

      if (data.success) {
        updateStep('测试读取表格记录', 'success', '表格记录读取成功', {
          'Table ID': data.data.tableId,
          '记录数': data.data.recordCount,
          '示例记录': data.data.sampleRecord,
        });
      } else {
        updateStep('测试读取表格记录', 'error', `读取失败: ${data.message}`, {
          错误码: data.code,
          错误消息: data.error,
          可能原因: [
            'Table ID 不正确',
            '应用没有权限访问该表格',
            '表格已被删除',
          ],
        });
      }
    } catch (error: any) {
      updateStep('测试读取表格记录', 'error', `读取失败: ${error.message}`, error);
    }

    // 步骤 5: 测试创建记录
    updateStep('测试创建记录', 'running', '正在测试创建记录...');
    try {
      const response = await fetch('/api/feishu/test-create-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });
      const data = await response.json();

      if (data.success) {
        updateStep('测试创建记录', 'success', '记录创建成功', {
          'Record ID': data.data.recordId,
          '测试数据': data.data.testData,
        });
      } else {
        updateStep('测试创建记录', 'error', `创建失败: ${data.message}`, {
          错误码: data.code,
          错误消息: data.error,
          可能原因: [
            '应用没有写入权限',
            '表格字段配置不正确',
            '请求参数格式错误',
          ],
        });
      }
    } catch (error: any) {
      updateStep('测试创建记录', 'error', `创建失败: ${error.message}`, error);
    }

    // 完成
    updateStep('诊断完成', 'success', '所有测试已完成');
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Loader2 className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">运行中</Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">成功</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">失败</Badge>;
      default:
        return <Badge variant="outline">等待中</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 开始诊断 */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Info className="h-6 w-6" />
            飞书连接诊断工具
          </CardTitle>
          <CardDescription>
            逐步测试飞书连接，帮助您定位 "Forbidden" 错误的原因
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runDiagnostic}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                诊断中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                开始诊断
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 诊断结果 */}
      <div className="space-y-4">
        {diagnostics.map((diagnostic, index) => (
          <Card
            key={index}
            className={
              diagnostic.status === 'success'
                ? 'border-green-200 dark:border-green-800'
                : diagnostic.status === 'error'
                ? 'border-red-200 dark:border-red-800'
                : diagnostic.status === 'running'
                ? 'border-blue-200 dark:border-blue-800'
                : ''
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getStatusIcon(diagnostic.status)}
                  <span className="text-slate-700 dark:text-slate-300">{diagnostic.step}</span>
                </CardTitle>
                {getStatusBadge(diagnostic.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {diagnostic.message}
                </p>

                {diagnostic.details && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                    {Object.entries(diagnostic.details).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{key}:</span>
                        <span className="ml-2 text-slate-600 dark:text-slate-400">
                          {Array.isArray(value)
                            ? value.map((v, i) => (
                                <div key={i} className="ml-4">• {v}</div>
                              ))
                            : typeof value === 'object'
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {diagnostic.timestamp && (
                  <p className="text-xs text-slate-500">
                    时间: {new Date(diagnostic.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 常见问题 */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            常见问题
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">1. 应用未发布</p>
            <p className="text-amber-600 dark:text-amber-500">
              飞书应用需要在开放平台发布后才能调用API。请到飞书开放平台发布您的应用。
            </p>
          </div>
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">2. App ID / App Secret 错误</p>
            <p className="text-amber-600 dark:text-amber-500">
              请检查 App ID 和 App Secret 是否正确，确保没有多余的空格或换行符。
            </p>
          </div>
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">3. App Token 不正确</p>
            <p className="text-amber-600 dark:text-amber-500">
              请检查 App Token 是否从正确的URL中提取。格式应为字母和数字组合，长度通常在20-30位。
            </p>
          </div>
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">4. 应用未授权</p>
            <p className="text-amber-600 dark:text-amber-500">
              应用需要授权给用户才能访问多维表。请确保应用已授权给您或其他用户。
            </p>
          </div>
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">5. 多维表权限不足</p>
            <p className="text-amber-600 dark:text-amber-500">
              请确保应用有权限访问该多维表。在飞书开放平台的权限管理中，确保已授予 `bitable:app` 权限。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
