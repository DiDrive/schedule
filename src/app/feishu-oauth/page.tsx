'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Lock, QrCode, AlertCircle, Settings, RefreshCw, Bug } from 'lucide-react';

declare global {
  interface Window {
    QRLogin?: (options: any) => any;
  }
}

function FeishuOAuthContent() {
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isScriptLoading, setIsScriptLoading] = useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [appId, setAppId] = useState('cli_a90f3ef5a393900b'); // 使用原始 App ID
  const [qrCodeShown, setQrCodeShown] = useState(false);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);
  const [origin, setOrigin] = useState(''); // 用于存储 window.location.origin
  const [manualCode, setManualCode] = useState(''); // 手动输入授权码
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const qrLoginObjRef = useRef<any>(null);
  const generateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 在客户端获取 origin
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    // 加载飞书二维码 SDK
    loadFeishuScript();

    // 检查是否已经登录
    const storedToken = localStorage.getItem('feishu-user-token');
    const storedUserInfo = localStorage.getItem('feishu-user-info');

    if (storedToken) {
      setAccessToken(storedToken);
      setIsLoggedIn(true);
      addDebugInfo('✅ 已检测到用户令牌');
    }
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
      addDebugInfo('✅ 已加载用户信息');
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

    // 处理从回调页面跳转回来的情况
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      addDebugInfo(`❌ OAuth 回调错误: ${error}`);
      alert(`登录失败: ${error}`);
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname);
    } else if (code === 'true') {
      // 从 localStorage 获取实际的 code 和 state
      const actualCode = localStorage.getItem('feishu-oauth-code');
      const state = localStorage.getItem('feishu-oauth-state');

      if (actualCode && state) {
        addDebugInfo('✅ 从回调页面获取到授权码');
        exchangeCodeForToken(actualCode, state);

        // 清除临时存储
        localStorage.removeItem('feishu-oauth-code');
        localStorage.removeItem('feishu-oauth-state');

        // 清除 URL 参数
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        addDebugInfo('❌ 未找到授权码，可能回调页面未正确执行');
      }
    } else if (code) {
      // 直接从 URL 获取 code（备用方案）
      addDebugInfo('✅ 直接从 URL 获取到授权码');
      const state = searchParams.get('state') || '';
      exchangeCodeForToken(code, state);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // 监听 qrCodeShown 变化
  useEffect(() => {
    if (qrCodeShown) {
      addDebugInfo('qrCodeShown 变为 true，等待 DOM 渲染...');

      // 使用 requestAnimationFrame 确保在下一帧执行
      requestAnimationFrame(() => {
        addDebugInfo(`requestAnimationFrame: qrCodeRef.current = ${!!qrCodeRef.current}`);

        if (qrCodeRef.current) {
          addDebugInfo('✅ 容器已存在，开始生成二维码');
          generateQrCode();
        } else {
          addDebugInfo('❌ requestAnimationFrame 后容器仍不存在，尝试延迟执行');

          // 再尝试一次，延迟 200ms
          setTimeout(() => {
            if (qrCodeRef.current) {
              addDebugInfo('✅ 延迟后容器已存在，开始生成二维码');
              generateQrCode();
            } else {
              addDebugInfo('❌ 延迟 200ms 后容器仍然不存在');
              setQrCodeError('二维码容器无法创建');
              setQrCodeLoading(false);
            }
          }, 200);
        }
      });
    }
  }, [qrCodeShown, isScriptLoaded, appId]);

  const addDebugInfo = (info: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => {
      const newInfo = [...prev, { time: timestamp, message: info }];
      console.log(`[飞书登录 ${timestamp}] ${info}`);
      return newInfo.slice(-50); // 只保留最近50条
    });
  };

  const loadFeishuScript = () => {
    setIsScriptLoading(true);
    addDebugInfo('开始加载飞书 SDK...');

    // 检查是否已经加载
    if (window.QRLogin) {
      addDebugInfo('✅ SDK 已加载');
      setIsScriptLoaded(true);
      setIsScriptLoading(false);
      return;
    }

    // 动态加载飞书二维码 SDK
    const script = document.createElement('script');
    script.src = 'https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js';
    script.async = true;
    script.onload = () => {
      addDebugInfo('✅ SDK 加载成功');
      setIsScriptLoaded(true);
      setIsScriptLoading(false);
    };
    script.onerror = () => {
      addDebugInfo('❌ SDK 加载失败');
      setIsScriptLoaded(false);
      setIsScriptLoading(false);
    };

    document.head.appendChild(script);
  };

  const generateQrCode = () => {
    addDebugInfo('generateQrCode 函数开始执行');

    const container = qrCodeRef.current;
    if (!container) {
      addDebugInfo('❌ 未找到二维码容器');
      setQrCodeError('未找到二维码容器');
      setQrCodeLoading(false);
      return;
    }

    addDebugInfo('✅ 找到二维码容器');

    // 清空容器
    container.innerHTML = '';
    setQrCodeError(null);

    const state = Date.now().toString();
    const redirectUri = `${origin || window.location.origin}/feishu-oauth-callback`;
    const goto = `https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;

    addDebugInfo(`App ID: ${appId}`);
    addDebugInfo(`Redirect URI: ${redirectUri}`);
    addDebugInfo(`State: ${state}`);

    if (!window.QRLogin) {
      addDebugInfo('❌ QRLogin 函数不存在');
      setQrCodeError('飞书 SDK 未正确加载');
      setQrCodeLoading(false);
      return;
    }

    try {
      addDebugInfo('开始调用 window.QRLogin...');

      // 设置超时
      generateTimeoutRef.current = setTimeout(() => {
        addDebugInfo('❌ 生成二维码超时（10秒）');
        setQrCodeError('生成二维码超时');
        setQrCodeLoading(false);
      }, 10000);

      const QRLoginObj = window.QRLogin({
        id: 'feishu_qr_container',
        goto: goto,
        width: '500',
        height: '500',
        style: 'width:500px;height:600px',
      });

      addDebugInfo('✅ window.QRLogin 调用完成');

      // 清除超时
      if (generateTimeoutRef.current) {
        clearTimeout(generateTimeoutRef.current);
        generateTimeoutRef.current = null;
      }

      qrLoginObjRef.current = QRLoginObj;

      // 立即检查容器
      addDebugInfo(`容器当前子元素数: ${container.children.length}`);

      // 2秒后再次检查
      setTimeout(() => {
        const childCount = container?.children.length || 0;
        addDebugInfo(`2秒后容器子元素数: ${childCount}`);

        if (container && container.children.length === 0) {
          addDebugInfo('❌ 二维码容器仍然为空');
          setQrCodeError('二维码生成失败');
          setQrCodeLoading(false);
        } else {
          addDebugInfo('✅ 二维码已生成');
          setQrCodeLoading(false);
        }
      }, 2000);

      // 不需要监听 message 事件
      // 扫码成功后，飞书会自动跳转到回调页面
      addDebugInfo('✅ 二维码生成完成，等待用户扫码...');

    } catch (error) {
      addDebugInfo(`❌ 生成二维码异常: ${error instanceof Error ? error.message : String(error)}`);
      setQrCodeError(`生成二维码失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setQrCodeLoading(false);
      if (generateTimeoutRef.current) {
        clearTimeout(generateTimeoutRef.current);
      }
    }
  };

  const showQrCode = () => {
    addDebugInfo('showQrCode 函数被调用');

    if (!window.QRLogin) {
      alert('飞书 SDK 未加载，请刷新页面重试');
      return;
    }

    if (!appId) {
      alert('请先配置 App ID');
      setShowConfig(true);
      return;
    }

    setDebugInfo([]);
    setQrCodeLoading(true);
    setQrCodeError(null);
    setQrCodeShown(true);
  };

  const hideQrCode = () => {
    addDebugInfo('hideQrCode 函数被调用');
    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = '';
    }
    qrLoginObjRef.current = null;
    setQrCodeShown(false);
    setQrCodeLoading(false);
    setQrCodeError(null);
  };

  const exchangeCodeForToken = async (code: string, state: string) => {
    try {
      addDebugInfo('开始交换授权码换取令牌...');
      addDebugInfo(`Code: ${code.substring(0, 10)}...`);
      addDebugInfo(`State: ${state}`);

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

      addDebugInfo('✅ 访问令牌获取成功');

      localStorage.setItem('feishu-user-token', data.access_token);
      await fetchUserInfo(data.access_token);

      setAccessToken(data.access_token);
      setIsLoggedIn(true);
      hideQrCode();

    } catch (error) {
      addDebugInfo(`❌ 获取访问令牌失败: ${error instanceof Error ? error.message : String(error)}`);
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
        addDebugInfo(`✅ 用户信息获取成功: ${data.data.name}`);
      }
    } catch (error) {
      console.error('[飞书登录] 获取用户信息失败:', error);
    }
  };

  const handleManualLogin = async () => {
    if (!manualCode) {
      alert('请输入授权码');
      return;
    }
    exchangeCodeForToken(manualCode, Date.now().toString());
    setManualCode('');
  };

  const handleSaveConfig = () => {
    const savedConfig = localStorage.getItem('feishu-config');
    let config = {};

    if (savedConfig) {
      try {
        config = JSON.parse(savedConfig);
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }

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

        {/* 调试信息 */}
        {debugInfo.length > 0 && (
          <Card className="border-blue-300 dark:border-blue-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                <span className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  调试日志
                </span>
                <Button variant="outline" size="sm" onClick={() => setDebugInfo([])}>
                  清除日志
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto space-y-1 text-xs font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                {debugInfo.map((info, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-slate-500 shrink-0">[{info.time}]</span>
                    <span className={
                      info.message.includes('❌') ? 'text-red-600 dark:text-red-400' :
                      info.message.includes('✅') ? 'text-green-600 dark:text-green-400' :
                      'text-slate-700 dark:text-slate-300'
                    }>
                      {info.message}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                <p className="text-xs text-slate-500">
                  请输入正确的飞书应用 App ID。可以从飞书开放平台获取。
                </p>
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

        {/* 手动输入授权码（备用方案） */}
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5 inline-block mr-2" />
              手动输入授权码（备用方案）
            </CardTitle>
            <CardDescription>
              如果扫码后没有自动跳转，可以从飞书开放平台复制授权码手动输入
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manualCode">授权码</Label>
              <Input
                id="manualCode"
                placeholder="请从飞书开放平台复制授权码"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                如果扫码后卡住，请检查飞书开放平台的"重定向 URL"配置是否正确
              </p>
            </div>
            <Button onClick={handleManualLogin} variant="outline">
              <QrCode className="h-4 w-4 mr-2" />
              手动登录
            </Button>
          </CardContent>
        </Card>

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
                <div className="relative">
                  {/* 容器始终渲染，加载状态覆盖在上面 */}
                  <div className="bg-white rounded-lg shadow-lg p-4">
                    <div id="feishu_qr_container" ref={qrCodeRef}></div>
                  </div>

                  {/* 加载状态覆盖 */}
                  {qrCodeLoading && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-lg">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">正在生成二维码...</p>
                    </div>
                  )}

                  {/* 错误状态覆盖 */}
                  {qrCodeError && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-lg p-8">
                      <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
                      <p className="text-sm text-red-600 text-center">{qrCodeError}</p>
                    </div>
                  )}
                </div>
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

        {/* 重要提示 */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误码 4401 说明</AlertTitle>
          <AlertDescription>
            如果看到错误码 4401，通常是以下原因之一：
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>App ID 不正确或应用不存在</li>
              <li>飞书开放平台未配置回调地址</li>
              <li>应用未启用或已被禁用</li>
            </ul>
            请在飞书开放平台检查应用配置，确保：
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>回调地址设置为：<code>{origin}/feishu-oauth-callback</code></li>
              <li>应用已启用且有正确的权限</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

export default function FeishuOAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <FeishuOAuthContent />
    </Suspense>
  );
}
