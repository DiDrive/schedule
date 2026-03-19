'use client';

import { Loader2, Database, CloudUpload, CheckCircle, AlertCircle } from 'lucide-react';

interface SyncLoadingOverlayProps {
  isVisible: boolean;
  progress?: {
    current: number;
    total: number;
    currentPhase?: string;
  };
  message?: string;
}

export function SyncLoadingOverlay({ isVisible, progress, message }: SyncLoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center space-y-6">
          {/* 动画图标 */}
          <div className="relative">
            <div className="absolute inset-0 animate-ping opacity-20">
              <CloudUpload className="h-16 w-16 text-blue-500" />
            </div>
            <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
          </div>

          {/* 标题 */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              正在同步数据
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              请勿刷新页面或进行其他操作
            </p>
          </div>

          {/* 进度信息 */}
          {progress && (
            <div className="w-full space-y-3">
              {/* 进度条 */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%` }}
                />
              </div>

              {/* 进度文字 */}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {progress.currentPhase || '处理中...'}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {progress.current} / {progress.total}
                </span>
              </div>

              {/* 百分比 */}
              <div className="text-center">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* 自定义消息 */}
          {message && (
            <div className="w-full p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                {message}
              </p>
            </div>
          )}

          {/* 提示信息 */}
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <Database className="h-4 w-4" />
            <span>正在与飞书多维表同步数据</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 加载中的蒙版组件（用于从飞书加载数据）
export function LoadingOverlay({ isVisible, message }: { isVisible: boolean; message?: string }) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center space-y-6">
          {/* 动画图标 */}
          <div className="relative">
            <div className="absolute inset-0 animate-ping opacity-20">
              <Database className="h-16 w-16 text-green-500" />
            </div>
            <Loader2 className="h-16 w-16 text-green-500 animate-spin" />
          </div>

          {/* 标题 */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              {message || '正在加载数据'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              请稍候，正在从飞书获取数据...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
