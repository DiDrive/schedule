'use client';

import { useState, useEffect } from 'react';
import FeishuConnectionDiagnostic from '@/components/feishu-connection-diagnostic';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, AlertCircle, X, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function FeishuDiagnosticPage() {
  const [showConfigHint, setShowConfigHint] = useState(false);

  // 检查是否有配置
  useEffect(() => {
    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      setShowConfigHint(true);
    }
  }, []);

  const handleOpenConfig = () => {
    // 保存当前页面，然后跳转到首页
    sessionStorage.setItem('return-to-diagnostic', 'true');
    window.open('/', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  飞书连接诊断
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  逐步测试飞书连接，帮助定位问题
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleOpenConfig}
            >
              <Settings className="h-4 w-4 mr-2" />
              打开配置
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/feishu-quick-test', '_blank')}
            >
              <Activity className="h-4 w-4 mr-2" />
              快速测试
            </Button>
          </div>
        </div>
      </div>

      {/* 配置提示 */}
      {showConfigHint && (
        <div className="container mx-auto px-4 py-4">
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                    需要先配置飞书集成信息
                  </h3>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mb-3">
                    系统未找到飞书配置，请先配置飞书集成信息后再运行诊断。
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenConfig}
                    >
                      前往配置
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowConfigHint(false)}
                    >
                      忽略
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => setShowConfigHint(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <FeishuConnectionDiagnostic />
        </div>
      </div>
    </div>
  );
}
