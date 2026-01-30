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
import { ConflictTask, Task } from '@/types/schedule';

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
  // 优先级权重
  const priorityWeight: Record<string, number> = {
    urgent: 3,
    high: 2,
    normal: 1,
    low: 0.5,
  };

  // 计算任务得分（与autoAssignResources中的逻辑一致）
  const calculateTaskScore = (task: Task, allTasks: Task[]): number => {
    let score = 0;
    
    // 1. 被依赖数权重
    const dependentsCount = allTasks.filter(t => t.dependencies?.includes(task.id)).length;
    score += dependentsCount * 2000;
    
    // 2. 优先级权重
    score += (priorityWeight[task.priority] || 1) * 1000;
    
    // 3. 截止日期权重（越接近截止日期，分数越高）
    if (task.deadline) {
      const daysToDeadline = Math.max(0, (task.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToDeadline < 7) {
        score += (7 - daysToDeadline) * 200;
      } else if (daysToDeadline < 30) {
        score += (30 - daysToDeadline) * 50;
      }
    }
    
    // 4. 任务工时权重（小任务优先）
    score += 100 / (task.estimatedHours || 1);
    
    return score;
  };

  // 找出每个资源的最高评分任务
  const highestScoreTaskIds = new Set<string>();
  const allTasks = Array.from(conflicts.values()).flat().map(ct => ct.task);
  
  conflicts.forEach((conflictTasks) => {
    if (conflictTasks.length === 0) return;
    
    // 按评分排序，找出最高评分的任务
    const sortedTasks = [...conflictTasks].sort((a, b) => {
      const scoreA = calculateTaskScore(a.task, allTasks);
      const scoreB = calculateTaskScore(b.task, allTasks);
      return scoreB - scoreA; // 降序排列
    });
    
    // 保留最高评分的任务
    highestScoreTaskIds.add(sortedTasks[0].task.id);
  });

  // 为每个任务存储用户的选择
  const [resolutions, setResolutions] = useState<Map<string, 'switch' | 'delay'>>(() => {
    // 初始化：为最高评分的任务自动设置为"delay"（保留原资源）
    const initialResolutions = new Map<string, 'switch' | 'delay'>();
    highestScoreTaskIds.forEach(taskId => {
      initialResolutions.set(taskId, 'delay');
    });
    return initialResolutions;
  });

  const handleSetResolution = (taskId: string, resolution: 'switch' | 'delay') => {
    // 不允许切换最高评分的任务
    if (highestScoreTaskIds.has(taskId)) return;
    
    const newResolutions = new Map(resolutions);
    newResolutions.set(taskId, resolution);
    setResolutions(newResolutions);
  };

  const allTasksResolved = () => {
    // 获取当前冲突列表中的所有任务ID
    const currentConflictTaskIds = new Set(
      Array.from(conflicts.values()).flat().map(ct => ct.task.id)
    );

    // 计算需要用户选择的任务数（排除最高评分任务）
    const totalTasks = Array.from(conflicts.values()).flat().length;
    const userSelectableTasks = totalTasks - highestScoreTaskIds.size;

    // 计算用户已经选择的任务数（只计算当前冲突列表中的任务）
    const userSelectedTasks = Array.from(resolutions.entries()).filter(
      ([taskId]) => !highestScoreTaskIds.has(taskId) && currentConflictTaskIds.has(taskId)
    ).length;

    return userSelectedTasks === userSelectableTasks;
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
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2.5 text-xl">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            人员冲突处理
          </DialogTitle>
          <DialogDescription className="text-sm mt-1.5">
            检测到 {conflicts.size} 个人员存在时间冲突，需要为每个任务选择处理方式
          </DialogDescription>
        </DialogHeader>

        {/* 图例说明 */}
        <div className="px-6 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <div className="flex items-center gap-4 text-[11px] flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="p-0.5 rounded bg-blue-100 dark:bg-blue-900/30">
                <ArrowRightLeft className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-slate-700 dark:text-slate-300">自动切换：分配给其他空闲人员</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="p-0.5 rounded bg-orange-100 dark:bg-orange-900/30">
                <Clock4 className="h-3 w-3 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-slate-700 dark:text-slate-300">延期等待：调整开始时间等待</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
                <span className="text-[9px] text-white font-bold">★</span>
              </div>
              <span className="text-slate-700 dark:text-slate-300">最高优先级任务自动保留原人员</span>
            </div>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="grid gap-4">
            {Array.from(conflicts.entries()).map(([resourceId, conflictTasks]) => (
              <div key={resourceId} className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                {/* 资源标题栏 */}
                <div className="px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/30">
                      <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-sm">{conflictTasks[0].resourceName}</h3>
                    <Badge variant="secondary" className="ml-auto text-xs py-0 h-5">
                      {conflictTasks.length} 个任务
                    </Badge>
                  </div>
                </div>

                {/* 任务卡片列表 */}
                <div className="p-3 space-y-2">
                  {conflictTasks.map((conflictTask) => {
                    const resolution = resolutions.get(conflictTask.task.id);
                    const isHighestScore = highestScoreTaskIds.has(conflictTask.task.id);
                    const taskScore = calculateTaskScore(conflictTask.task, allTasks);
                    return (
                      <div
                        key={conflictTask.task.id}
                        className={`border rounded-md p-2.5 ${
                          isHighestScore 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                            : 'bg-slate-50 dark:bg-slate-800/50'
                        }`}
                      >
                        {/* 第一行：任务信息 */}
                        <div className="flex items-center gap-2.5 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700">
                          <h4 className="font-semibold text-sm flex-1">{conflictTask.task.name}</h4>
                          <div className="flex items-center gap-1.5">
                            {conflictTask.task.taskType && (
                              <Badge variant="secondary" className="text-xs py-0 h-5">
                                {conflictTask.task.taskType}
                              </Badge>
                            )}
            {isHighestScore && (
                              <Badge variant="default" className="bg-blue-600 text-xs py-0 h-5">
                                综合最高优先级
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* 第二行：时间信息和操作按钮 */}
                        <div className="flex items-center justify-between gap-6">
                          {/* 时间信息 */}
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {conflictTask.startTime.toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                <span className="mx-1 text-slate-400">→</span>
                                {conflictTask.endTime.toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                              <span className="text-xs text-slate-600 dark:text-slate-300">
                                预估工时
                              </span>
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {conflictTask.task.estimatedHours}h
                              </span>
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex flex-shrink-0 flex-col gap-1">
                            {isHighestScore ? (
                              // 最高评分任务：显示提示，禁用选择
                              <div className="h-6 w-24 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                                自动保留原人员
                              </div>
                            ) : (
                              // 其他任务：显示选择按钮
                              <>
                                <Button
                                  variant={resolution === 'switch' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handleSetResolution(conflictTask.task.id, 'switch')}
                                  className={resolution === 'switch' 
                                    ? 'bg-blue-600 hover:bg-blue-700 h-7 px-2' 
                                    : 'border hover:border-blue-300 h-7 px-2'
                                  }
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  <span className="font-medium text-xs">自动切换</span>
                                </Button>
                                <Button
                                  variant={resolution === 'delay' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handleSetResolution(conflictTask.task.id, 'delay')}
                                  className={resolution === 'delay'
                                    ? 'bg-orange-600 hover:bg-orange-700 h-7 px-2'
                                    : 'border hover:border-orange-300 h-7 px-2'
                                  }
                                >
                                  <Clock4 className="h-3 w-3 mr-1" />
                                  <span className="font-medium text-xs">延期等待</span>
                                </Button>
                              </>
                            )}
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
              <span className="text-slate-500 dark:text-slate-400 mr-2">已自动保留综合最高优先级任务，</span>
              <span className="font-bold text-base text-blue-600 dark:text-blue-400">
                已选择 {(() => {
                  // 获取当前冲突列表中的所有任务ID
                  const currentConflictTaskIds = new Set(
                    Array.from(conflicts.values()).flat().map(ct => ct.task.id)
                  );
                  // 只计算当前冲突列表中的任务
                  return Array.from(resolutions.entries()).filter(
                    ([taskId]) => !highestScoreTaskIds.has(taskId) && currentConflictTaskIds.has(taskId)
                  ).length;
                })()}
              </span> / <span className="font-bold text-base">
                {Array.from(conflicts.values()).flat().length - highestScoreTaskIds.size}
              </span> 个任务
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
