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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
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
          <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" />
              <span>自动切换：将任务分配给其他空闲的同类资源</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock4 className="h-4 w-4 text-orange-500" />
              <span>延期等待：调整任务开始时间，等待指定人员</span>
            </div>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {Array.from(conflicts.entries()).map(([resourceId, conflictTasks]) => (
              <div key={resourceId} className="border-2 rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800/50">
                {/* 资源标题栏 */}
                <div className="px-5 py-4 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/20">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-white">{conflictTasks[0].resourceName}</h3>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0">
                      {conflictTasks.length} 个任务冲突
                    </Badge>
                  </div>
                </div>

                {/* 任务卡片列表 */}
                <div className="p-5 space-y-4">
                  {conflictTasks.map((conflictTask, index) => {
                    const resolution = resolutions.get(conflictTask.task.id);
                    return (
                      <div
                        key={conflictTask.task.id}
                        className="border-2 rounded-xl p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-6">
                          {/* 任务信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <Badge variant="outline" className="font-semibold">
                                任务 {index + 1}
                              </Badge>
                              <h4 className="font-bold text-lg">{conflictTask.task.name}</h4>
                              {conflictTask.task.taskType && (
                                <Badge variant="secondary" className="font-medium">
                                  {conflictTask.task.taskType}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-6 text-sm">
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">
                                  {conflictTask.startTime.toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="font-medium">
                                  {conflictTask.endTime.toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                  预估工时
                                </span>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                  {conflictTask.task.estimatedHours}h
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex flex-shrink-0 gap-2.5 items-center">
                            <Button
                              variant={resolution === 'switch' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleToggleResolution(conflictTask.task.id)}
                              className={resolution === 'switch' 
                                ? 'bg-blue-600 hover:bg-blue-700 border-blue-700 h-9' 
                                : 'border-2 hover:border-blue-300 h-9'
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
                                ? 'bg-orange-600 hover:bg-orange-700 border-orange-700 h-9'
                                : 'border-2 hover:border-orange-300 h-9'
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
              已选择 <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{resolutions.size}</span> / <span className="font-bold text-lg">{Array.from(conflicts.values()).flat().length}</span> 个任务
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={handleCancel} className="min-w-[100px]">
                取消
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={!allTasksResolved()} 
                size="lg"
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
