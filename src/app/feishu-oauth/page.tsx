'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Lock, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FeishuOAuthPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // 检查是否已经登录
    const storedToken = localStorage.getItem('feishu-user-token');
    const storedUserInfo = localStorage.getItem('feishu-user-info');

    if (storedToken) {
      setAccessToken(storedToken);
      setIsLoggedIn(true);
    }
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }
  }, []);

  const handleFeishuLogin = () => {
    // 构造飞书 OAuth 授权 URL
    const appId = 'cli_a90f3ef5a393900b'; // 使用你的 App ID
    const redirectUri = `${window.location.origin}/feishu-oauth-callback`;
    const scope = 'bitable:app,bitable:app:readonly';

    const authUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${Date.now()}`;

    window.location.href = authUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem('feishu-user-token');
    localStorage.removeItem('feishu-user-info');
    setAccessToken(null);
    setUserInfo(null);
    setIsLoggedIn(false);
  };

  const testAccess = async () => {
    if (!accessToken) {
      alert('请先登录飞书');
      return;
    }

    try {
      const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.code === 0) {
        alert(`登录验证成功！\n用户：${data.data.name}`);
      } else {
        alert(`验证失败：${data.msg}`);
      }
    } catch (error) {
      alert(`验证失败：${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书登录
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            使用你的飞书账号登录，访问你的个人多维表
          </p>
        </div>

        {/* 登录状态 */}
        <Card>
          <CardHeader>
            <CardTitle>登录状态</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoggedIn ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>已登录</AlertTitle>
                  <AlertDescription>
                    {userInfo && (
                      <div className="mt-2">
                        <p className="font-medium">{userInfo.name || '飞书用户'}</p>
                        {userInfo.email && <p className="text-sm text-slate-600">{userInfo.email}</p>}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button onClick={testAccess} variant="outline">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    验证登录状态
                  </Button>
                  <Button onClick={handleLogout} variant="destructive">
                    退出登录
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>未登录</AlertTitle>
                  <AlertDescription>
                    请使用飞书账号登录以访问你的多维表
                  </AlertDescription>
                </Alert>

                <Button onClick={handleFeishuLogin} size="lg" className="w-full">
                  <Lock className="h-5 w-5 mr-2" />
                  使用飞书账号登录
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 说明 */}
        <Card>
          <CardHeader>
            <CardTitle>为什么需要登录？</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <strong>问题：</strong>企业自建应用无法直接访问你个人创建的多维表，即使有正确的 App Token 和权限。
            </p>
            <p className="text-sm">
              <strong>解决：</strong>通过飞书 OAuth 授权登录，系统可以使用你的身份访问你的多维表。
            </p>
            <p className="text-sm">
              <strong>优势：</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>访问所有你创建的多维表</li>
              <li>使用你的权限和设置</li>
              <li>无需额外的授权配置</li>
            </ul>
          </CardContent>
        </Card>

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
            <Button variant="outline" onClick={() => window.open('/feishu-config-manager', '_blank')}>
              配置管理
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
