'use client';

import { useEffect } from 'react';

export default function FeishuOAuthCallbackPage() {
  useEffect(() => {
    // 从 URL 获取 code 和 state
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    console.log('[飞书 OAuth 回调] 接收到重定向');
    console.log('[飞书 OAuth 回调] Code:', code);
    console.log('[飞书 OAuth 回调] State:', state);

    if (code) {
      // 通知主窗口
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'feishu_oauth_code',
            code,
            state,
          },
          window.location.origin
        );
        console.log('[飞书 OAuth 回调] 已通知主窗口');
      } else {
        console.error('[飞书 OAuth 回调] 未找到主窗口');
      }

      // 关闭当前窗口
      window.close();
    } else {
      console.error('[飞书 OAuth 回调] 未收到授权码');
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'feishu_oauth_error',
            error: '未收到授权码',
          },
          window.location.origin
        );
      }
      window.close();
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          正在处理授权...
        </p>
      </div>
    </div>
  );
}
