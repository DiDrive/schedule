'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FeishuOAuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在处理授权...');
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // 从 URL 获取授权码
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (!code) {
        setStatus('error');
        setMessage('未收到授权码，请重新登录');
        return;
      }

      setStatus('loading');
      setMessage('正在获取访问令牌...');

      // 调用后端 API，用授权码换取 access_token
      const response = await fetch('/api/feishu/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取访问令牌失败');
      }

      setStatus('loading');
      setMessage('正在获取用户信息...');

      // 使用 access_token 获取用户信息
      const userInfoResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const userInfoData = await userInfoResponse.json();

      if (userInfoData.code === 0) {
        // 保存用户信息和 token
        localStorage.setItem('feishu-user-token', data.access_token);
        localStorage.setItem('feishu-user-info', JSON.stringify(userInfoData.data));

        setUserInfo(userInfoData.data);
        setStatus('success');
        setMessage('登录成功！');
      } else {
        setStatus('error');
        setMessage(`获取用户信息失败：${userInfoData.msg}`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '授权失败，请重试');
    }
  };

  const handleGoToSystem = () => {
    window.location.href = '/?tab=feishu';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8 flex items-center justify-center">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="h-6 w-6 text-green-600" />}
              {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
              飞书授权
            </CardTitle>
            <CardDescription className="text-center">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'loading' && (
              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  请稍候，正在处理授权...
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>授权成功</AlertTitle>
                  <AlertDescription>
                    {userInfo && (
                      <div className="mt-2">
                        <p className="font-medium">{userInfo.name}</p>
                        {userInfo.email && <p className="text-sm text-slate-600">{userInfo.email}</p>}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>

                <Button onClick={handleGoToSystem} className="w-full">
                  进入系统
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>授权失败</AlertTitle>
                  <AlertDescription>
                    {message}
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    onClick={() => window.location.href = '/feishu-oauth'}
                    variant="outline"
                    className="flex-1"
                  >
                    重试
                  </Button>
                  <Button
                    onClick={handleGoToSystem}
                    className="flex-1"
                  >
                    返回系统
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
