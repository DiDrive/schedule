'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Lock, QrCode, AlertCircle, Settings, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    QRLogin?: (options: any) => any;
  }
}

export default function FeishuOAuthPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isScriptLoading, setIsScriptLoading] = useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [appId, setAppId] = useState('cli_a90f3ef5a393900b');
  const [qrCodeShown, setQrCodeShown] = useState(false);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const handleMessageRef = useRef<((event: MessageEvent) => void) | null>(null);
  const qrLoginObjRef = useRef<any>(null);

  useEffect(() => {
    // 加载飞书二维码 SDK
    loadFeishuScript();

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

    // 从 localStorage 读取配置
    const savedConfig = localStorage.getItem('feishu-config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.appId) {
          setAppId(config.appId);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }

    return () => {
      // 清理消息监听器
      if (handleMessageRef.current) {
        window.removeEventListener('message', handleMessageRef.current);
      }
    };
  }, []);

  // 当 qrCodeShown 变为 true 时，生成二维码
  useEffect(() => {
    if (qrCodeShown && qrCodeRef.current && isScriptLoaded && appId) {
      generateQrCode();
    }
  }, [qrCodeShown, isScriptLoaded, appId]);

  const loadFeishuScript = () => {
    setIsScriptLoading(true);

    // 检查是否已经加载
    if (window.QRLogin) {
      setIsScriptLoaded(true);
      setIsScriptLoading(false);
      return;
    }

    // 动态加载飞书二维码 SDK
    const script = document.createElement('script');
    script.src = 'https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js';
    script.async = true;
    script.onload = () => {
      console.log('[飞书 SDK] 加载成功');
      setIsScriptLoaded(true);
      setIsScriptLoading(false);
    };
    script.onerror = () => {
      console.error('[飞书 SDK] 加载失败');
      setIsScriptLoaded(false);
      setIsScriptLoading(false);
    };

    document.head.appendChild(script);
  };

  const generateQrCode = () => {
    const container = qrCodeRef.current;
    if (!container) {
      console.error('[飞书登录] 未找到二维码容器');
      return;
    }

    // 清空容器
    container.innerHTML = '';

    const state = Date.now().toString();
    const redirectUri = `${window.location.origin}/feishu-oauth-callback`;
    const goto = `https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;

    console.log('[飞书登录] App ID:', appId);
    console.log('[飞书登录] 授权地址:', goto);

    try {
      console.log('[飞书登录] 开始生成二维码...');

      const QRLoginObj = window.QRLogin!({
        id: 'feishu_qr_container',
        goto: goto,
        width: '500',
        height: '500',
        style: 'width:500px;height:600px',
      });

      qrLoginObjRef.current = QRLoginObj;

      console.log('[飞书登录] 二维码对象创建成功:', QRLoginObj);

      // 监听扫码事件
      const handleMessage = (event: MessageEvent) => {
        console.log('[飞书登录] 扫码事件:', event);

        // 使用 SDK 提供的方法验证消息来源
        if (QRLoginObj.matchOrigin(event.origin) && QRLoginObj.matchData(event.data)) {
          const tmpCode = event.data.tmp_code;
          console.log('[飞书登录] 扫码成功，临时码:', tmpCode);

          // 跳转到授权页面
          window.location.href = `${goto}&tmp_code=${tmpCode}`;
        }
      };

      handleMessageRef.current = handleMessage;
      window.addEventListener('message', handleMessage);

      setQrCodeLoading(false);
      console.log('[飞书登录] 二维码生成完成');
    } catch (error) {
      console.error('[飞书登录] 生成二维码失败:', error);
      alert(`生成二维码失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setQrCodeLoading(false);
      setQrCodeShown(false);
    }
  };

  const showQrCode = () => {
    if (!window.QRLogin) {
      alert('飞书 SDK 未加载，请刷新页面重试');
      return;
    }

    if (!appId) {
      alert('请先配置 App ID');
      setShowConfig(true);
      return;
    }

    setQrCodeLoading(true);
    setQrCodeShown(true);
  };

  const hideQrCode = () => {
    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = '';
    }
    if (handleMessageRef.current) {
      window.removeEventListener('message', handleMessageRef.current);
      handleMessageRef.current = null;
    }
    qrLoginObjRef.current = null;
    setQrCodeShown(false);
    setQrCodeLoading(false);
  };

  const exchangeCodeForToken = async (code: string, state: string) => {
    try {
      console.log('[飞书登录] 正在交换授权码换取令牌...');

      const response = await fetch('/api/feishu/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取访问令牌失败');
      }

      console.log('[飞书登录] 访问令牌获取成功');

      // 保存访问令牌
      localStorage.setItem('feishu-user-token', data.access_token);

      // 获取用户信息
      await fetchUserInfo(data.access_token);

      setAccessToken(data.access_token);
      setIsLoggedIn(true);
      hideQrCode();

    } catch (error) {
      console.error('[飞书登录] 获取访问令牌失败:', error);
      alert(`登录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      hideQrCode();
    }
  };

  const fetchUserInfo = async (token: string) => {
    try {
      const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.code === 0) {
        setUserInfo(data.data);
        localStorage.setItem('feishu-user-info', JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('[飞书登录] 获取用户信息失败:', error);
    }
  };

  const handleSaveConfig = () => {
    // 更新飞书配置
    const savedConfig = localStorage.getItem('feishu-config');
    let config = {};

    if (savedConfig) {
      try {
        config = JSON.parse(savedConfig);
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }

    // 更新 App ID
    config = { ...config, appId };
    localStorage.setItem('feishu-config', JSON.stringify(config));

    setShowConfig(false);
    alert('App ID 已保存');
  };

  const handleLogout = () => {
    localStorage.removeItem('feishu-user-token');
    localStorage.removeItem('feishu-user-info');
    setAccessToken(null);
    setUserInfo(null);
    setIsLoggedIn(false);
    hideQrCode();
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
            飞书扫码登录
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            使用飞书扫码登录，访问你的个人多维表
          </p>
        </div>

        {/* App ID 配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>App ID 配置</span>
              <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
                {showConfig ? <XCircle className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              </Button>
            </CardTitle>
            <CardDescription>
              当前使用的 App ID: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{appId}</code>
            </CardDescription>
          </CardHeader>
          {showConfig && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appIdInput">App ID</Label>
                <Input
                  id="appIdInput"
                  placeholder="cli_axxxxxxxxx"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveConfig}>
                保存配置
              </Button>
            </CardContent>
          )}
        </Card>

        {/* SDK 加载状态 */}
        {isScriptLoading && (
          <Alert>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertTitle>加载中</AlertTitle>
            <AlertDescription>
              正在加载飞书 SDK...
            </AlertDescription>
          </Alert>
        )}

        {!isScriptLoading && !isScriptLoaded && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>SDK 加载失败</AlertTitle>
            <AlertDescription>
              飞书 SDK 加载失败，请刷新页面重试
            </AlertDescription>
          </Alert>
        )}

        {/* 二维码显示区域 */}
        {qrCodeShown && (
          <Card>
            <CardHeader>
              <CardTitle>扫码登录</CardTitle>
              <CardDescription>
                请使用飞书 App 扫描二维码登录
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                {qrCodeLoading ? (
                  <div className="flex flex-col items-center space-y-4 py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">正在生成二维码...</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-lg p-4">
                    <div id="feishu_qr_container" ref={qrCodeRef}></div>
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <Button onClick={hideQrCode} variant="outline">
                  取消扫码
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                    请使用飞书扫码登录以访问你的多维表
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={showQrCode}
                  size="lg"
                  className="w-full"
                  disabled={!isScriptLoaded}
                >
                  <QrCode className="h-5 w-5 mr-2" />
                  生成扫码登录二维码
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
              <strong>解决：</strong>通过飞书扫码登录授权，系统可以使用你的身份访问你的多维表。
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
            <Button variant="outline" onClick={() => window.open('/feishu-user-token-test', '_blank')}>
              测试个人表
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
