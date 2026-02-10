'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Table2, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  ArrowLeft,
  Database
} from 'lucide-react';

interface BitableApp {
  app_token: string;
  name: string;
  url: string;
  icon: {
    token: string;
  };
  avatar: {
    access_token: string;
  };
}

interface ApiResponse {
  code: number;
  msg: string;
  data?: {
    items: BitableApp[];
    total: number;
    has_more: boolean;
  };
}

export default function BitableAppsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<BitableApp[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('feishu-user-token');
      setIsLoggedIn(!!token);
      if (token) {
        loadApps();
      } else {
        setError('未登录，请先使用飞书扫码登录');
        setIsLoading(false);
      }
    }
  };

  const loadApps = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 从 localStorage 获取用户令牌
      const userToken = typeof window !== 'undefined' ? localStorage.getItem('feishu-user-token') : null;

      if (!userToken) {
        setError('未登录，请先使用飞书扫码登录');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/feishu/user/bitable-apps', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
      });

      const data: ApiResponse = await response.json();

      if (response.ok && data.code === 0) {
        setApps(data.data?.items || []);
        setTotal(data.data?.total || 0);
      } else {
        setError(data.msg || '获取多维表列表失败');
        if (data.code === 401) {
          setIsLoggedIn(false);
        }
      }
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadApps();
  };

  const handleGoToLogin = () => {
    router.push('/feishu-oauth');
  };

  const getAvatarUrl = (app: BitableApp) => {
    if (app.avatar?.access_token) {
      return `https://open.feishu.cn/open-apis/drive/v1/avatars/${app.avatar.access_token}/view`;
    }
    if (app.icon?.token) {
      return `https://open.feishu.cn/open-apis/drive/v1/avatars/${app.icon.token}/view`;
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Database className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                我的飞书多维表
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                查看和管理您的多维表应用
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </div>

        {/* 登录状态提示 */}
        {!isLoggedIn && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>未登录</AlertTitle>
            <AlertDescription className="mt-2">
              请先使用飞书扫码登录，才能访问您的多维表。
              <Button
                variant="link"
                className="p-0 h-auto ml-2"
                onClick={handleGoToLogin}
              >
                去登录 →
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 统计信息 */}
        {isLoggedIn && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  总数量
                </CardTitle>
                <Table2 className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
                <p className="text-xs text-slate-500 mt-1">
                  可访问的多维表
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  登录状态
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">已登录</div>
                <p className="text-xs text-slate-500 mt-1">
                  飞书账号已授权
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  操作
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  刷新列表
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>获取失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">
                  正在加载多维表列表...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 多维表列表 */}
        {!isLoading && !error && apps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5" />
                多维表应用列表
              </CardTitle>
              <CardDescription>
                共 {total} 个多维表
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">图标</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>应用 Token</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app) => (
                    <TableRow key={app.app_token}>
                      <TableCell>
                        {getAvatarUrl(app) ? (
                          <img
                            src={getAvatarUrl(app)}
                            alt={app.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Table2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {app.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {app.app_token}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(app.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {!isLoading && !error && apps.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Table2 className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                暂无多维表
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center">
                您还没有可访问的多维表，或者需要管理员授予您访问权限。
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
