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
import { loadAllData, syncCalendarExtraWorkDays } from '@/storage/database/db-service';
import {
  DndContext,
  DragOverlay,
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
  taskType?: ResourceWorkType;
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

function toStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function countWorkingDaysInRange(start: Date, end: Date, extraWorkDays?: Set<string>): number {
  let count = 0;
  let current = toStartOfDay(start);
  const endDay = toStartOfDay(end);
  while (current <= endDay) {
    if (isWorkingDay(current, extraWorkDays)) {
      count += 1;
    }
    current = addDays(current, 1);
  }
  return Math.max(1, count);
}

function addWorkingDays(start: Date, daysToAdd: number, extraWorkDays?: Set<string>): Date {
  let current = toStartOfDay(start);
  let remaining = Math.max(0, daysToAdd);
  while (remaining > 0) {
    current = getNextWorkingDay(current, extraWorkDays);
    remaining -= 1;
  }
  return current;
}

const SPAN_LANE_HEIGHT_PX = 35;// 任务车道高度
const SPAN_ROW_BASE_HEIGHT_PX = 80;// 任务行基础高度
const SPAN_ROW_PADDING_PX = 1;// 任务行内边距

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
  onTaskUpdate?: (taskId: string, updates: Partial<Task>, sourceTask?: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onViewTasksLoaded?: (viewTasks: Task[]) => void;
  feishuConfig?: {
    appId: string;
    appSecret: string;
    appToken: string;
    requirements2TableId: string;
    viewId?: string;
  };
  taskTypeFilter?: 'all' | '脚本' | '平面' | '后期';
  resourceFilter?: string;
  onAddSubTask?: (subTask: Task) => void;
  onUpdateSubTask?: (subTaskId: string, updates: Partial<Task>) => void;
  onDeleteSubTask?: (subTaskId: string) => void;
}

// 任务详情弹窗组件
const TaskDetailDialog = memo(function TaskDetailDialog({
  task,
  open,
  onClose,
  onSave,
  resources,
  projects,
  extraWorkDays,
  allTasks,
  onAddSubTask,
  onUpdateSubTask,
  onDeleteSubTask,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  resources: Resource[];
  projects: { id: string; name: string }[];
  extraWorkDays: Set<string>;
  allTasks: Task[];
  onAddSubTask: (subTask: Task) => void;
  onUpdateSubTask: (subTaskId: string, updates: Partial<Task>) => void;
  onDeleteSubTask: (subTaskId: string) => void;
}) {
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [resourceAssignments, setResourceAssignments] = useState<ResourceAssignment[]>([]);
  const [newSubTaskName, setNewSubTaskName] = useState('');
  const [newSubTaskType, setNewSubTaskType] = useState<ResourceWorkType | 'none'>('none');

  const childTasks = useMemo(() => {
    if (!task) return [];
    const storedSubTaskIds = (task.localSubTasks || []).map((st) => st.id).filter(Boolean);
    if (storedSubTaskIds.length > 0) {
      const idSet = new Set(storedSubTaskIds);
      return allTasks.filter((t) => idSet.has(t.id));
    }
    return allTasks.filter(t => t.parentTaskId === task.id);
  }, [allTasks, task]);

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
      setResourceAssignments(taskExt.resourceAssignments || []);
      setEditedTask({
        name: task.name,
        description: task.description || '',
        projectId: task.projectId,
        estimatedHours: task.estimatedHours,
        startDate: task.startDate,
        endDate: task.endDate,
        assignedResources: task.assignedResources,
        fixedResourceId: task.fixedResourceId,
      });
    }
  }, [task]);

  // 添加子任务
  const handleAddSubTask = useCallback((resourceId?: string) => {
    if (!newSubTaskName.trim() || !task) return;
    
    const newSubTask: Task = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${task.name}-${newSubTaskName.trim()}`,
      assignedResources: resourceId ? [resourceId] : [],
      taskType: newSubTaskType === 'none' ? undefined : newSubTaskType,
      status: 'pending',
      priority: task.priority,
      estimatedHours: 0,
      parentTaskId: task.id,
      isSubTask: true,
      projectId: task.projectId,
      projectName: task.projectName,
      taskSource: task.taskSource,
      sourceViewId: task.sourceViewId,
    };
    
    onAddSubTask(newSubTask);
    setNewSubTaskName('');
    setNewSubTaskType('none');
  }, [newSubTaskName, newSubTaskType, task, onAddSubTask]);

  const handleDeleteSubTaskLocal = useCallback((subTaskId: string) => {
    onDeleteSubTask(subTaskId);
  }, [onDeleteSubTask]);

  // 切换子任务完成状态
  const handleToggleSubTaskStatus = useCallback((subTaskId: string) => {
    const subTask = childTasks.find(st => st.id === subTaskId);
    if (subTask) {
      onUpdateSubTask(subTaskId, { status: subTask.status === 'completed' ? 'pending' : 'completed' });
    }
  }, [childTasks, onUpdateSubTask]);

  // 更新子任务的负责人
  const handleUpdateSubTaskResource = useCallback((subTaskId: string, newResourceId: string | undefined) => {
    onUpdateSubTask(subTaskId, { assignedResources: newResourceId ? [newResourceId] : [] });
  }, [onUpdateSubTask]);

  const handleUpdateSubTaskType = useCallback((subTaskId: string, newTaskType: ResourceWorkType | undefined) => {
    onUpdateSubTask(subTaskId, { taskType: newTaskType });
  }, [onUpdateSubTask]);

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

  // 动态计算所有负责人
  const allAssignments = useMemo(() => {
    const map = new Map<string, ResourceAssignment>();
    
    // 1. 添加手动分配的负责人 (只保留 source === 'manual')
    resourceAssignments.filter(a => a.source === 'manual').forEach(a => {
      map.set(a.resourceId, a);
    });
    
    // 2. 动态添加子任务的负责人
    childTasks.forEach(st => {
      st.assignedResources?.forEach(resourceId => {
        if (!map.has(resourceId)) {
          map.set(resourceId, {
            resourceId,
            source: 'subtask',
            sourceSubTaskId: st.id
          });
        }
      });
    });
    
    return Array.from(map.values());
  }, [resourceAssignments, childTasks]);

  // 移除负责人
  const handleRemoveResource = useCallback((resourceId: string, source: 'subtask' | 'manual') => {
    if (source === 'manual') {
      // 手动添加的负责人，直接移除
      setResourceAssignments(prev => prev.filter(a => a.resourceId !== resourceId));
    } else {
      // 子任务来源的负责人，需要提示用户去删除子任务或更改子任务负责人
      alert('该负责人来源于子任务，请在下方子任务列表中更改负责人或删除子任务。');
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!task) return;
    
    let startDate = editedTask.startDate ? toStartOfDay(new Date(editedTask.startDate)) : undefined;
    let endDate = editedTask.endDate ? toStartOfDay(new Date(editedTask.endDate)) : undefined;
    if (startDate || endDate) {
      if (!startDate && endDate) startDate = endDate;
      if (!endDate && startDate) endDate = startDate;
      if (startDate && !isWorkingDay(startDate, extraWorkDays)) {
        startDate = getNextWorkingDay(startDate, extraWorkDays);
      }
      if (endDate && !isWorkingDay(endDate, extraWorkDays)) {
        endDate = getPrevWorkingDay(endDate, extraWorkDays);
      }
      if (startDate && endDate && endDate < startDate) {
        endDate = startDate;
      }
    }

    // 构建保存的数据
    const extendedTask: ExtendedTask = {
      ...task,
      ...editedTask,
      startDate,
      endDate,
      resourceAssignments: allAssignments,
      // 将 resourceAssignments 转换为 assignedResources 数组
      assignedResources: allAssignments.map(a => a.resourceId),
    };
    
    onSave(task.id, extendedTask);
    onClose();
  }, [task, editedTask, allAssignments, onSave, onClose, extraWorkDays]);

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
              {allAssignments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allAssignments.map(assignment => (
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
                    .filter(r => !allAssignments.some(a => a.resourceId === r.id))
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                开始日期
              </label>
              <Input
                type="date"
                value={editedTask.startDate ? format(new Date(editedTask.startDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => setEditedTask({ ...editedTask, startDate: e.target.value ? new Date(e.target.value) : undefined })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                结束日期
              </label>
              <Input
                type="date"
                value={editedTask.endDate ? format(new Date(editedTask.endDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => setEditedTask({ ...editedTask, endDate: e.target.value ? new Date(e.target.value) : undefined })}
              />
            </div>
          </div>

          {/* 子任务区域 */}
          <div className="grid gap-2 border-t pt-4">
            <label className="text-sm font-medium">子任务</label>
            <div className="space-y-2">
              {/* 子任务列表 */}
              {childTasks.map(subTask => (
                <div key={subTask.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <input
                    type="checkbox"
                    checked={subTask.status === 'completed'}
                    onChange={() => handleToggleSubTaskStatus(subTask.id)}
                    className="w-4 h-4"
                  />
                  <span className={`flex-1 ${subTask.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                    {subTask.name.replace(`${task.name}-`, '')}
                  </span>
                  <Select 
                    value={subTask.assignedResources?.[0] || 'none'} 
                    onValueChange={(value) => handleUpdateSubTaskResource(subTask.id, value === 'none' ? undefined : value)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue placeholder="负责人" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      {resources.filter(r => r.type === 'human' && (!subTask.taskType || r.workType === subTask.taskType)).map(resource => (
                        <SelectItem key={resource.id} value={resource.id}>
                          {resource.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={subTask.taskType || 'none'}
                    onValueChange={(value) => handleUpdateSubTaskType(subTask.id, value === 'none' ? undefined : value as ResourceWorkType)}
                  >
                    <SelectTrigger className="w-24 h-7 text-xs">
                      <SelectValue placeholder="类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无类型</SelectItem>
                      <SelectItem value="脚本">脚本</SelectItem>
                      <SelectItem value="平面">平面</SelectItem>
                      <SelectItem value="后期">后期</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteSubTaskLocal(subTask.id)}
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
                <Select value={newSubTaskType} onValueChange={(value) => setNewSubTaskType(value as ResourceWorkType | 'none')}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无类型</SelectItem>
                    <SelectItem value="脚本">脚本</SelectItem>
                    <SelectItem value="平面">平面</SelectItem>
                    <SelectItem value="后期">后期</SelectItem>
                  </SelectContent>
                </Select>
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
          {(task.isSubTask || task.parentTaskId) && (
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteSubTask(task.id);
                onClose();
              }}
            >
              删除子任务
            </Button>
          )}
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
  const localTaskMap = new Map(normalizedLocalTasks.map((task) => [getTaskMergeKey(task), task]));
  const matchedKeys = new Set<string>();

  const mergedFromView = mergedViewTasks.map((viewTask) => {
    const mergeKey = getTaskMergeKey(viewTask);
    const localTask = localTaskMap.get(mergeKey);
    if (!localTask) return viewTask;
    matchedKeys.add(mergeKey);
    return {
      ...viewTask,
      taskType: localTask.taskType,
      startDate: localTask.startDate,
      endDate: localTask.endDate,
      deadline: localTask.deadline,
      status: localTask.status ?? viewTask.status,
      assignedResources: localTask.assignedResources,
      fixedResourceId: localTask.fixedResourceId,
      localSubTasks: localTask.localSubTasks,
      resourceAssignments: localTask.resourceAssignments,
      parentTaskId: localTask.parentTaskId,
      isSubTask: localTask.isSubTask,
    };
  });

  // 飞书重导有时只返回子集，这里保留未命中的本地矩阵任务，避免“排期被清空”
  const preservedLocalTasks = normalizedLocalTasks.filter((task) => !matchedKeys.has(getTaskMergeKey(task)));

  return normalizeTasks([...mergedFromView, ...preservedLocalTasks]);
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

// 合并飞书重载数据时优先按 record，其次按业务键，最后按 id，避免重导后 id 变化导致排期丢失
function getTaskMergeKey(task: Task): string {
  if (task.isSubTask || task.parentTaskId) {
    return `id:${normalizeKeyPart(task.id)}`;
  }

  const recordKey = normalizeKeyPart(task.feishuRecordId);
  if (recordKey) return `record:${recordKey}`;

  const displayKey = getTaskDisplayKey(task);
  if (displayKey) return `biz:${displayKey}`;

  return `id:${normalizeKeyPart(task.id)}`;
}

function getTaskUniqueKey(task: Task): string {
  const recordKey = normalizeKeyPart(task.feishuRecordId);
  if (recordKey) return `record:${recordKey}`;

  const idKey = normalizeKeyPart(task.id);
  if (idKey) return `id:${idKey}`;

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
  totalCount,
  draggedTask,
  onTaskClick,
  getOwnerNames,
  projects,
  projectFilter,
  onProjectFilterChange,
}: {
  tasks: Task[];
  totalCount: number;
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
  getOwnerNames: (task: Task) => string;
  projects: { id: string; name: string }[];
  projectFilter: string;
  onProjectFilterChange: (projectId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned-task-pool',
    data: {
      isTaskPool: true,
    },
  });

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

  const normalizedProjectFilter = projectFilter || 'all';
  const displayTasks = useMemo(() => {
    if (normalizedProjectFilter === 'all') return tasks;
    if (normalizedProjectFilter === 'none') {
      return tasks.filter((t) => !t.projectId);
    }
    return tasks.filter((t) => t.projectId === normalizedProjectFilter);
  }, [tasks, normalizedProjectFilter]);

  const groupedTasks = useMemo(() => {
    const projectMap = new Map<string, Map<string, Task[]>>();
    for (const task of displayTasks) {
      const projectKey = (task.projectName || '').trim() || '未指定';
      const categoryKey = (task.category || '').trim() || '未指定类目';
      const categoryMap = projectMap.get(projectKey) || new Map<string, Task[]>();
      const list = categoryMap.get(categoryKey) || [];
      list.push(task);
      categoryMap.set(categoryKey, list);
      projectMap.set(projectKey, categoryMap);
    }

    const projects = Array.from(projectMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
    return projects.map(([projectName, categoryMap]) => {
      const categories = Array.from(categoryMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
      return { projectName, categories };
    });
  }, [displayTasks]);

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
        <Badge variant="secondary" className="text-xs">{displayTasks.length}</Badge>
        <Badge variant="outline" className="text-xs text-slate-500">总 {totalCount}</Badge>
      </div>

      <div className="px-2 py-2 border-b border-slate-200 bg-slate-50">
        <Select value={normalizedProjectFilter} onValueChange={onProjectFilterChange}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="项目筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部项目</SelectItem>
            <SelectItem value="none">未指定</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {displayTasks.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-4">
            暂无未分配任务
          </div>
        ) : (
          groupedTasks.map(({ projectName, categories }) => {
            const projectCount = categories.reduce((sum, [, list]) => sum + list.length, 0);
            return (
              <div key={projectName} className="space-y-1">
                {normalizedProjectFilter === 'all' && (
                  <div className="text-[11px] text-slate-500 px-1 pt-1">
                    {projectName}（{projectCount}）
                  </div>
                )}
                {categories.map(([categoryName, list]) => (
                  <div key={`${projectName}::${categoryName}`} className="space-y-1">
                    <div className="text-[11px] text-slate-400 px-1 pt-1">
                      {categoryName}（{list.length}）
                    </div>
                    {list.map(task => (
                      <DraggableTaskCard
                        key={getTaskUniqueKey(task)}
                        task={task}
                        ownerNames={getOwnerNames(task)}
                        onClick={() => onTaskClick(task)}
                        isDragging={draggedTask?.id === task.id}
                      />
                    ))}
                  </div>
                ))}
              </div>
            );
          })
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
  ownerNames,
  onClick,
  isDragging,
}: {
  task: Task;
  ownerNames: string;
  onClick: () => void;
  isDragging: boolean;
}) {
  const isCompleted = task.status === 'completed';
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;
  const tooltipLines = [
    displayName,
    `负责人: ${ownerNames || '-'}`,
    `类目: ${task.category || '-'}`,
    `细分: ${task.subType || '-'}`,
    `语言: ${task.language || '-'}`,
    `对接人: ${task.contactPerson || '-'}`,
    isCompleted ? '✓ 已完成' : '拖拽移动日期',
  ];

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
      title={tooltipLines.join('\n')}
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
  draggedTask,
  onTaskClick,
  getOwnerNames,
  isInMonth,
  extraWorkDays,
  onToggleExtraWorkDay,
  style,
  className,
}: {
  day: Date;
  taskType: ResourceWorkType;
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
  getOwnerNames: (task: Task) => string;
  isInMonth: boolean;
  extraWorkDays: Set<string>;
  onToggleExtraWorkDay: (date: Date) => void;
  style?: React.CSSProperties;
  className?: string;
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
      data-date={dateStr}
      data-tasktype={taskType}
      data-isworkday={isWorkDay ? '1' : '0'}
      style={style}
      className={`
        min-w-24 min-h-[44px] p-1 border-r last:border-r-0 border-slate-200
        ${isToday && isWorkDay ? 'bg-blue-50' : ''}
        ${!isWorkDay || isExtraWorkDay ? getNonWorkingDayStyle() : ''}
        ${isDragOver ? 'bg-green-100 ring-2 ring-green-400 ring-inset' : ''}
        ${!isInMonth ? 'opacity-40' : ''}
        transition-colors
        ${className || ''}
      `}
      title={isOriginallyRest ? (isExtraWorkDay ? '点击取消加班/调休' : '点击设置为加班/调休日') : undefined}
    >
      <div className="h-full flex items-center justify-center text-xs opacity-60 select-none">
        {!isWorkDay && !isExtraWorkDay ? (isHoliday ? '休' : '休息') : null}
      </div>
    </div>
  );
});

const TaskSpanBar = memo(function TaskSpanBar({
  task,
  ownerNames,
  onClick,
  isDragging,
  colStart,
  colSpan,
  row,
  onResizeStart,
  isPreview,
}: {
  task: Task;
  ownerNames: string;
  onClick: () => void;
  isDragging: boolean;
  colStart: number;
  colSpan: number;
  row: number;
  onResizeStart: (task: Task, event: React.PointerEvent<HTMLDivElement>) => void;
  isPreview: boolean;
}) {
  const isCompleted = task.status === 'completed';
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;
  const tooltipLines = [
    displayName,
    `负责人: ${ownerNames || '-'}`,
    `类目: ${task.category || '-'}`,
    `细分: ${task.subType || '-'}`,
    `语言: ${task.language || '-'}`,
    `对接人: ${task.contactPerson || '-'}`,
    isCompleted ? '✓ 已完成' : '拖拽移动日期 / 右侧拖拽调整结束日期',
  ];

  const { attributes, listeners, setNodeRef, isDragging: isBeingDragged } = useDraggable({
    id: `task-${task.id}`,
    data: {
      task,
      taskType: task.taskType,
    },
  });

  const typeStyle = isCompleted ? getCompletedTypeStyle(task.taskType) : getTypeStyle(task.taskType);

  return (
    <div
      ref={setNodeRef}
      style={{
        userSelect: 'none',
        touchAction: 'none',
        gridColumn: `${colStart} / span ${colSpan}`,
        gridRow: row,
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`
        relative h-[26px] px-2 rounded text-xs cursor-grab active:cursor-grabbing
        border transition-all flex items-center gap-1 overflow-hidden
        pointer-events-auto
        ${typeStyle}
        ${isDragging || isBeingDragged ? 'opacity-30 scale-95' : 'hover:shadow-sm'}
        ${isPreview ? 'ring-2 ring-blue-500 ring-inset' : ''}
      `}
      title={tooltipLines.join('\n')}
    >
      <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
      <span className={`flex-1 min-w-0 block truncate ${isCompleted ? 'line-through text-slate-500' : ''}`}>{displayName}</span>
      {isCompleted && <span className="text-green-600 font-bold">✓</span>}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizeStart(task, e);
        }}
      />
    </div>
  );
});

// 单周表格组件
const WeekTable = memo(function WeekTable({
  weekNumber,
  weekDays,
  tasks,
  currentMonth,
  draggedTask,
  onTaskClick,
  getOwnerNames,
  extraWorkDays,
  onToggleExtraWorkDay,
  getTaskSpanRange,
  onResizeStart,
  resizingTaskId,
}: {
  weekNumber: number;
  weekDays: Date[];
  tasks: Task[];
  currentMonth: Date;
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
  getOwnerNames: (task: Task) => string;
  extraWorkDays: Set<string>;
  onToggleExtraWorkDay: (date: Date) => void;
  getTaskSpanRange: (task: Task) => { start?: Date; end?: Date };
  onResizeStart: (task: Task, event: React.PointerEvent<HTMLDivElement>) => void;
  resizingTaskId: string | null;
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const weekStartDate = new Date(weekStart);
  weekStartDate.setHours(0, 0, 0, 0);
  const weekEndDate = new Date(weekEnd);
  weekEndDate.setHours(0, 0, 0, 0);

  return (
    <div className="mb-4">
      <div className="bg-slate-700 text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
        <span className="font-medium">第{weekNumber}周</span>
        <span className="text-sm opacity-80">
          {format(weekStart, 'M.d')} - {format(weekEnd, 'M.d')}
        </span>
      </div>

      <div className="border border-t-0 border-slate-300 rounded-b-lg overflow-hidden">
        <div className="grid grid-cols-[80px_repeat(7,minmax(96px,1fr))] bg-slate-100 border-b border-slate-300">
          <div className="p-2 border-r border-slate-300 text-center font-medium text-sm bg-slate-200">
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
                  min-w-24 p-2 border-r last:border-r-0 border-slate-300 text-center
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

        {TASK_TYPE_CONFIG.map((taskType) => {
          const rowTasks = tasks.filter((t) => t.taskType === taskType.key);

          const spans = rowTasks
            .map((t) => {
              const { start, end } = getTaskSpanRange(t);
              if (!start || !end) return null;
              const startDate = toStartOfDay(start);
              const endDate = toStartOfDay(end);
              if (endDate < weekStartDate || startDate > weekEndDate) return null;

              const dayIndices: number[] = [];
              for (let i = 0; i < weekDays.length; i++) {
                const day = toStartOfDay(weekDays[i]);
                if (day < startDate || day > endDate) continue;
                if (!isWorkingDay(day, extraWorkDays)) continue;
                dayIndices.push(i);
              }
              if (dayIndices.length === 0) return null;

              const segments: Array<{ startIdx: number; endIdx: number }> = [];
              let segStart = dayIndices[0];
              let prev = segStart;
              for (let i = 1; i < dayIndices.length; i++) {
                const idx = dayIndices[i];
                if (idx === prev + 1) {
                  prev = idx;
                  continue;
                }
                segments.push({ startIdx: segStart, endIdx: prev });
                segStart = idx;
                prev = idx;
              }
              segments.push({ startIdx: segStart, endIdx: prev });

              return {
                task: t,
                spanStart: segments[0].startIdx,
                spanEnd: segments[segments.length - 1].endIdx,
                segments,
              };
            })
            .filter(Boolean) as Array<{ task: Task; spanStart: number; spanEnd: number; segments: Array<{ startIdx: number; endIdx: number }> }>;

          spans.sort((a, b) => (a.spanStart - b.spanStart) || (a.spanEnd - b.spanEnd) || a.task.id.localeCompare(b.task.id));

          const laneEnds: number[] = [];
          const laidOut = spans.map((span) => {
            let lane = 0;
            while (lane < laneEnds.length) {
              if (span.spanStart > laneEnds[lane]) break;
              lane++;
            }
            if (lane === laneEnds.length) {
              laneEnds.push(span.spanEnd);
            } else {
              laneEnds[lane] = span.spanEnd;
            }
            return { ...span, lane };
          });

          const laneCount = laneEnds.length || 1;
          const minLaneCount = Math.max(1, Math.ceil((SPAN_ROW_BASE_HEIGHT_PX - SPAN_ROW_PADDING_PX) / SPAN_LANE_HEIGHT_PX));
          const displayLaneCount = Math.max(laneCount, minLaneCount);

          return (
            <div
              key={taskType.key}
              className="grid grid-cols-[80px_repeat(7,minmax(96px,1fr))] border-b last:border-b-0 border-slate-200"
              style={{ minHeight: Math.max(SPAN_ROW_BASE_HEIGHT_PX, displayLaneCount * SPAN_LANE_HEIGHT_PX + SPAN_ROW_PADDING_PX) }}
            >
              <div className={`p-2 border-r border-slate-300 text-center font-medium text-sm ${taskType.bgColor}`}>
                {taskType.label}
              </div>

              <div className="col-span-7">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: 'repeat(7, minmax(96px, 1fr))',
                    gridTemplateRows: `repeat(${displayLaneCount}, ${SPAN_LANE_HEIGHT_PX}px)`,
                  }}
                >
                  {weekDays.map((day, dayIdx) => {
                    const isInMonth = isSameMonth(day, currentMonth);
                    return (
                      <DroppableCell
                        key={dayIdx}
                        day={day}
                        taskType={taskType.key}
                        draggedTask={draggedTask}
                        onTaskClick={onTaskClick}
                        getOwnerNames={getOwnerNames}
                        isInMonth={isInMonth}
                        extraWorkDays={extraWorkDays}
                        onToggleExtraWorkDay={onToggleExtraWorkDay}
                        style={{
                          gridColumn: dayIdx + 1,
                          gridRow: `1 / span ${displayLaneCount}`,
                        }}
                        className="h-full"
                      />
                    );
                  })}

                  {laidOut.flatMap(({ task, segments, lane }) =>
                    segments.map((seg, idx) => (
                      <TaskSpanBar
                        key={`${task.id}-${idx}`}
                        task={task}
                        ownerNames={getOwnerNames(task)}
                        onClick={() => onTaskClick(task)}
                        isDragging={draggedTask?.id === task.id}
                        colStart={seg.startIdx + 1}
                        colSpan={seg.endIdx - seg.startIdx + 1}
                        row={lane + 1}
                        onResizeStart={onResizeStart}
                        isPreview={resizingTaskId === task.id}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
  onDeleteTask,
  feishuConfig,
  onViewTasksLoaded,
  taskTypeFilter = 'all',
  resourceFilter = 'all',
  onAddSubTask,
  onUpdateSubTask,
  onDeleteSubTask,
}: MatrixCalendarViewProps): React.JSX.Element {
  const calendarRootRef = useRef<HTMLDivElement | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [nameSearch, setNameSearch] = useState('');
  const [unassignedProjectFilter, setUnassignedProjectFilter] = useState('all');
  const [resizingTaskId, setResizingTaskId] = useState<string | null>(null);
  const resizingTaskRef = useRef<Task | null>(null);
  const [resizePreviewEndDate, setResizePreviewEndDate] = useState<Date | null>(null);
  const resizePreviewEndRef = useRef<Date | null>(null);
  useEffect(() => {
    resizePreviewEndRef.current = resizePreviewEndDate;
  }, [resizePreviewEndDate]);

  // 矩阵任务以数据库持久态为主数据源
  const [viewTasks, setViewTasks] = useState<Task[]>(() => normalizeTasks(tasks));
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const autoHydratedViewIdRef = useRef<string | null>(null);
  const autoHydratedLowCountViewIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedTask) return;
    const updated =
      viewTasks.find((t) => t.id === selectedTask.id) ||
      viewTasks.find((t) => isSameLogicalTask(t, selectedTask));
    if (!updated) return;
    if (updated === selectedTask) return;
    setSelectedTask(updated);
  }, [viewTasks, selectedTask]);

  // 延迟更新的 draggedTask，用于 UI 渲染，减少重渲染
  const deferredDraggedTask = useDeferredValue(draggedTask);

  // 调休/加班日状态
  const [extraWorkDays, setExtraWorkDays] = useState<Set<string>>(() => new Set());

  // 读取已保存的加班/调休日配置，确保管理端与展示端一致
  useEffect(() => {
    let mounted = true;
    void loadAllData()
      .then((data) => {
        if (!mounted) return;
        setExtraWorkDays(new Set(data.calendarExtraWorkDays || []));
      })
      .catch((error) => {
        console.warn('[矩阵日历] 读取加班/调休日配置失败:', error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 仅在父级矩阵持久任务变更时同步，且强制只保留矩阵来源任务
  // 防止上游误传入“需求表1+需求表2”混合数据导致未分配池数量异常
  useEffect(() => {
    const matrixOnlyTasks = tasks.filter((task) => task.taskSource === 'matrix_view' || Boolean(task.sourceViewId));
    const activeViewId = (feishuConfig?.viewId || '').trim();
    const scopedTasks = activeViewId
      ? matrixOnlyTasks.filter((task) => (task.sourceViewId || '').trim() === activeViewId)
      : matrixOnlyTasks;
    setViewTasks(normalizeTasks(scopedTasks));
  }, [tasks, feishuConfig?.viewId]);

  // 根据筛选条件过滤任务
  const filteredViewTasks = useMemo(() => {
    const keyword = nameSearch.trim().toLowerCase();
    const normalizedViewTasks = normalizeTasks(viewTasks);
    return normalizedViewTasks.filter(task => {
      if (task.subType && task.subType.includes('配音')) {
        return false;
      }
      const projectProgress =
        (task as any).projectProgress ??
        (task as any).projectStatus ??
        (task as any).progress ??
        (task as any).cooperationStatus;
      if (String(projectProgress || '').trim() === '已验收待打包') {
        return false;
      }
      if (keyword) {
        const name = String(task.name || '').toLowerCase();
        if (!name.includes(keyword)) return false;
      }
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
  }, [viewTasks, taskTypeFilter, resourceFilter, nameSearch]);

  const getTaskSpanRange = useCallback((task: Task): { start?: Date; end?: Date } => {
    const start = task.startDate ? new Date(task.startDate) : (task.endDate ? new Date(task.endDate) : (task.deadline ? new Date(task.deadline) : undefined));
    const endBase = task.endDate ? new Date(task.endDate) : (task.startDate ? new Date(task.startDate) : (task.deadline ? new Date(task.deadline) : undefined));
    const end = resizingTaskId === task.id && resizePreviewEndDate ? new Date(resizePreviewEndDate) : endBase;
    if (!start || !end) return { start, end };
    const s = toStartOfDay(start);
    const e = toStartOfDay(end);
    return e < s ? { start: e, end: e } : { start: s, end: e };
  }, [resizingTaskId, resizePreviewEndDate]);

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
        debug: '1',
      });

      console.log('[矩阵日历] 正在加载视图数据...', config.viewId);

      const response = await fetch(`/api/feishu/load-requirements2-view?${params}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加载视图数据失败');
      }

      if (data.success) {
        console.log('[矩阵日历] 视图数据加载成功:', data.tasks.length, '个任务', data.debug || '');
        const sourceStampedTasks: Task[] = normalizeTasks(
          (data.tasks as Task[]).map((task) => ({
            ...task,
            taskSource: 'matrix_view',
            sourceViewId: config.viewId,
          }))
        );
        // 数据库优先：飞书重载仅做增量更新，和当前持久任务做合并
        const mergedViewTasks = mergeViewTasksWithLocalState(sourceStampedTasks, tasks);
        setViewTasks(mergedViewTasks);
        onViewTasksLoaded?.(mergedViewTasks);
      } else {
        throw new Error(data.error || '加载视图数据失败');
      }
    } catch (error) {
      console.error('[矩阵日历] 加载视图数据失败:', error);
      setViewError(String(error));
    } finally {
      setViewLoading(false);
    }
  }, [tasks, onViewTasksLoaded]);

  // 加载视图数据函数（供外部按钮调用）
  const loadViewData = useCallback(async () => {
    if (!feishuConfig?.viewId) {
      setViewTasks([]);
      setViewError('未配置矩阵视图ID（requirements2Matrix），已停止回退全量任务数据');
      return;
    }
    await fetchAndSetViewTasks(feishuConfig);
  }, [feishuConfig, tasks, fetchAndSetViewTasks]);

  // 兜底：当前 viewId 在数据库无任务时，自动拉取一次该视图并入库（仅触发一次，避免回刷）
  useEffect(() => {
    const activeViewId = (feishuConfig?.viewId || '').trim();
    if (!activeViewId) return;
    if (viewLoading) return;
    if (viewTasks.length === 0) {
      if (autoHydratedViewIdRef.current === activeViewId) return;
      autoHydratedViewIdRef.current = activeViewId;
      void loadViewData();
      return;
    }

    if (viewTasks.length < 60) {
      if (autoHydratedLowCountViewIdRef.current === activeViewId) return;
      autoHydratedLowCountViewIdRef.current = activeViewId;
      void loadViewData();
    }
  }, [feishuConfig?.viewId, viewTasks.length, viewLoading, loadViewData]);

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
      const days = Array.from(newSet);
      void syncCalendarExtraWorkDays(days).catch((error) => {
        console.error('[矩阵日历] 同步加班/调休日失败:', error);
      });
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

  const visibleDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const week of monthWeeks) {
      for (const day of week.days) {
        set.add(format(day, 'yyyy-MM-dd'));
      }
    }
    return set;
  }, [monthWeeks]);

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

  const resolveTaskDate = useCallback((task: Task): Date | undefined => {
    if (task.endDate) return new Date(task.endDate);
    if (task.startDate) return new Date(task.startDate);
    if (task.deadline) return new Date(task.deadline);
    return undefined;
  }, []);

  // 获取所有未分配类型的任务（用于任务池）- 使用视图数据
  const unassignedTasks = useMemo(() => {
    const candidates = filteredViewTasks.filter(task => {
      if (!task.taskType) return true;
      const { start, end } = getTaskSpanRange(task);
      if (!start || !end) return true;
      if (!isWorkingDay(start, extraWorkDays)) return true;
      if (!isWorkingDay(end, extraWorkDays)) return true;
      return false;
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
  }, [filteredViewTasks, extraWorkDays, getTaskSpanRange]);

  const handleResizeStart = useCallback((task: Task, event: React.PointerEvent<HTMLDivElement>) => {
    if (!task.taskType) return;
    const { start, end } = getTaskSpanRange(task);
    if (!start || !end) return;
    resizingTaskRef.current = task;
    setResizingTaskId(task.id);
    setResizePreviewEndDate(end);

    const pointerId = event.pointerId;
    (event.currentTarget as HTMLDivElement).setPointerCapture(pointerId);

    const handleMove = (e: PointerEvent) => {
      const elements = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[];
      const cell = elements.find((node) => node?.closest?.('[data-date][data-tasktype]'))?.closest?.('[data-date][data-tasktype]') as HTMLElement | null;
      if (calendarScrollRef.current) {
        const rect = calendarScrollRef.current.getBoundingClientRect();
        const edge = 48;
        if (e.clientY < rect.top + edge) {
          calendarScrollRef.current.scrollBy({ top: -24, behavior: 'auto' });
        } else if (e.clientY > rect.bottom - edge) {
          calendarScrollRef.current.scrollBy({ top: 24, behavior: 'auto' });
        }
      }
      if (!cell) return;
      const dateStr = cell.dataset.date;
      if (!dateStr) return;
      let date = toStartOfDay(new Date(dateStr));
      if (!isWorkingDay(date, extraWorkDays)) {
        date = getPrevWorkingDay(date, extraWorkDays);
      }
      const startDay = toStartOfDay(start);
      if (date < startDay) {
        date = startDay;
      }
      setResizePreviewEndDate(date);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const taskForCommit = resizingTaskRef.current;
      const endDate = resizePreviewEndRef.current;
      setResizingTaskId(null);
      resizingTaskRef.current = null;
      setResizePreviewEndDate(null);
      if (!taskForCommit || !endDate) return;
      const { start: committedStart } = getTaskSpanRange(taskForCommit);
      if (!committedStart) return;
      const updates: Partial<Task> = {
        startDate: committedStart,
        endDate: endDate,
      };
      setViewTasks(prev => normalizeTasks(prev.map(t => (t.id === taskForCommit.id ? { ...t, ...updates } : t))));
      onTaskUpdate?.(taskForCommit.id, updates, taskForCommit);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [extraWorkDays, getTaskSpanRange, onTaskUpdate]);

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

    // 如果拖拽到任务池，清除类型和日期
    if (overData.isTaskPool) {
      const draggedTaskKey = getTaskUniqueKey(currentDraggedTask);
      // 直接更新 viewTasks
      setViewTasks(prev => normalizeTasks(prev.map(t => {
        if (!isSameLogicalTask(t, currentDraggedTask) && getTaskUniqueKey(t) !== draggedTaskKey) return t;
        return { ...t, taskType: undefined, startDate: undefined, endDate: undefined };
      })));
      // 同时通知父组件
      if (onTaskUpdate) {
        onTaskUpdate(currentDraggedTask.id, { taskType: undefined, startDate: undefined, endDate: undefined }, currentDraggedTask);
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

    const { start: existingStart, end: existingEnd } = getTaskSpanRange(currentDraggedTask);
    const duration = existingStart && existingEnd ? countWorkingDaysInRange(existingStart, existingEnd, extraWorkDays) : 1;
    const startDate = finalTargetDate;
    const endDate = addWorkingDays(startDate, duration - 1, extraWorkDays);
    const updates: Partial<Task> = {
      startDate,
      endDate,
    };

    // 如果任务没有类型，拖拽后自动设置类型
    if (!currentDraggedTask.taskType) {
      updates.taskType = targetTaskType;
    }

    console.log('[矩阵日历] 拖拽设置起止日期:', currentDraggedTask.name, '->', format(startDate, 'yyyy-MM-dd'), '~', format(endDate, 'yyyy-MM-dd'));

    // 直接更新 viewTasks（立即反映在日历上）
    setViewTasks(prev => normalizeTasks(prev.map(t => {
      if (!isSameLogicalTask(t, currentDraggedTask)) return t;
      return { ...t, ...updates };
    })));

    // 同时通知父组件同步更新
    if (onTaskUpdate) {
      onTaskUpdate(currentDraggedTask.id, updates, currentDraggedTask);
    }
  }, [onTaskUpdate, extraWorkDays, getTaskSpanRange]);

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
    const sourceTask = selectedTask || viewTasks.find(t => t.id === taskId);

    // 更新 viewTasks 中的任务
    let updatedTask: Task | undefined;
    setViewTasks(prev => normalizeTasks(prev.map(t => {
      const matchedById = t.id === taskId;
      const matchedByLogical = sourceTask ? isSameLogicalTask(t, sourceTask) : false;
      if (!matchedById && !matchedByLogical) return t;
      updatedTask = { ...t, ...updates } as ExtendedTask;
      return updatedTask;
    })));
    
    // 同时通知父组件同步更新
    if (onTaskUpdate) {
      const syncTask = updatedTask || sourceTask;
      onTaskUpdate(syncTask?.id || taskId, updates, syncTask);
    }
  }, [onTaskUpdate, viewTasks, selectedTask]);

  const resourceNameMap = useMemo(() => {
    return new Map(resources.map((r) => [r.id, r.name]));
  }, [resources]);

  const getOwnerNames = useCallback((task: Task) => {
    const owners = (task.assignedResources || [])
      .map((id) => resourceNameMap.get(id) || id)
      .filter(Boolean);
    return owners.length ? owners.join('、') : '-';
  }, [resourceNameMap]);

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
          <div className="min-w-0 flex-1 flex flex-col items-end gap-1">
            <Input
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="搜索任务名称"
              className="h-8 w-[260px]"
            />
            <div className="text-sm text-muted-foreground min-w-0 text-right">
              {draggedTask ? (
                <span className="text-blue-600 font-medium block truncate">
                  🔄 正在移动: {draggedTask.name}
                </span>
              ) : (
                <span className="block truncate">💡 提示: 拖拽任务卡片移动日期 | 点击休息日设为加班日</span>
              )}
            </div>
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
              totalCount={filteredViewTasks.length}
              draggedTask={draggedTask}
              onTaskClick={handleTaskClick}
              getOwnerNames={getOwnerNames}
              projects={projects}
              projectFilter={unassignedProjectFilter}
              onProjectFilterChange={setUnassignedProjectFilter}
            />
          </div>

          {/* 右侧周表格 */}
          <div className="h-full min-w-0 flex-1">
            <div ref={calendarScrollRef} className="h-full overflow-y-auto overflow-x-hidden">
              {monthWeeks.map((week) => (
                <WeekTable
                  key={week.weekNumber}
                  weekNumber={week.weekNumber}
                  weekDays={week.days}
                  tasks={filteredViewTasks}
                  currentMonth={currentDate}
                  draggedTask={deferredDraggedTask}
                  onTaskClick={handleTaskClick}
                  getOwnerNames={getOwnerNames}
                  extraWorkDays={extraWorkDays}
                  onToggleExtraWorkDay={toggleExtraWorkDay}
                  getTaskSpanRange={getTaskSpanRange}
                  onResizeStart={handleResizeStart}
                  resizingTaskId={resizingTaskId}
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
          extraWorkDays={extraWorkDays}
          allTasks={viewTasks}
          onAddSubTask={(subTask) => onAddSubTask?.(subTask)}
          onUpdateSubTask={(subTaskId, updates) => onUpdateSubTask?.(subTaskId, updates)}
          onDeleteSubTask={(subTaskId) => onDeleteSubTask?.(subTaskId)}
        />
      </div>
      <DragOverlay>
        {draggedTask ? (
          <div
            className="px-2 py-1 rounded text-xs border shadow-lg bg-white/95 border-blue-300 text-slate-800 max-w-64"
            style={{ pointerEvents: 'none' }}
          >
            <div className="flex items-center gap-1">
              <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">
                {draggedTask.projectName ? `【${draggedTask.projectName}】` : ''}
                {draggedTask.name}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
