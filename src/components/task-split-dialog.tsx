'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Users, TrendingUp } from 'lucide-react';
import { Task, Resource } from '@/types/schedule';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { calculateWorkHours, calculateEndDate } from '@/lib/schedule-algorithms';

interface SubTask {
  id: string;
  name: string;
  estimatedHours: number;
  assignedResource: string | null; // null 表示自动分配
  resource: Resource | null;
  estimatedStart: Date;
  estimatedEnd: Date;
}

interface TaskSplitDialogProps {
  task: Task | null;
  resources: Resource[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (subTasks: SubTask[], summaryHours: number) => void;
}

export function TaskSplitDialog({
  task,
  resources,
  isOpen,
  onClose,
  onConfirm,
}: TaskSplitDialogProps) {
  const [segmentCount, setSegmentCount] = useState<number>(3);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [summaryHours, setSummaryHours] = useState<number>(0); // 汇总任务工时
  const [isLoading, setIsLoading] = useState(false);
  const isAutoAssigning = useRef(false); // 跟踪是否正在自动分配

  // 计算剩余时间（从当前时间到截止日期）
  const remainingTime = useMemo(() => {
    if (!task || !task.deadline) return null;
    const now = new Date();
    const remaining = calculateWorkHours(now, task.deadline);
    return remaining;
  }, [task]);

  // 初始化子任务
  useEffect(() => {
    if (!task) return;

    // 清除自动分配标志，因为这是重新初始化
    isAutoAssigning.current = false;

    const hoursPerSegment = Math.ceil(task.estimatedHours / segmentCount);
    const newSubTasks: SubTask[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const isLast = i === segmentCount - 1;
      const hours = isLast ? task.estimatedHours - hoursPerSegment * (segmentCount - 1) : hoursPerSegment;

      newSubTasks.push({
        id: `${task.id}-sub-${i}`,
        name: `${task.name} - 第${i + 1}部分`,
        estimatedHours: hours,
        assignedResource: null,
        resource: null,
        estimatedStart: new Date(),
        estimatedEnd: new Date(),
      });
    }

    setSubTasks(newSubTasks);
  }, [task, segmentCount]);

  // 自动分配资源
  useEffect(() => {
    if (assignmentMode === 'auto' && subTasks.length > 0 && !isAutoAssigning.current) {
      isAutoAssigning.current = true;
      autoAssignResources();
    }
  }, [assignmentMode, subTasks, resources]);

  // 自动分配资源算法
  const autoAssignResources = () => {
    if (subTasks.length === 0 || resources.length === 0) return;

    // 计算每个资源的当前负载
    const resourceLoad = new Map<string, number>();
    resources.forEach(r => resourceLoad.set(r.id, 0));

    // 按任务类型筛选资源
    const taskType = task?.taskType || '平面';
    const filteredResources = resources.filter(r => r.workType === taskType);

    if (filteredResources.length === 0) return;

    const newSubTasks = [...subTasks];

    // 为每个子任务分配资源
    newSubTasks.forEach((subTask, index) => {
      // 计算资源得分（综合考虑负载和效率）
      const resourceScores = filteredResources.map(resource => {
        const load = resourceLoad.get(resource.id) || 0;
        const efficiency = resource.efficiency || 1.0;

        // 负载得分（负载越低得分越高）
        const loadScore = Math.max(0, 100 - load);

        // 效率得分（效率越高得分越高）
        const efficiencyScore = efficiency * 100;

        // 综合得分（负载70%，效率30%）
        const totalScore = loadScore * 0.7 + efficiencyScore * 0.3;

        return { resource, score: totalScore };
      });

      // 选择得分最高的资源
      resourceScores.sort((a, b) => b.score - a.score);
      const bestResource = resourceScores[0].resource;

      // 更新子任务
      newSubTasks[index] = {
        ...newSubTasks[index],
        assignedResource: bestResource.id,
        resource: bestResource,
      };

      // 更新资源负载
      const currentLoad = resourceLoad.get(bestResource.id) || 0;
      resourceLoad.set(bestResource.id, currentLoad + subTask.estimatedHours);
    });

    setSubTasks(newSubTasks);

    // 清除自动分配标志，防止无限循环
    setTimeout(() => {
      isAutoAssigning.current = false;
    }, 0);
  };

  // 计算预估完成时间
  const estimatedEndDate = useMemo(() => {
    if (!task || subTasks.length === 0) return null;

    // 找出最晚的子任务完成时间
    let maxEndDate = new Date();
    const now = new Date();

    subTasks.forEach(subTask => {
      const resource = subTask.resource;
      const efficiency = resource?.efficiency || 1.0;
      const actualHours = subTask.estimatedHours / efficiency;

      const endDate = calculateEndDate(now, actualHours);
      if (endDate > maxEndDate) {
        maxEndDate = endDate;
      }
    });

    // 加上汇总任务的工时
    if (summaryHours > 0) {
      maxEndDate = calculateEndDate(maxEndDate, summaryHours);
    }

    return maxEndDate;
  }, [subTasks, task, summaryHours]);

  // 检查是否能在截止日期前完成
  const canMeetDeadline = useMemo(() => {
    if (!task || !task.deadline || !estimatedEndDate) return false;
    return estimatedEndDate <= task.deadline;
  }, [task, estimatedEndDate]);

  // 计算时间节省
  const timeSaved = useMemo(() => {
    if (!task || !estimatedEndDate) return null;

    const originalEndDate = calculateEndDate(new Date(), task.estimatedHours);
    const originalHours = calculateWorkHours(new Date(), originalEndDate);
    const newHours = calculateWorkHours(new Date(), estimatedEndDate);

    return originalHours - newHours;
  }, [task, estimatedEndDate]);

  // 处理工时变更
  const handleHoursChange = (index: number, value: string) => {
    const hours = parseFloat(value) || 0;
    const newSubTasks = [...subTasks];
    newSubTasks[index] = { ...newSubTasks[index], estimatedHours: hours };
    setSubTasks(newSubTasks);
  };

  // 处理资源分配变更
  const handleResourceChange = (index: number, resourceId: string) => {
    const newSubTasks = [...subTasks];
    const resource = resources.find(r => r.id === resourceId);
    newSubTasks[index] = {
      ...newSubTasks[index],
      assignedResource: resourceId,
      resource: resource || null,
    };
    setSubTasks(newSubTasks);
  };

  // 处理名称变更
  const handleNameChange = (index: number, value: string) => {
    const newSubTasks = [...subTasks];
    newSubTasks[index] = { ...newSubTasks[index], name: value };
    setSubTasks(newSubTasks);
  };

  // 处理确认
  const handleConfirm = () => {
    setIsLoading(true);
    setTimeout(() => {
      onConfirm(subTasks, summaryHours);
      setIsLoading(false);
      onClose();
    }, 500);
  };

  if (!task) return null;

  const taskType = task.taskType || '平面';
  const filteredResources = resources.filter(r => r.workType === taskType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            任务拆分
          </DialogTitle>
          <DialogDescription>
            将任务 "{task.name}" 拆分为多个子任务，由多人并行完成，争取在截止日期前完成
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 任务信息 */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={task.taskType === '平面' ? 'default' : task.taskType === '后期' ? 'secondary' : 'outline'}>
                  {task.taskType}任务
                </Badge>
                <span className="font-medium">{task.name}</span>
              </div>
              {remainingTime !== null && remainingTime < task.estimatedHours && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  超期 {(task.estimatedHours - remainingTime).toFixed(1)}h
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">预估工时：</span>
                <span className="font-medium">{task.estimatedHours}h</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">截止日期：</span>
                <span className="font-medium">{task.deadline ? format(task.deadline, 'yyyy-MM-dd HH:mm', { locale: zhCN }) : '-'}</span>
              </div>
            </div>
            {remainingTime !== null && (
              <div className="text-sm">
                <span className="text-slate-600 dark:text-slate-400">剩余可用时间：</span>
                <span className={remainingTime < task.estimatedHours ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                  {remainingTime.toFixed(1)}h
                </span>
              </div>
            )}
          </div>

          {/* 拆分设置 */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">拆分段数</Label>
              <Select value={segmentCount.toString()} onValueChange={(value) => setSegmentCount(parseInt(value))}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2段（2人并行）</SelectItem>
                  <SelectItem value="3">3段（3人并行）</SelectItem>
                  <SelectItem value="4">4段（4人并行）</SelectItem>
                  <SelectItem value="5">5段（5人并行）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                将任务拆分为 {segmentCount} 个子任务，由 {segmentCount} 人并行完成
              </p>
            </div>

            <div>
              <Label className="text-base font-medium">分配方式</Label>
              <RadioGroup value={assignmentMode} onValueChange={(value) => setAssignmentMode(value as 'auto' | 'manual')} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="auto" />
                  <Label htmlFor="auto" className="font-normal cursor-pointer">
                    自动分配（推荐）
                  </Label>
                </div>
                <p className="text-xs text-slate-500 ml-6">
                  根据资源负载和效率自动分配，优先选择负载较轻、效率较高的资源
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">
                    手动指定
                  </Label>
                </div>
                <p className="text-xs text-slate-500 ml-6">
                    自行指定每个子任务的负责人和工时
                  </p>
              </RadioGroup>
            </div>
          </div>

          {/* 子任务列表 */}
          <div className="space-y-3">
            <Label className="text-base font-medium">子任务分配</Label>
            {subTasks.map((subTask, index) => (
              <div key={subTask.id} className="border rounded-lg p-4 space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">子任务 {index + 1}</Badge>
                  </div>
                  <div>
                    <Label htmlFor={`name-${index}`} className="text-sm">子任务名称</Label>
                    <Input
                      id={`name-${index}`}
                      type="text"
                      value={subTask.name}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      className="mt-1"
                      placeholder="输入子任务名称"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`hours-${index}`} className="text-sm">预估工时（小时）</Label>
                    <Input
                      id={`hours-${index}`}
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={subTask.estimatedHours}
                      onChange={(e) => handleHoursChange(index, e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {assignmentMode === 'manual' && (
                    <div>
                      <Label htmlFor={`resource-${index}`} className="text-sm">负责人</Label>
                      <Select
                        value={subTask.assignedResource || 'auto'}
                        onValueChange={(value) => handleResourceChange(index, value)}
                      >
                        <SelectTrigger id={`resource-${index}`} className="mt-1">
                          <SelectValue placeholder="选择负责人" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">自动选择</SelectItem>
                          {filteredResources.map(resource => (
                            <SelectItem key={resource.id} value={resource.id}>
                              {resource.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 手动分配模式下显示当前分配的资源 */}
                  {assignmentMode === 'manual' && subTask.resource && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 dark:text-slate-400">当前负责人：</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {subTask.resource.name}
                      </Badge>
                    </div>
                  )}
                </div>

                {subTask.resource && (
                  <div className="text-xs text-slate-500">
                    预计完成时间：{format(estimatedEndDate || new Date(), 'MM-dd HH:mm', { locale: zhCN })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 汇总任务设置 */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-base font-medium">汇总任务设置</Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="summary-hours" className="text-sm">汇总工时（用于整合子任务）</Label>
                <Input
                  id="summary-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={summaryHours}
                  onChange={(e) => setSummaryHours(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                  placeholder="可选，默认0小时"
                />
              </div>
              <div className="text-sm text-slate-500 flex-1">
                <p>如果子任务完成后需要额外时间进行整合，请设置汇总工时</p>
              </div>
            </div>
          </div>

          {/* 预估结果 */}
          <div className={`p-4 rounded-lg border ${canMeetDeadline ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
            <div className="flex items-start gap-3">
              {canMeetDeadline ? (
                <div className="text-green-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
              <div className="flex-1">
                <div className={`font-medium ${canMeetDeadline ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {canMeetDeadline ? '可在截止日期前完成' : '仍然超期，建议调整方案'}
                </div>
                <div className="text-sm mt-1 space-y-1">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">预估完成时间：</span>
                    <span className="font-medium">
                      {estimatedEndDate ? format(estimatedEndDate, 'yyyy-MM-dd HH:mm', { locale: zhCN }) : '-'}
                    </span>
                  </div>
                  {timeSaved !== null && timeSaved > 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      <span>节省约 {timeSaved.toFixed(1)} 小时</span>
                    </div>
                  )}
                  {!canMeetDeadline && estimatedEndDate && task.deadline && (
                    <div className="text-red-600">
                      超期 {calculateWorkHours(task.deadline, estimatedEndDate).toFixed(1)}h
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !canMeetDeadline}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                处理中...
              </>
            ) : (
              '确认拆分并重新排期'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
