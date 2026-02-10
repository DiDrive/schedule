'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FeishuOAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // 从 URL 获取 code 和 state
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    console.log('[飞书 OAuth 回调] URL 参数:', {
      code: code ? '已接收' : '无',
      state,
      error
    });

    if (error) {
      console.error('[飞书 OAuth 回调] 错误:', error);
      // 保存错误信息到 localStorage
      localStorage.setItem('feishu-oauth-error', error);
      router.push('/feishu-oauth?error=' + encodeURIComponent(error));
      return;
    }

    if (code) {
      console.log('[飞书 OAuth 回调] 接收到授权码');

      // 保存 code 和 state 到 localStorage
      localStorage.setItem('feishu-oauth-code', code);
      localStorage.setItem('feishu-oauth-state', state || '');

      // 跳转回登录页面处理
      router.push('/feishu-oauth?code_received=true');
    } else {
      console.error('[飞书 OAuth 回调] 未收到授权码');
      const errorMsg = '未收到授权码';
      localStorage.setItem('feishu-oauth-error', errorMsg);
      router.push('/feishu-oauth?error=' + encodeURIComponent(errorMsg));
    }
  }, [router]);

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
