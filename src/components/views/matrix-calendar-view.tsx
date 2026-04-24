'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef, memo, useDeferredValue } from 'react';
import { Task, Resource, ResourceWorkType } from '@/types/schedule';

// 矩阵日历专用的简化飞书配置接口
interface MatrixCalendarFeishuConfig {
  appId: string;
  appSecret: string;
  appToken?: string;
  requirements2TableId?: string;
  viewId?: string;
}
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, GripVertical } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  addDays,
  isSameDay, 
  isWeekend,
  getWeek,
  isSameMonth,
  differenceInDays
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  rectIntersection,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  Modifier,
} from '@dnd-kit/core';

// 任务类型配置 - 不同颜色
const TASK_TYPE_CONFIG: { key: ResourceWorkType; label: string; bgColor: string; borderColor: string }[] = [
  { key: '脚本', label: '脚本', bgColor: 'bg-indigo-100', borderColor: 'border-indigo-400' },
  { key: '平面', label: '平面节点', bgColor: 'bg-teal-100', borderColor: 'border-teal-400' },
  { key: '后期', label: '后期节点', bgColor: 'bg-orange-100', borderColor: 'border-orange-400' },
];

// 子任务类型定义（本地存储，不同步到飞书）
export interface LocalSubTask {
  id: string;
  name: string;
  assignedResourceId?: string; // 负责人 ID
  status: 'pending' | 'completed';
}

// 负责人来源追踪
export interface ResourceAssignment {
  resourceId: string;
  source: 'subtask' | 'manual'; // 来源：子任务同步 / 手动选择
  sourceSubTaskId?: string; // 如果是子任务来源，记录来源的子任务 ID
}

// 扩展的 Task 类型（用于本地状态）
export interface ExtendedTask extends Task {
  localSubTasks?: LocalSubTask[]; // 本地子任务
  resourceAssignments?: ResourceAssignment[]; // 负责人及来源追踪
}

// 2025年法定节假日配置（可根据需要扩展）
const HOLIDAYS_2025: Set<string> = new Set([
  // 元旦
  '2025-01-01',
  // 春节
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
  // 清明节
  '2025-04-04', '2025-04-05', '2025-04-06',
  // 劳动节
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
  // 端午节
  '2025-05-31', '2025-06-01', '2025-06-02',
  // 中秋节+国庆节
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
]);

// 2026年法定节假日配置（预估，可根据官方公布调整）
const HOLIDAYS_2026: Set<string> = new Set([
  // 元旦
  '2026-01-01', '2026-01-02', '2026-01-03',
  // 春节（预估）
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  // 清明节（预估）
  '2026-04-04', '2026-04-05', '2026-04-06',
  // 劳动节（预估）
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  // 端午节（预估）
  '2026-05-31', '2026-06-01', '2026-06-02',
  // 中秋节+国庆节（预估）
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
]);

// 合并所有节假日
const ALL_HOLIDAYS = new Set([...HOLIDAYS_2025, ...HOLIDAYS_2026]);

// 检查是否是工作日（排除周末和法定节假日，支持调休日）
function isWorkingDay(date: Date, extraWorkDays?: Set<string>): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // 如果是调休日（加班日），视为工作日
  if (extraWorkDays?.has(dateStr)) return true;
  
  // 检查是否是周末
  if (isWeekend(date)) return false;
  // 检查是否是法定节假日
  if (ALL_HOLIDAYS.has(dateStr)) return false;
  return true;
}

// 检查日期原本是否是休息日（周末或节假日）
function isOriginallyRestDay(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  if (isWeekend(date)) return true;
  if (ALL_HOLIDAYS.has(dateStr)) return true;
  return false;
}

// 获取下一个工作日
function getNextWorkingDay(date: Date, extraWorkDays?: Set<string>): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);
  while (!isWorkingDay(result, extraWorkDays)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

// 获取上一个工作日
function getPrevWorkingDay(date: Date, extraWorkDays?: Set<string>): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - 1);
  while (!isWorkingDay(result, extraWorkDays)) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

// 计算两个日期之间的工作日天数（不考虑调休日）
function getWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  while (current <= end) {
    if (isOriginallyRestDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  // 返回自然日天数
  return Math.round((end.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

interface MatrixCalendarViewProps {
  scheduledTasks: Task[];
  resources: Resource[];
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  feishuConfig?: {
    appId: string;
    appSecret: string;
    appToken: string;
    requirements2TableId: string;
    viewId?: string;
  };
  taskTypeFilter?: 'all' | '脚本' | '平面' | '后期';
  resourceFilter?: string;
}

// 任务详情弹窗组件
const TaskDetailDialog = memo(function TaskDetailDialog({
  task,
  open,
  onClose,
  onSave,
  resources,
  projects,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  resources: Resource[];
  projects: { id: string; name: string }[];
}) {
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [localSubTasks, setLocalSubTasks] = useState<LocalSubTask[]>([]);
  const [resourceAssignments, setResourceAssignments] = useState<ResourceAssignment[]>([]);
  const [newSubTaskName, setNewSubTaskName] = useState('');

  const availableResources = useMemo(() => {
    if (!task) return resources.filter(r => r.type === 'human');
    const taskType = task.taskType;
    if (!taskType) return resources.filter(r => r.type === 'human');
    return resources.filter(r => r.type === 'human' && r.workType === taskType);
  }, [resources, task]);

  // 获取资源名称
  const getResourceName = useCallback((resourceId: string) => {
    const resource = resources.find(r => r.id === resourceId);
    return resource?.name || '未知';
  }, [resources]);

  // 初始化编辑状态
  useEffect(() => {
    if (task) {
      // 从 task 中恢复本地数据
      const taskExt = task as ExtendedTask;
      setLocalSubTasks(taskExt.localSubTasks || []);
      setResourceAssignments(taskExt.resourceAssignments || []);
      setEditedTask({
        name: task.name,
        description: task.description || '',
        projectId: task.projectId,
        estimatedHours: task.estimatedHours,
        endDate: task.endDate,
        assignedResources: task.assignedResources,
        fixedResourceId: task.fixedResourceId,
      });
    }
  }, [task]);

  // 添加子任务
  const handleAddSubTask = useCallback((resourceId?: string) => {
    if (!newSubTaskName.trim()) return;
    
    const newSubTask: LocalSubTask = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newSubTaskName.trim(),
      assignedResourceId: resourceId,
      status: 'pending',
    };
    
    const updatedSubTasks = [...localSubTasks, newSubTask];
    setLocalSubTasks(updatedSubTasks);
    setNewSubTaskName('');
    
    // 如果子任务有负责人，同步到父任务
    if (resourceId) {
      const newAssignment: ResourceAssignment = {
        resourceId,
        source: 'subtask',
        sourceSubTaskId: newSubTask.id,
      };
      setResourceAssignments(prev => {
        // 如果该负责人已存在，不重复添加
        if (prev.some(a => a.resourceId === resourceId)) {
          return prev;
        }
        return [...prev, newAssignment];
      });
    }
  }, [newSubTaskName, localSubTasks]);

  // 删除子任务
  const handleDeleteSubTask = useCallback((subTaskId: string) => {
    const subTaskToDelete = localSubTasks.find(st => st.id === subTaskId);
    
    // 删除子任务
    const updatedSubTasks = localSubTasks.filter(st => st.id !== subTaskId);
    setLocalSubTasks(updatedSubTasks);
    
    // 如果该子任务有负责人，检查是否需要从父任务中移除
    if (subTaskToDelete?.assignedResourceId) {
      const resourceId = subTaskToDelete.assignedResourceId;
      
      // 检查是否还有其他子任务使用该负责人
      const otherSubTasksWithSameResource = updatedSubTasks.filter(
        st => st.assignedResourceId === resourceId
      );
      
      if (otherSubTasksWithSameResource.length === 0) {
        // 没有其他子任务使用该负责人，从父任务中移除（仅移除来源为该子任务的）
        setResourceAssignments(prev => 
          prev.filter(a => 
            !(a.resourceId === resourceId && a.sourceSubTaskId === subTaskId)
          )
        );
      }
    }
  }, [localSubTasks]);

  // 切换子任务完成状态
  const handleToggleSubTaskStatus = useCallback((subTaskId: string) => {
    setLocalSubTasks(prev => 
      prev.map(st => 
        st.id === subTaskId 
          ? { ...st, status: st.status === 'completed' ? 'pending' : 'completed' }
          : st
      )
    );
  }, []);

  // 更新子任务的负责人
  const handleUpdateSubTaskResource = useCallback((subTaskId: string, newResourceId: string | undefined) => {
    const oldSubTask = localSubTasks.find(st => st.id === subTaskId);
    
    // 更新子任务的负责人
    setLocalSubTasks(prev => 
      prev.map(st => 
        st.id === subTaskId 
          ? { ...st, assignedResourceId: newResourceId }
          : st
      )
    );
    
    // 处理负责人变更逻辑
    if (newResourceId) {
      // 添加新负责人（如果还没有）
      setResourceAssignments(prev => {
        if (prev.some(a => a.resourceId === newResourceId)) {
          return prev;
        }
        return [...prev, {
          resourceId: newResourceId,
          source: 'subtask',
          sourceSubTaskId: subTaskId,
        }];
      });
    }
    
    // 如果原来有负责人，需要检查是否需要移除
    if (oldSubTask?.assignedResourceId && oldSubTask.assignedResourceId !== newResourceId) {
      const oldResourceId = oldSubTask.assignedResourceId;
      
      // 检查是否还有其他子任务使用该负责人
      const hasOtherSubTaskWithSameResource = localSubTasks.some(
        st => st.id !== subTaskId && st.assignedResourceId === oldResourceId
      );
      
      if (!hasOtherSubTaskWithSameResource) {
        setResourceAssignments(prev => 
          prev.filter(a => 
            !(a.resourceId === oldResourceId && a.sourceSubTaskId === subTaskId)
          )
        );
      }
    }
  }, [localSubTasks]);

  // 手动添加负责人
  const handleManualAddResource = useCallback((resourceId: string) => {
    if (resourceAssignments.some(a => a.resourceId === resourceId)) {
      return; // 已存在
    }
    setResourceAssignments(prev => [...prev, {
      resourceId,
      source: 'manual',
    }]);
  }, [resourceAssignments]);

  // 移除负责人
  const handleRemoveResource = useCallback((resourceId: string, source: 'subtask' | 'manual') => {
    if (source === 'manual') {
      // 手动添加的负责人，直接移除
      setResourceAssignments(prev => prev.filter(a => a.resourceId !== resourceId));
    } else {
      // 子任务来源的负责人，检查是否需要移除
      // 如果有其他子任务使用该负责人，则不移除
      const hasOtherSubTaskWithSameResource = localSubTasks.some(
        st => st.assignedResourceId === resourceId
      );
      if (!hasOtherSubTaskWithSameResource) {
        setResourceAssignments(prev => prev.filter(a => a.resourceId !== resourceId));
      }
    }
  }, [localSubTasks]);

  const handleSave = useCallback(() => {
    if (!task) return;
    
    // 构建保存的数据
    const extendedTask: ExtendedTask = {
      ...task,
      ...editedTask,
      localSubTasks,
      resourceAssignments,
      // 将 resourceAssignments 转换为 assignedResources 数组
      assignedResources: resourceAssignments.map(a => a.resourceId),
    };
    
    onSave(task.id, extendedTask);
    onClose();
  }, [task, editedTask, localSubTasks, resourceAssignments, onSave, onClose]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>任务详情</DialogTitle>
          <DialogDescription>查看和编辑任务信息</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">任务名称</label>
            <Input
              value={editedTask.name || ''}
              onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
              placeholder="输入任务名称"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">所属项目</label>
            <Select
              value={editedTask.projectId || 'none'}
              onValueChange={(value) => setEditedTask({ ...editedTask, projectId: value === 'none' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未指定</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">任务类型</label>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{task.taskType || '未指定'}</Badge>
              {task.status === 'completed' && <Badge className="bg-green-100 text-green-700 border-green-300">✓ 已完成</Badge>}
            </div>
          </div>

          {/* 需求表2相关字段 - 只读显示 */}
          {(task.category || task.subType || task.language || task.dubbing || task.contactPerson || task.businessMonth) && (
            <div className="grid gap-2 p-3 bg-slate-50 rounded-lg">
              <label className="text-sm font-medium text-slate-600">需求信息</label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {task.category && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">需求类目:</span>
                    <span className="font-medium">{task.category}</span>
                  </div>
                )}
                {task.subType && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">细分类:</span>
                    <span className="font-medium">{task.subType}</span>
                  </div>
                )}
                {task.language && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">语言:</span>
                    <span className="font-medium">{task.language}</span>
                  </div>
                )}
                {task.dubbing && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">配音:</span>
                    <span className="font-medium">{task.dubbing}</span>
                  </div>
                )}
                {task.contactPerson && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">对接人:</span>
                    <span className="font-medium">{task.contactPerson}</span>
                  </div>
                )}
                {task.businessMonth && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">商务月份:</span>
                    <span className="font-medium">{task.businessMonth}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 负责人多选 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">负责人</label>
            <div className="space-y-2">
              {/* 已选负责人列表 */}
              {resourceAssignments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {resourceAssignments.map(assignment => (
                    <Badge 
                      key={assignment.resourceId} 
                      variant="outline"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {getResourceName(assignment.resourceId)}
                      <span className={`text-xs ${assignment.source === 'manual' ? 'text-blue-500' : 'text-green-500'}`}>
                        {assignment.source === 'manual' ? '(手动)' : '(子任务)'}
                      </span>
                      <button
                        onClick={() => handleRemoveResource(assignment.resourceId, assignment.source)}
                        className="ml-1 text-red-500 hover:text-red-700 font-bold"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* 手动添加负责人 */}
              <Select onValueChange={handleManualAddResource}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="+ 添加负责人" />
                </SelectTrigger>
                <SelectContent>
                  {availableResources
                    .filter(r => !resourceAssignments.some(a => a.resourceId === r.id))
                    .map(resource => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">预估工时</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editedTask.estimatedHours || 0}
                onChange={(e) => setEditedTask({ ...editedTask, estimatedHours: Number(e.target.value) })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">小时</span>
            </div>
          </div>

          {/* 完成日期 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              完成日期
            </label>
            <Input
              type="date"
              value={editedTask.endDate ? format(new Date(editedTask.endDate), 'yyyy-MM-dd') : ''}
              onChange={(e) => setEditedTask({ ...editedTask, endDate: e.target.value ? new Date(e.target.value) : undefined })}
            />
          </div>

          {/* 子任务区域 */}
          <div className="grid gap-2 border-t pt-4">
            <label className="text-sm font-medium">子任务（仅本地可见）</label>
            <div className="space-y-2">
              {/* 子任务列表 */}
              {localSubTasks.map(subTask => (
                <div key={subTask.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={subTask.status === 'completed'}
                    onChange={() => handleToggleSubTaskStatus(subTask.id)}
                    className="w-4 h-4"
                  />
                  <span className={`flex-1 ${subTask.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                    {subTask.name}
                  </span>
                  <Select 
                    value={subTask.assignedResourceId || 'none'} 
                    onValueChange={(value) => handleUpdateSubTaskResource(subTask.id, value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue placeholder="负责人" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {availableResources.map(resource => (
                        <SelectItem key={resource.id} value={resource.id}>
                          {resource.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteSubTask(subTask.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                  >
                    删除
                  </Button>
                </div>
              ))}
              
              {/* 添加子任务 */}
              <div className="flex items-center gap-2">
                <Input
                  value={newSubTaskName}
                  onChange={(e) => setNewSubTaskName(e.target.value)}
                  placeholder="输入子任务名称"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubTask();
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => handleAddSubTask()}>
                  添加
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">描述</label>
            <Textarea
              value={editedTask.description || ''}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              placeholder="输入任务描述"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          {task.status === 'completed' ? (
            <Button variant="outline" onClick={() => {
              onSave(task.id, { ...editedTask, status: 'pending' });
              onClose();
            }}>
              取消完成
            </Button>
          ) : (
            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => {
              onSave(task.id, { ...editedTask, status: 'completed' });
              onClose();
            }}>
              完成任务
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存更改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// 获取任务类型样式
function getTypeStyle(taskType?: ResourceWorkType): string {
  switch (taskType) {
    case '脚本':
      return 'bg-indigo-100 border-indigo-400 hover:bg-indigo-200';
    case '平面':
      return 'bg-teal-100 border-teal-400 hover:bg-teal-200';
    case '后期':
      return 'bg-orange-100 border-orange-400 hover:bg-orange-200';
    default:
      return 'bg-gray-100 border-gray-400 hover:bg-gray-200';
  }
}

// 获取已完成任务样式
function getCompletedTypeStyle(taskType?: ResourceWorkType): string {
  switch (taskType) {
    case '脚本':
      return 'bg-slate-300 border-green-500 border-l-4';
    case '平面':
      return 'bg-slate-300 border-green-500 border-l-4';
    case '后期':
      return 'bg-slate-300 border-green-500 border-l-4';
    default:
      return 'bg-slate-300 border-green-500 border-l-4';
  }
}

function mergeViewTasksWithLocalState(viewTasks: Task[], localTasks: Task[]): Task[] {
  const mergedViewTasks = normalizeTasks(viewTasks);
  const normalizedLocalTasks = normalizeTasks(localTasks);
  const localTaskMap = new Map(normalizedLocalTasks.map((task) => [getTaskUniqueKey(task), task]));

  return normalizeTasks(mergedViewTasks.map((viewTask) => {
    const localTask = localTaskMap.get(getTaskUniqueKey(viewTask));
    if (!localTask) return viewTask;
    return {
      ...viewTask,
      taskType: localTask.taskType,
      startDate: localTask.startDate,
      endDate: localTask.endDate,
      deadline: localTask.deadline,
      status: localTask.status,
      assignedResources: localTask.assignedResources,
      fixedResourceId: localTask.fixedResourceId,
    };
  }));
}

function normalizeKeyPart(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function getTaskDisplayKey(task: Task): string {
  const name = normalizeKeyPart(task.name);
  const project = normalizeKeyPart(task.projectId || task.projectName);
  const month = normalizeKeyPart(task.businessMonth);
  if (!name) return '';
  return [project, name, month].join('|');
}

function getTaskBusinessFingerprint(task: Task): string {
  return getTaskDisplayKey(task);
}

function getTaskUniqueKey(task: Task): string {
  const recordKey = normalizeKeyPart(task.feishuRecordId);
  if (recordKey) return `record:${recordKey}`;

  const displayKey = getTaskDisplayKey(task);
  if (displayKey) return `biz:${displayKey}`;

  const fingerprint = getTaskBusinessFingerprint(task);
  if (fingerprint) return `fp:${fingerprint}`;

  return `id:${task.id}`;
}

function getTaskCompletenessScore(task: Task): number {
  let score = 0;
  if (task.taskType) score += 4;
  if (task.endDate || task.startDate || task.deadline) score += 3;
  if (task.fixedResourceId) score += 2;
  if (task.assignedResources?.length) score += 1;
  if (task.status && task.status !== 'pending') score += 1;
  return score;
}

function mergeDuplicateTask(a: Task, b: Task): Task {
  const aScore = getTaskCompletenessScore(a);
  const bScore = getTaskCompletenessScore(b);
  const primary = bScore >= aScore ? b : a;
  const secondary = bScore >= aScore ? a : b;

  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    feishuRecordId: primary.feishuRecordId || secondary.feishuRecordId,
    assignedResources: primary.assignedResources?.length ? primary.assignedResources : (secondary.assignedResources || []),
    resourceAssignments: primary.resourceAssignments?.length ? primary.resourceAssignments : secondary.resourceAssignments,
  };
}

function normalizeTasks(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    const key = getTaskUniqueKey(task);
    const existing = taskMap.get(key);
    if (!existing) {
      taskMap.set(key, task);
      continue;
    }
    taskMap.set(key, mergeDuplicateTask(existing, task));
  }
  return Array.from(taskMap.values());
}

function isSameLogicalTask(a: Task, b: Task): boolean {
  return getTaskUniqueKey(a) === getTaskUniqueKey(b);
}

// 未分配任务池组件
const UnassignedTaskPool = memo(function UnassignedTaskPool({
  tasks,
  draggedTask,
  onTaskClick,
}: {
  tasks: Task[];
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragFixedRect, setDragFixedRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned-task-pool',
    data: {
      isTaskPool: true,
    },
  });

  useEffect(() => {
    if (!draggedTask) {
      setDragFixedRect(null);
      return;
    }
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragFixedRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, [draggedTask]);

  useEffect(() => {
    if (!draggedTask) return;

    let rafId = 0;
    const keepHorizontalLocked = () => {
      if (containerRef.current && containerRef.current.scrollLeft !== 0) {
        containerRef.current.scrollLeft = 0;
      }
      if (listRef.current && listRef.current.scrollLeft !== 0) {
        listRef.current.scrollLeft = 0;
      }
      rafId = window.requestAnimationFrame(keepHorizontalLocked);
    };

    rafId = window.requestAnimationFrame(keepHorizontalLocked);
    return () => window.cancelAnimationFrame(rafId);
  }, [draggedTask]);

  return (
    <div className="w-48 min-w-48 max-w-48 shrink-0 h-full">
      <div
        ref={(node) => {
          setNodeRef(node);
          containerRef.current = node;
        }}
        className={`
          w-48 min-w-48 max-w-48 shrink-0 bg-slate-50 border-r-2 border-dashed border-slate-400
          rounded-lg flex flex-col overflow-hidden h-full
          ${isOver && draggedTask?.taskType ? 'bg-green-50 border-green-400' : ''}
        `}
        style={{
          touchAction: 'pan-y',
          contain: 'layout paint size',
          ...(dragFixedRect
            ? {
                position: 'fixed',
                left: `${dragFixedRect.left}px`,
                top: `${dragFixedRect.top}px`,
                width: `${dragFixedRect.width}px`,
                height: `${dragFixedRect.height}px`,
                zIndex: 60,
              }
            : {}),
        }}
        onWheelCapture={(e) => {
          if (Math.abs(e.deltaX) > 0) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (containerRef.current && containerRef.current.scrollLeft !== 0) {
            containerRef.current.scrollLeft = 0;
          }
        }}
      >
      {/* 固定头部 */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-slate-300 bg-slate-100 rounded-t-lg">
        <span className="text-sm font-medium text-slate-600">📋 未分配任务</span>
        <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
      </div>
      
      {/* 可滚动的内容区域 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1"
        style={{ overflowX: 'clip', overscrollBehaviorX: 'none' }}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) > 0) {
            e.preventDefault();
          }
        }}
        onScroll={(e) => {
          if (e.currentTarget.scrollLeft !== 0) {
            e.currentTarget.scrollLeft = 0;
          }
        }}
      >
        {tasks.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-4">
            暂无未分配任务
          </div>
        ) : (
          tasks.map(task => (
            <DraggableTaskCard
              key={getTaskUniqueKey(task)}
              task={task}
              onClick={() => onTaskClick(task)}
              isDragging={draggedTask?.id === task.id}
            />
          ))
        )}
      </div>
      
      {/* 固定底部提示 */}
      <div className="px-2 py-2 border-t border-slate-200 bg-slate-100 rounded-b-lg">
        <div className="text-xs text-slate-400 text-center">
          拖到这里取消分配
        </div>
      </div>
      </div>
    </div>
  );
});

// 可拖拽的任务卡片组件
const DraggableTaskCard = memo(function DraggableTaskCard({
  task,
  onClick,
  isDragging,
}: {
  task: Task;
  onClick: () => void;
  isDragging: boolean;
}) {
  const isCompleted = task.status === 'completed';
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;

  const { attributes, listeners, setNodeRef, isDragging: isBeingDragged } = useDraggable({
    id: `task-${task.id}`,
    data: {
      task,
      taskType: task.taskType,
    },
  });

  // 根据完成状态选择样式
  const typeStyle = isCompleted ? getCompletedTypeStyle(task.taskType) : getTypeStyle(task.taskType);

  return (
    <div
      ref={setNodeRef}
      style={{
        userSelect: 'none',
        touchAction: 'none',
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`
        w-full max-w-full min-w-0 px-2 py-1 rounded text-xs cursor-grab active:cursor-grabbing
        border transition-all flex items-center gap-1 overflow-hidden
        ${typeStyle}
        ${isDragging || isBeingDragged ? 'opacity-30 scale-95' : 'hover:shadow-sm'}
      `}
      title={`${displayName}${isCompleted ? '\n✓ 已完成' : '\n拖拽移动日期'}`}
    >
      <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
      <span className={`flex-1 min-w-0 block truncate ${isCompleted ? 'line-through text-slate-500' : ''}`}>{displayName}</span>
      {isCompleted && <span className="text-green-600 font-bold">✓</span>}
    </div>
  );
});

// 可放置的单元格组件
const DroppableCell = memo(function DroppableCell({
  day,
  taskType,
  cellTasks,
  draggedTask,
  onTaskClick,
  isInMonth,
  extraWorkDays,
  onToggleExtraWorkDay,
}: {
  day: Date;
  taskType: ResourceWorkType;
  cellTasks: Task[];
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
  isInMonth: boolean;
  extraWorkDays: Set<string>;
  onToggleExtraWorkDay: (date: Date) => void;
}) {
  const dateStr = format(day, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday = dateStr === todayStr;
  const isWeekendDay = isWeekend(day);
  const isHoliday = ALL_HOLIDAYS.has(dateStr);
  const isOriginallyRest = isOriginallyRestDay(day);
  const isExtraWorkDay = extraWorkDays.has(dateStr);
  const isWorkDay = isWorkingDay(day, extraWorkDays);
  const cellId = `cell-${dateStr}-${taskType}`;
  
  // 检查是否可以放置：无类型任务可放置到任意类型，或类型匹配
  const canDrop = isWorkDay && 
    (!draggedTask?.taskType || draggedTask.taskType === taskType);
  
  // 非工作日或类型不匹配时禁用
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: {
      dateStr,
      taskType,
      isWorkDay,
    },
    disabled: !canDrop,
  });

  const isDragOver = isOver && canDrop;

  // 处理点击非工作日单元格
  const handleCellClick = () => {
    if (isOriginallyRest) {
      onToggleExtraWorkDay(day);
    }
  };

  // 非工作日的样式
  const getNonWorkingDayStyle = () => {
    if (isExtraWorkDay) return 'bg-green-50 text-green-600 cursor-pointer hover:bg-green-100'; // 调休加班日
    if (isHoliday) return 'bg-red-50 text-red-400 cursor-pointer hover:bg-red-100'; // 法定节假日
    if (isWeekendDay) return 'bg-slate-100 text-slate-400 cursor-pointer hover:bg-slate-200'; // 周末
    return '';
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleCellClick}
      className={`
        flex-1 min-w-24 min-h-[60px] p-1 border-r last:border-r-0 border-slate-200
        ${isToday && isWorkDay ? 'bg-blue-50' : ''}
        ${!isWorkDay || isExtraWorkDay ? getNonWorkingDayStyle() : ''}
        ${isDragOver ? 'bg-green-100 ring-2 ring-green-400 ring-inset' : ''}
        ${!isInMonth ? 'opacity-40' : ''}
        transition-colors
      `}
      title={isOriginallyRest ? (isExtraWorkDay ? '点击取消加班/调休' : '点击设置为加班/调休日') : undefined}
    >
      <div className="space-y-1 min-h-[40px]">
        {isWorkDay ? (
          <>
            {cellTasks.map(task => (
              <DraggableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                isDragging={draggedTask?.id === task.id}
              />
            ))}
            {cellTasks.length === 0 && (
              <div className="h-8 flex items-center justify-center text-slate-300 text-xs">-</div>
            )}
          </>
        ) : (
          <div className="h-8 flex items-center justify-center text-xs opacity-60">
            {isHoliday ? '🏛️ 休' : '休息'}
          </div>
        )}
      </div>
    </div>
  );
});

// 单周表格组件
const WeekTable = memo(function WeekTable({
  weekNumber,
  weekDays,
  tasksByDateAndType,
  currentMonth,
  draggedTask,
  onTaskClick,
  extraWorkDays,
  onToggleExtraWorkDay,
}: {
  weekNumber: number;
  weekDays: Date[];
  tasksByDateAndType: Record<string, Task[]>;
  currentMonth: Date;
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
  extraWorkDays: Set<string>;
  onToggleExtraWorkDay: (date: Date) => void;
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];

  return (
    <div className="mb-4">
      <div className="bg-slate-700 text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
        <span className="font-medium">第{weekNumber}周</span>
        <span className="text-sm opacity-80">
          {format(weekStart, 'M.d')} - {format(weekEnd, 'M.d')}
        </span>
      </div>

      <div className="border border-t-0 border-slate-300 rounded-b-lg overflow-hidden">
        <div className="flex bg-slate-100 border-b border-slate-300">
          <div className="w-20 min-w-20 p-2 border-r border-slate-300 text-center font-medium text-sm bg-slate-200">
            类型
          </div>
          {weekDays.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = dateStr === todayStr;
            const isWeekendDay = isWeekend(day);
            const isInMonth = isSameMonth(day, currentMonth);
            const isHoliday = ALL_HOLIDAYS.has(dateStr);
            const isExtraWorkDay = extraWorkDays.has(dateStr);
            const isWorkDay = isWorkingDay(day, extraWorkDays);
            const isOriginallyRest = isOriginallyRestDay(day);

            return (
              <div
                key={idx}
                className={`
                  flex-1 min-w-24 p-2 border-r last:border-r-0 border-slate-300 text-center
                  ${isToday && isWorkDay ? 'bg-blue-100' : ''}
                  ${isExtraWorkDay ? 'bg-green-100' : !isWorkDay ? (isHoliday ? 'bg-red-50' : 'bg-slate-100') : ''}
                  ${!isInMonth ? 'opacity-40' : ''}
                  ${isOriginallyRest ? 'cursor-pointer hover:opacity-80' : ''}
                `}
                onClick={() => isOriginallyRest && onToggleExtraWorkDay(day)}
                title={isOriginallyRest ? (isExtraWorkDay ? '点击取消加班/调休' : '点击设置为加班/调休日') : undefined}
              >
                <div className={`text-xs ${!isWorkDay && !isExtraWorkDay ? 'text-slate-400' : 'text-slate-500'}`}>
                  {format(day, 'E', { locale: zhCN })}
                </div>
                <div className={`font-medium text-sm ${isToday ? 'text-blue-600' : !isWorkDay && !isExtraWorkDay ? 'text-slate-400' : ''}`}>
                  {format(day, 'M.d')}
                </div>
                {isExtraWorkDay && (
                  <div className="text-xs text-green-600">💼</div>
                )}
                {isHoliday && !isExtraWorkDay && (
                  <div className="text-xs text-red-400">休</div>
                )}
              </div>
            );
          })}
        </div>

        {TASK_TYPE_CONFIG.map((taskType) => (
          <div key={taskType.key} className="flex border-b last:border-b-0 border-slate-200">
            <div className={`w-20 min-w-20 p-2 border-r border-slate-300 text-center font-medium text-sm ${taskType.bgColor}`}>
              {taskType.label}
            </div>

            {weekDays.map((day, dayIdx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const cellTasks = tasksByDateAndType[`${dateKey}-${taskType.key}`] || [];
              const isInMonth = isSameMonth(day, currentMonth);

              return (
                <DroppableCell
                  key={dayIdx}
                  day={day}
                  taskType={taskType.key}
                  cellTasks={cellTasks}
                  draggedTask={draggedTask}
                  onTaskClick={onTaskClick}
                  isInMonth={isInMonth}
                  extraWorkDays={extraWorkDays}
                  onToggleExtraWorkDay={onToggleExtraWorkDay}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

// 翻页按钮组件
function NavButton({
  direction,
  onClick,
  isActive,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center rounded-md text-sm font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-1
        focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50
        border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground
        h-8 w-8
        ${isActive ? 'ring-2 ring-blue-500 bg-blue-100' : ''}
      `}
    >
      {direction === 'prev' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

export function MatrixCalendarView({
  scheduledTasks,
  resources,
  tasks,
  onTaskUpdate,
  feishuConfig,
  taskTypeFilter = 'all',
  resourceFilter = 'all',
}: MatrixCalendarViewProps) {
  const calendarRootRef = useRef<HTMLDivElement | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // 从飞书视图加载的任务数据
  const [viewTasks, setViewTasks] = useState<Task[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  // 用 ref 追踪任务数量变化，避免 useEffect 依赖数组不稳定
  const lastTaskCountRef = useRef(0);
  const feishuConfigRef = useRef(feishuConfig);
  feishuConfigRef.current = feishuConfig;

  // 延迟更新的 draggedTask，用于 UI 渲染，减少重渲染
  const deferredDraggedTask = useDeferredValue(draggedTask);

  // 调休/加班日状态
  const [extraWorkDays, setExtraWorkDays] = useState<Set<string>>(() => new Set());

  // 根据筛选条件过滤任务
  const filteredViewTasks = useMemo(() => {
    const normalizedViewTasks = normalizeTasks(viewTasks);
    return normalizedViewTasks.filter(task => {
      // 任务类型筛选
      if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) {
        return false;
      }
      // 人员筛选
      if (resourceFilter !== 'all') {
        const extendedTask = task as ExtendedTask;
        // 检查负责人（优先使用 resourceAssignments，其次使用 assignedResources）
        const assignedIds = extendedTask.resourceAssignments 
          ? extendedTask.resourceAssignments.map(a => a.resourceId)
          : task.assignedResources || [];
        if (!assignedIds.includes(resourceFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [viewTasks, taskTypeFilter, resourceFilter]);

  // 内部函数：从飞书 API 加载视图数据并更新状态
  const fetchAndSetViewTasks = useCallback(async (config: NonNullable<MatrixCalendarFeishuConfig>) => {
    setViewLoading(true);
    setViewError(null);

    try {
      const params = new URLSearchParams({
        app_id: config.appId,
        app_secret: config.appSecret,
        app_token: config.appToken || '',
        requirements2_table_id: config.requirements2TableId || '',
        view_id: config.viewId || '',
      });

      console.log('[矩阵日历] 正在加载视图数据...', config.viewId);

      const response = await fetch(`/api/feishu/load-requirements2-view?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加载视图数据失败');
      }

      if (data.success) {
        console.log('[矩阵日历] 视图数据加载成功:', data.tasks.length, '个任务');
        // 使用任务主状态覆盖视图快照字段，避免拖拽更新在切页后被飞书视图数据覆盖
        setViewTasks(mergeViewTasksWithLocalState(data.tasks, tasks));
        lastTaskCountRef.current = data.tasks.length;
      } else {
        throw new Error(data.error || '加载视图数据失败');
      }
    } catch (error) {
      console.error('[矩阵日历] 加载视图数据失败:', error);
      setViewError(String(error));
    } finally {
      setViewLoading(false);
    }
  }, [tasks]);

  // 加载视图数据函数（供外部按钮调用）
  const loadViewData = useCallback(async () => {
    if (!feishuConfig?.viewId) {
      setViewTasks([]);
      setViewError('未配置矩阵视图ID（requirements2Matrix），已停止回退全量任务数据');
      return;
    }
    await fetchAndSetViewTasks(feishuConfig);
  }, [feishuConfig, tasks, fetchAndSetViewTasks]);

  // 从飞书视图加载数据 - 仅在首次加载或 tasks 数量增加时重新加载
  // 使用 ref 追踪状态，避免依赖数组变化
  useEffect(() => {
    const currentFeishuConfig = feishuConfigRef.current;
    const prevCount = lastTaskCountRef.current;
    
    if (!currentFeishuConfig?.viewId) {
      setViewTasks([]);
      setViewError('未配置矩阵视图ID（requirements2Matrix），矩阵日历仅支持视图数据源');
      return;
    }

    // 如果 tasks 数量增加（说明从飞书新加载了数据），重新加载视图数据
    if (tasks.length > prevCount && prevCount > 0) {
      console.log('[矩阵日历] 检测到任务数量增加，重新加载视图数据:', prevCount, '->', tasks.length);
      fetchAndSetViewTasks(currentFeishuConfig);
    } else if (prevCount === 0) {
      // 首次加载
      fetchAndSetViewTasks(currentFeishuConfig);
    }
  }, [tasks.length, fetchAndSetViewTasks, tasks]);
  
  // 切换调休/加班日
  const toggleExtraWorkDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setExtraWorkDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
        console.log('[矩阵日历] 取消加班/调休日:', dateStr);
      } else {
        newSet.add(dateStr);
        console.log('[矩阵日历] 设置加班/调休日:', dateStr);
      }
      return newSet;
    });
  }, []);
  
  // 使用 ref 保存最新的 draggedTask，解决闭包问题
  const draggedTaskRef = useRef<Task | null>(null);
  useEffect(() => {
    draggedTaskRef.current = draggedTask;
  }, [draggedTask]);

  // 拖拽过程中锁定页面横向滚动，避免出现无限向右滑动
  useEffect(() => {
    if (!draggedTask) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const prevDocOverflow = document.documentElement.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyWidth = document.body.style.width;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverflowX = document.body.style.overflowX;
    const prevDocOverflowX = document.documentElement.style.overflowX;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';

    // 锁定矩阵容器及其祖先的横向滚动，避免未分配栏在拖拽时被任何父级带着向右滑
    const lockTargets = new Set<HTMLElement>();
    const addIfScrollableX = (el: HTMLElement | null) => {
      if (!el) return;
      if (el.scrollWidth > el.clientWidth || el.scrollLeft !== 0) {
        lockTargets.add(el);
      }
    };

    let cursor: HTMLElement | null = calendarRootRef.current;
    while (cursor) {
      addIfScrollableX(cursor);
      cursor = cursor.parentElement;
    }
    addIfScrollableX(document.scrollingElement as HTMLElement | null);

    let rafId = 0;
    const lockAllHorizontal = () => {
      lockTargets.forEach((el) => {
        if (el.scrollLeft !== 0) {
          el.scrollLeft = 0;
        }
      });
      if (window.scrollX !== 0) {
        window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
      }
      rafId = window.requestAnimationFrame(lockAllHorizontal);
    };
    rafId = window.requestAnimationFrame(lockAllHorizontal);

    const lockHorizontalScroll = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return;
      if (target.scrollLeft !== 0) {
        target.scrollLeft = 0;
      }
    };

    const handleScrollCapture = (event: Event) => {
      lockHorizontalScroll(event.target);
      if (window.scrollX !== 0) {
        window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaX !== 0) {
        event.preventDefault();
      }
    };

    document.addEventListener('scroll', handleScrollCapture, true);
    document.addEventListener('wheel', handleWheel, { passive: false });
    if (window.scrollX !== 0) {
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('scroll', handleScrollCapture, true);
      document.removeEventListener('wheel', handleWheel);
      document.documentElement.style.overflow = prevDocOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.width = prevBodyWidth;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overflowX = prevBodyOverflowX;
      document.documentElement.style.overflowX = prevDocOverflowX;
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' });
    };
  }, [draggedTask]);

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移动 5px 才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor),
  );

  // 限制拖拽在矩阵日历可视容器内，防止在未分配栏拖拽时无限向右
  const restrictDragToCalendarRoot = useCallback<Modifier>((args) => {
    const { transform } = args;
    const nodeRect = args.draggingNodeRect ?? (args as typeof args & { activeNodeRect?: DOMRect }).activeNodeRect;
    const rootRect = calendarRootRef.current?.getBoundingClientRect();
    if (!nodeRect || !rootRect) return transform;

    const minX = rootRect.left - nodeRect.left;
    const maxX = rootRect.right - nodeRect.right;
    const minY = rootRect.top - nodeRect.top;
    const maxY = rootRect.bottom - nodeRect.bottom;

    return {
      ...transform,
      x: Math.min(Math.max(transform.x, minX), maxX),
      y: Math.min(Math.max(transform.y, minY), maxY),
    };
  }, []);

  // 组件挂载日志
  useEffect(() => {
    const dates = filteredViewTasks
      .filter(t => t.startDate)
      .map(t => new Date(t.startDate!));

    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      console.log('[矩阵日历] 任务日期:', format(minDate, 'yyyy-MM'), '~', format(maxDate, 'yyyy-MM'), '| 当前月份:', format(currentDate, 'yyyy-MM'));
    }
  // 仅在首次挂载时执行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 获取当前月的所有周
  const monthWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weeks: { weekNumber: number; days: Date[] }[] = [];
    let currentWeekStart = calendarStart;

    while (currentWeekStart <= calendarEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
      const hasDayInMonth = weekDays.some(day => isSameMonth(day, currentDate));

      if (hasDayInMonth) {
        weeks.push({
          weekNumber: getWeek(currentWeekStart, { weekStartsOn: 1 }),
          days: weekDays,
        });
      }

      currentWeekStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    return weeks;
  }, [currentDate]);

  // 获取项目列表（从 filteredViewTasks 生成，确保与显示的任务一致）
  const projects = useMemo(() => {
    const projectMap = new Map<string, { id: string; name: string }>();
    filteredViewTasks.forEach(task => {
      if (task.projectId && task.projectName) {
        projectMap.set(task.projectId, { id: task.projectId, name: task.projectName });
      }
    });
    return Array.from(projectMap.values());
  }, [filteredViewTasks]);

  // 获取所有未分配类型的任务（用于任务池）- 使用视图数据
  const unassignedTasks = useMemo(() => {
    const assignedExactKeys = new Set(
      filteredViewTasks
        .filter(task => Boolean(task.taskType))
        .map(task => {
          const recordKey = normalizeKeyPart(task.feishuRecordId);
          return recordKey ? `record:${recordKey}` : `id:${task.id}`;
        })
    );

    const candidates = filteredViewTasks.filter(task => {
      if (task.taskType) return false;
      const recordKey = normalizeKeyPart(task.feishuRecordId);
      const exactKey = recordKey ? `record:${recordKey}` : `id:${task.id}`;
      return !assignedExactKeys.has(exactKey);
    });

    // 未排期栏使用精确键去重，避免“同名同月”误杀
    const uniqueMap = new Map<string, Task>();
    for (const task of candidates) {
      const recordKey = normalizeKeyPart(task.feishuRecordId);
      const exactKey = recordKey ? `record:${recordKey}` : `id:${task.id}`;
      if (!uniqueMap.has(exactKey)) {
        uniqueMap.set(exactKey, task);
      }
    }
    return Array.from(uniqueMap.values());
  }, [filteredViewTasks]);

  // 按日期和类型分组任务
  // 对于视图数据：有deadline的任务按deadline显示，没有日期的显示在任务池
  const tasksByDateAndType = useMemo(() => {
    const grouped: Record<string, Task[]> = Object.create(null);
    const addedKeys = new Set<string>();

    for (let i = 0; i < filteredViewTasks.length; i++) {
      const task = filteredViewTasks[i];
      const taskKey = getTaskUniqueKey(task);
      if (addedKeys.has(taskKey)) continue;

      // 未分配类型的任务不显示在任何类型行，它们会在任务池中显示
      if (!task.taskType) continue;

      // 确定任务日期：优先使用 endDate/startDate，否则使用 deadline
      let taskDate: Date | undefined;
      if (task.endDate) {
        taskDate = new Date(task.endDate);
      } else if (task.startDate) {
        taskDate = new Date(task.startDate);
      } else if (task.deadline) {
        taskDate = new Date(task.deadline);
      }

      if (!taskDate) continue;

      const dateKey = format(taskDate, 'yyyy-MM-dd');

      // 只在工作日显示任务（考虑调休/加班日）
      if (isWorkingDay(taskDate, extraWorkDays)) {
        const key = dateKey + '-' + task.taskType;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(task);
        addedKeys.add(taskKey);
      }
    }

    return grouped;
  }, [filteredViewTasks, extraWorkDays]);

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const taskData = active.data.current;
    if (taskData?.task) {
      setDraggedTask(taskData.task);
    }
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const currentDraggedTask = draggedTaskRef.current;

    // 立即清除拖拽状态，避免视觉延迟
    setDraggedTask(null);

    if (!over || !currentDraggedTask) {
      return;
    }

    const overData = over.data.current;
    if (!overData) {
      return;
    }

    // 如果拖拽到任务池，清除类型
    if (overData.isTaskPool) {
      if (currentDraggedTask.taskType) {
        const draggedTaskKey = getTaskUniqueKey(currentDraggedTask);
        // 直接更新 viewTasks
        setViewTasks(prev => normalizeTasks(prev.map(t => {
          if (!isSameLogicalTask(t, currentDraggedTask) && getTaskUniqueKey(t) !== draggedTaskKey) return t;
          return { ...t, taskType: undefined };
        })));
        // 同时通知父组件
        if (onTaskUpdate) {
          onTaskUpdate(currentDraggedTask.id, { taskType: undefined });
        }
      }
      return;
    }

    const targetDateStr = overData.dateStr as string;
    const targetTaskType = overData.taskType as ResourceWorkType;
    const targetIsWorkDay = overData.isWorkDay as boolean;

    // 解析目标日期
    let finalTargetDate = new Date(targetDateStr);
    finalTargetDate.setHours(0, 0, 0, 0);
    if (!targetIsWorkDay) {
      finalTargetDate = getNextWorkingDay(finalTargetDate, extraWorkDays);
    }

    // 简化逻辑：只需要设置 endDate（完成日期）
    const updates: Partial<Task> = {
      endDate: finalTargetDate,
    };

    // 如果任务没有类型，拖拽后自动设置类型
    if (!currentDraggedTask.taskType) {
      updates.taskType = targetTaskType;
    }

    console.log('[矩阵日历] 拖拽设置完成日期:', currentDraggedTask.name, '->', format(finalTargetDate, 'yyyy-MM-dd'));

    // 直接更新 viewTasks（立即反映在日历上）
    setViewTasks(prev => normalizeTasks(prev.map(t => {
      if (!isSameLogicalTask(t, currentDraggedTask)) return t;
      return { ...t, ...updates };
    })));

    // 同时通知父组件同步更新
    if (onTaskUpdate) {
      onTaskUpdate(currentDraggedTask.id, updates);
    }
  }, [onTaskUpdate, extraWorkDays]);

  // 拖拽取消
  const handleDragCancel = useCallback(() => {
    console.log('[矩阵日历] 拖拽取消');
    setDraggedTask(null);
  }, []);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  }, []);

  const handleTaskSave = useCallback((taskId: string, updates: Partial<Task>) => {
    // 更新 viewTasks 中的任务
    setViewTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, ...updates } as ExtendedTask;
    }));
    
    // 同时通知父组件同步更新
    if (onTaskUpdate) {
      onTaskUpdate(taskId, updates);
    }
  }, [onTaskUpdate]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const handleThisMonth = () => setCurrentDate(new Date());

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      modifiers={[restrictDragToCalendarRoot]}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={calendarRootRef}
        className="flex flex-col h-full min-h-0 max-w-full overflow-x-hidden"
        style={{ contain: 'layout paint size', isolation: 'isolate' }}
      >
        {/* 月份切换控制 */}
        <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <NavButton
              direction="prev"
              onClick={handlePrevMonth}
              isActive={false}
            />
            <NavButton
              direction="next"
              onClick={handleNextMonth}
              isActive={false}
            />
            <Button variant="outline" size="sm" onClick={handleThisMonth}>
              本月
            </Button>
          </div>
          <div className="text-lg font-semibold shrink-0">
            {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
          </div>
          <div className="text-sm text-muted-foreground min-w-0 flex-1 text-right">
            {draggedTask ? (
              <span className="text-blue-600 font-medium block truncate">
                🔄 正在移动: {draggedTask.name}
              </span>
            ) : (
              <span className="block truncate">💡 提示: 拖拽任务卡片移动日期 | 点击休息日设为加班日</span>
            )}
          </div>
        </div>

        {/* 拖拽提示条 */}
        {draggedTask && (
          <div className="mb-2 p-3 bg-blue-50 border border-blue-300 rounded-lg flex items-center justify-between gap-3 min-w-0 shadow-sm">
            <span className="text-sm text-blue-700 min-w-0 flex-1 truncate">
              正在移动: <strong className="text-blue-900">{draggedTask.name}</strong>
              {draggedTask.projectName && <span className="text-blue-500 ml-1">（{draggedTask.projectName}）</span>}
            </span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded shrink-0">
              放开鼠标放置任务
            </span>
          </div>
        )}

        {/* 未分配任务池 + 周表格 */}
        <div className="h-full min-h-0 overflow-hidden flex gap-2">
          {/* 左侧未分配任务池 */}
          <div className="w-48 min-w-48 max-w-48 shrink-0 h-full">
            <UnassignedTaskPool
              tasks={unassignedTasks}
              draggedTask={draggedTask}
              onTaskClick={handleTaskClick}
            />
          </div>

          {/* 右侧周表格 */}
          <div className="h-full min-w-0 flex-1">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {monthWeeks.map((week) => (
                <WeekTable
                  key={week.weekNumber}
                  weekNumber={week.weekNumber}
                  weekDays={week.days}
                  tasksByDateAndType={tasksByDateAndType}
                  currentMonth={currentDate}
                  draggedTask={deferredDraggedTask}
                  onTaskClick={handleTaskClick}
                  extraWorkDays={extraWorkDays}
                  onToggleExtraWorkDay={toggleExtraWorkDay}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 任务详情弹窗 */}
        <TaskDetailDialog
          task={selectedTask}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
          }}
          onSave={handleTaskSave}
          resources={resources}
          projects={projects}
        />
      </div>

    </DndContext>
  );
}
