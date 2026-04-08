'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Task, Resource, ResourceWorkType } from '@/types/schedule';
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
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  DragOverlayProps,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';

// 任务类型配置 - 不同颜色
const TASK_TYPE_CONFIG: { key: ResourceWorkType; label: string; bgColor: string; borderColor: string }[] = [
  { key: '脚本', label: '脚本', bgColor: 'bg-indigo-100', borderColor: 'border-indigo-300' },
  { key: '平面', label: '平面节点', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-300' },
  { key: '后期', label: '后期节点', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
];

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
}

// 任务详情弹窗组件
function TaskDetailDialog({
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

  const availableResources = useMemo(() => {
    if (!task) return resources.filter(r => r.type === 'human');
    const taskType = task.taskType;
    if (!taskType) return resources.filter(r => r.type === 'human');
    return resources.filter(r => r.type === 'human' && r.workType === taskType);
  }, [resources, task]);

  useEffect(() => {
    if (task) {
      setEditedTask({
        name: task.name,
        description: task.description || '',
        projectId: task.projectId,
        estimatedHours: task.estimatedHours,
        startDate: task.startDate,
        endDate: task.endDate,
        assignedResources: task.assignedResources,
        fixedResourceId: task.fixedResourceId,
        fixedResourceIdGraphic: task.fixedResourceIdGraphic,
        fixedResourceIdPost: task.fixedResourceIdPost,
      });
    }
  }, [task]);

  const handleSave = useCallback(() => {
    if (!task) return;
    onSave(task.id, editedTask);
    onClose();
  }, [task, editedTask, onSave, onClose]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">负责人</label>
            <Select
              value={editedTask.fixedResourceId || 'none'}
              onValueChange={(value) => setEditedTask({ ...editedTask, fixedResourceId: value === 'none' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择负责人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分配</SelectItem>
                {availableResources.map(resource => (
                  <SelectItem key={resource.id} value={resource.id}>
                    {resource.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* 日期范围 */}
          <div className="grid grid-cols-2 gap-4">
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
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存更改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 获取任务类型样式
function getTypeStyle(taskType?: ResourceWorkType): string {
  switch (taskType) {
    case '脚本':
      return 'bg-indigo-100 border-indigo-300 hover:bg-indigo-200';
    case '平面':
      return 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200';
    case '后期':
      return 'bg-amber-100 border-amber-300 hover:bg-amber-200';
    default:
      return 'bg-white border-gray-200 hover:bg-gray-50';
  }
}

// 可拖拽的任务卡片组件
function DraggableTaskCard({
  task,
  onClick,
  isDragging,
}: {
  task: Task;
  onClick: () => void;
  isDragging: boolean;
}) {
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;

  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: `task-${task.id}`,
    data: {
      task,
      taskType: task.taskType,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        userSelect: 'none',
      }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`
        px-2 py-1 rounded text-xs cursor-grab active:cursor-grabbing
        border transition-all truncate flex items-center gap-1
        ${getTypeStyle(task.taskType)}
        ${isDragging || isBeingDragged ? 'opacity-30 scale-95' : 'hover:shadow-sm'}
      `}
      title={`${displayName}\n拖拽移动日期`}
    >
      <GripVertical className="h-3 w-3 text-slate-400 flex-shrink-0" />
      <span className="truncate">{displayName}</span>
    </div>
  );
}

// 拖拽覆盖层卡片
function DragOverlayCard({ task }: { task: Task }) {
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;

  return (
    <div
      className={`
        px-2 py-1 rounded text-xs cursor-grabbing
        border shadow-lg truncate flex items-center gap-1
        ${getTypeStyle(task.taskType)}
      `}
    >
      <GripVertical className="h-3 w-3 text-slate-400" />
      <span className="truncate">{displayName}</span>
    </div>
  );
}

// 可放置的单元格组件
function DroppableCell({
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
  const today = new Date();
  const isToday = isSameDay(day, today);
  const isWeekendDay = isWeekend(day);
  const dateStr = format(day, 'yyyy-MM-dd');
  const isHoliday = ALL_HOLIDAYS.has(dateStr);
  const isOriginallyRest = isOriginallyRestDay(day);
  const isExtraWorkDay = extraWorkDays.has(dateStr);
  const isWorkDay = isWorkingDay(day, extraWorkDays);
  const cellId = `cell-${dateStr}-${taskType}`;
  
  // 非工作日不允许放置，但仍然可以接收拖拽事件（用于判断是否是工作日）
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: {
      date: day,
      taskType,
      isWorkingDay: isWorkDay, // 传递是否是工作日的信息
    },
    disabled: !isWorkDay, // 非工作日禁用拖放
  });

  const isDragOver = isOver && draggedTask && draggedTask.taskType === taskType && isWorkDay;

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
}

// 单周表格组件
function WeekTable({
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
  const today = new Date();
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
            const isToday = isSameDay(day, today);
            const isWeekendDay = isWeekend(day);
            const isInMonth = isSameMonth(day, currentMonth);
            const dateStr = format(day, 'yyyy-MM-dd');
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
}

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
}: MatrixCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  
  // 调休/加班日状态
  const [extraWorkDays, setExtraWorkDays] = useState<Set<string>>(() => new Set());
  
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

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移动 5px 才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor),
  );

  // 组件挂载日志
  useEffect(() => {
    const dates = scheduledTasks
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

  // 获取项目列表
  const projects = useMemo(() => {
    const projectMap = new Map<string, { id: string; name: string }>();
    tasks.forEach(task => {
      if (task.projectId && task.projectName) {
        projectMap.set(task.projectId, { id: task.projectId, name: task.projectName });
      }
    });
    return Array.from(projectMap.values());
  }, [tasks]);

  // 按日期和类型分组任务（只在结束日期显示，排除周末和节假日）
  const tasksByDateAndType = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    const addedIds = new Set<string>();

    scheduledTasks.forEach(task => {
      if (!task.startDate) return;

      const endDate = task.endDate ? new Date(task.endDate) : new Date(task.startDate);
      const dateKey = format(endDate, 'yyyy-MM-dd');
      const taskType = task.taskType || '平面';
      
      // 只在工作日显示任务（不考虑调休日，因为调休是用户手动设置的）
      if (isWorkingDay(endDate, undefined)) {
        const key = `${dateKey}-${taskType}`;
        if (!addedIds.has(task.id)) {
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(task);
          addedIds.add(task.id);
        }
      }
    });

    return grouped;
  }, [scheduledTasks]);

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

    const targetDate = overData.date as Date;
    const targetTaskType = overData.taskType as ResourceWorkType;
    const targetIsWorkingDay = overData.isWorkingDay as boolean;

    // 检查类型是否匹配
    if (currentDraggedTask.taskType !== targetTaskType) {
      return;
    }

    // 检查目标日期是否是工作日（考虑调休日），如果不是则自动调整到下一个工作日
    let finalTargetDate = new Date(targetDate);
    finalTargetDate.setHours(0, 0, 0, 0);
    if (!targetIsWorkingDay) {
      finalTargetDate = getNextWorkingDay(targetDate, extraWorkDays);
    }

    // 计算日期偏移量
    const originalEndDate = currentDraggedTask.endDate ? new Date(currentDraggedTask.endDate) : new Date(currentDraggedTask.startDate!);
    originalEndDate.setHours(0, 0, 0, 0);
    const dayOffset = Math.round((finalTargetDate.getTime() - originalEndDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 如果没有偏移，不需要更新
    if (dayOffset === 0) {
      return;
    }

    // 计算新的日期
    const originalStartDate = new Date(currentDraggedTask.startDate!);
    const newStartDate = new Date(originalStartDate);
    newStartDate.setDate(newStartDate.getDate() + dayOffset);
    const newEndDate = new Date(finalTargetDate);

    if (onTaskUpdate) {
      onTaskUpdate(currentDraggedTask.id, {
        startDate: newStartDate,
        endDate: newEndDate,
      });
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
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full">
        {/* 月份切换控制 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
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
          <div className="text-lg font-semibold">
            {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
          </div>
          <div className="text-sm text-muted-foreground">
            {draggedTask ? (
              <span className="text-blue-600 font-medium">
                🔄 正在移动: {draggedTask.name}
              </span>
            ) : (
              <span>💡 提示: 拖拽任务卡片移动日期 | 点击休息日设为加班日</span>
            )}
          </div>
        </div>

        {/* 拖拽提示条 */}
        {draggedTask && (
          <div className="mb-2 p-3 bg-blue-50 border border-blue-300 rounded-lg flex items-center justify-between shadow-sm">
            <span className="text-sm text-blue-700">
              正在移动: <strong className="text-blue-900">{draggedTask.name}</strong>
              {draggedTask.projectName && <span className="text-blue-500 ml-1">（{draggedTask.projectName}）</span>}
            </span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
              放开鼠标放置任务
            </span>
          </div>
        )}

        {/* 周表格列表 */}
        <div className="flex-1 overflow-y-auto">
          {monthWeeks.map((week) => (
            <WeekTable
              key={week.weekNumber}
              weekNumber={week.weekNumber}
              weekDays={week.days}
              tasksByDateAndType={tasksByDateAndType}
              currentMonth={currentDate}
              draggedTask={draggedTask}
              onTaskClick={handleTaskClick}
              extraWorkDays={extraWorkDays}
              onToggleExtraWorkDay={toggleExtraWorkDay}
            />
          ))}
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

      {/* 拖拽覆盖层 */}
      <DragOverlay>
        {draggedTask ? (
          <DragOverlayCard task={draggedTask} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
