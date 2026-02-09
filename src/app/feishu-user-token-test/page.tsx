'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Lock, AlertCircle } from 'lucide-react';

export default function FeishuUserTokenTestPage() {
  const [appToken, setAppToken] = useState('');
  const [tableId, setTableId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useState(() => {
    // 检查登录状态
    const userToken = localStorage.getItem('feishu-user-token');
    setIsLoggedIn(!!userToken);
  });

  const handleTest = async () => {
    if (!appToken || !tableId) {
      setError('请填写 App Token 和 Table ID');
      return;
    }

    const userToken = localStorage.getItem('feishu-user-token');
    if (!userToken) {
      setError('未登录，请先使用飞书登录');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/feishu/user/read-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-feishu-user-token': userToken,
        },
        body: JSON.stringify({
          appToken,
          tableId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '测试失败');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书用户令牌测试
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            测试使用 OAuth 登录后能否访问你的个人多维表
          </p>
        </div>

        {/* 登录状态 */}
        {isLoggedIn ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>已登录</AlertTitle>
            <AlertDescription>
              你已使用飞书账号登录，可以测试访问个人多维表
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>未登录</AlertTitle>
            <AlertDescription>
              请先使用飞书登录，然后再进行测试
              <div className="mt-2">
                <Button
                  onClick={() => window.location.href = '/feishu-oauth'}
                  size="sm"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  使用飞书登录
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 测试表单 */}
        <Card>
          <CardHeader>
            <CardTitle>测试配置</CardTitle>
            <CardDescription>
              输入你个人创建的多维表的 App Token 和 Table ID
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            </div>
            <Button
              onClick={handleTest}
              disabled={isLoading || !isLoggedIn}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  开始测试
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 测试结果 */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>测试结果</CardTitle>
              <CardDescription>
                使用用户令牌访问表格的结果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>成功</AlertTitle>
                <AlertDescription>
                  成功读取到表格数据，共 {result.data.total} 条记录
                </AlertDescription>
              </Alert>

              {result.data.records.length > 0 && (
                <div className="space-y-2">
                  <Label>前 5 条记录</Label>
                  <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                    {JSON.stringify(result.data.records, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 错误信息 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 快速链接 */}
        <Card>
          <CardHeader>
            <CardTitle>快速链接</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/feishu-oauth'}>
              飞书登录
            </Button>
            <Button variant="outline" onClick={() => window.open('/feishu-config-manager', '_blank')}>
              配置管理
            </Button>
            <Button variant="outline" onClick={() => window.open('/feishu-permission-guide', '_blank')}>
              权限问题解决方案
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
