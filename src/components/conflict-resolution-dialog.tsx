'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, User, Clock, ArrowRightLeft, Clock4 } from 'lucide-react';
import { ConflictTask } from '@/types/schedule';

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolutions: Map<string, 'switch' | 'delay'>) => void;
  conflicts: Map<string, ConflictTask[]>;
}

export function ConflictResolutionDialog({
  isOpen,
  onClose,
  onConfirm,
  conflicts,
}: ConflictResolutionDialogProps) {
  // 为每个任务存储用户的选择
  const [resolutions, setResolutions] = useState<Map<string, 'switch' | 'delay'>>(new Map());

  const handleToggleResolution = (taskId: string) => {
    const newResolutions = new Map(resolutions);
    const current = newResolutions.get(taskId);
    newResolutions.set(taskId, current === 'switch' ? 'delay' : 'switch');
    setResolutions(newResolutions);
  };

  const allTasksResolved = () => {
    const totalTasks = Array.from(conflicts.values()).flat().length;
    return resolutions.size === totalTasks;
  };

  const handleConfirm = () => {
    onConfirm(resolutions);
    onClose();
  };

  const handleCancel = () => {
    setResolutions(new Map());
    onClose();
  };

  if (conflicts.size === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            资源冲突处理
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            检测到 {conflicts.size} 个资源存在时间冲突，需要为每个任务选择处理方式
          </DialogDescription>
        </DialogHeader>

        {/* 图例说明 */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/50 border-b">
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-slate-700 dark:text-slate-300">自动切换：将任务分配给其他空闲的同类资源</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-orange-100 dark:bg-orange-900/30">
                <Clock4 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-slate-700 dark:text-slate-300">延期等待：调整任务开始时间，等待指定人员</span>
            </div>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-6">
            {Array.from(conflicts.entries()).map(([resourceId, conflictTasks]) => (
              <div key={resourceId} className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {/* 资源标题栏 */}
                <div className="px-5 py-3 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-base">{conflictTasks[0].resourceName}</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {conflictTasks.length} 个任务
                    </Badge>
                  </div>
                </div>

                {/* 任务卡片列表 */}
                <div className="p-4 space-y-3">
                  {conflictTasks.map((conflictTask, index) => {
                    const resolution = resolutions.get(conflictTask.task.id);
                    return (
                      <div
                        key={conflictTask.task.id}
                        className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50"
                      >
                        {/* 第一行：任务信息 */}
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                          <Badge variant="outline" className="w-20 justify-center font-semibold">
                            任务 {index + 1}
                          </Badge>
                          <h4 className="font-bold text-base flex-1">{conflictTask.task.name}</h4>
                          {conflictTask.task.taskType && (
                            <Badge variant="secondary">
                              {conflictTask.task.taskType}
                            </Badge>
                          )}
                        </div>

                        {/* 第二行：时间信息和操作按钮 */}
                        <div className="flex items-center justify-between gap-6">
                          {/* 时间信息 */}
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                              <Clock className="h-4 w-4" />
                              <span>
                                {conflictTask.startTime.toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                <span className="mx-2 text-slate-400">→</span>
                                {conflictTask.endTime.toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                              <span className="text-xs text-slate-600 dark:text-slate-300">
                                预估工时
                              </span>
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {conflictTask.task.estimatedHours}h
                              </span>
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex flex-shrink-0 gap-2">
                            <Button
                              variant={resolution === 'switch' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleToggleResolution(conflictTask.task.id)}
                              className={resolution === 'switch' 
                                ? 'bg-blue-600 hover:bg-blue-700 h-8' 
                                : 'border-2 hover:border-blue-300 h-8'
                              }
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                              <span className="font-medium text-xs">自动切换</span>
                            </Button>
                            <Button
                              variant={resolution === 'delay' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleToggleResolution(conflictTask.task.id)}
                              className={resolution === 'delay'
                                ? 'bg-orange-600 hover:bg-orange-700 h-8'
                                : 'border-2 hover:border-orange-300 h-8'
                              }
                            >
                              <Clock4 className="h-3.5 w-3.5 mr-1.5" />
                              <span className="font-medium text-xs">延期等待</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部操作栏 */}
        <DialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900/50">
          <div className="flex w-full items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              已选择 <span className="font-bold text-base text-blue-600 dark:text-blue-400">{resolutions.size}</span> / <span className="font-bold text-base">{Array.from(conflicts.values()).flat().length}</span> 个任务
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="default" onClick={handleCancel} className="min-w-[100px]">
                取消
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={!allTasksResolved()} 
                size="default"
                className="min-w-[140px]"
              >
                应用处理方案
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
