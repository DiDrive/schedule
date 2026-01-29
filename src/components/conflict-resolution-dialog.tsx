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
import { AlertTriangle, User, Clock } from 'lucide-react';
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            资源冲突处理
          </DialogTitle>
          <DialogDescription>
            检测到 {conflicts.size} 个资源存在时间冲突，请为每个任务选择处理方式
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {Array.from(conflicts.entries()).map(([resourceId, conflictTasks]) => (
            <div key={resourceId} className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-lg">{conflictTasks[0].resourceName}</h3>
                <Badge variant="destructive">{conflictTasks.length} 个任务冲突</Badge>
              </div>

              <div className="space-y-3">
                {conflictTasks.map((conflictTask, index) => {
                  const resolution = resolutions.get(conflictTask.task.id);
                  return (
                    <div
                      key={conflictTask.task.id}
                      className="border rounded-lg p-3 bg-white dark:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              任务 {index + 1}
                            </Badge>
                            <span className="font-medium">{conflictTask.task.name}</span>
                            {conflictTask.task.taskType && (
                              <Badge variant="secondary" className="text-xs">
                                {conflictTask.task.taskType}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Clock className="h-4 w-4" />
                            <span>
                              {conflictTask.startTime.toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {conflictTask.endTime.toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>({conflictTask.task.estimatedHours}h)</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant={resolution === 'switch' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleToggleResolution(conflictTask.task.id)}
                            className="min-w-[120px]"
                          >
                            <span className="text-xs font-medium">自动切换空闲资源</span>
                          </Button>
                          <Button
                            variant={resolution === 'delay' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleToggleResolution(conflictTask.task.id)}
                            className="min-w-[120px]"
                          >
                            <span className="text-xs font-medium">延期等待指定人员</span>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!allTasksResolved()}>
            应用（{resolutions.size}/{Array.from(conflicts.values()).flat().length} 已选择）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
