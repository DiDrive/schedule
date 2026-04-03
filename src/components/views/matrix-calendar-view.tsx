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
}: {
  day: Date;
  taskType: ResourceWorkType;
  cellTasks: Task[];
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
  isInMonth: boolean;
}) {
  const today = new Date();
  const isToday = isSameDay(day, today);
  const isWeekendDay = isWeekend(day);
  const cellId = `cell-${format(day, 'yyyy-MM-dd')}-${taskType}`;
  
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: {
      date: day,
      taskType,
    },
  });

  const isDragOver = isOver && draggedTask && draggedTask.taskType === taskType;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 min-w-24 min-h-[60px] p-1 border-r last:border-r-0 border-slate-200
        ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-slate-50/50' : 'bg-white'}
        ${isDragOver ? 'bg-green-100 ring-2 ring-green-400 ring-inset' : ''}
        ${!isInMonth ? 'opacity-40' : ''}
        transition-colors
      `}
    >
      <div className="space-y-1 min-h-[40px]">
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
}: {
  weekNumber: number;
  weekDays: Date[];
  tasksByDateAndType: Record<string, Task[]>;
  currentMonth: Date;
  draggedTask: Task | null;
  onTaskClick: (task: Task) => void;
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

            return (
              <div
                key={idx}
                className={`
                  flex-1 min-w-24 p-2 border-r last:border-r-0 border-slate-300 text-center
                  ${isToday ? 'bg-blue-100' : isWeekendDay ? 'bg-slate-50' : ''}
                  ${!isInMonth ? 'opacity-40' : ''}
                `}
              >
                <div className="text-xs text-slate-500">
                  {format(day, 'E', { locale: zhCN })}
                </div>
                <div className={`font-medium text-sm ${isToday ? 'text-blue-600' : ''}`}>
                  {format(day, 'M.d')}
                </div>
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

  // 按日期和类型分组任务
  const tasksByDateAndType = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    scheduledTasks.forEach(task => {
      if (!task.startDate) return;

      const startDate = new Date(task.startDate);
      const endDate = task.endDate ? new Date(task.endDate) : startDate;

      let currentDateIter = new Date(startDate);
      while (currentDateIter <= endDate) {
        const dateKey = format(currentDateIter, 'yyyy-MM-dd');
        const taskType = task.taskType || '平面';

        const key = `${dateKey}-${taskType}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        if (!grouped[key].find(t => t.id === task.id)) {
          grouped[key].push(task);
        }

        currentDateIter.setDate(currentDateIter.getDate() + 1);
      }
    });

    return grouped;
  }, [scheduledTasks]);

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const taskData = active.data.current;
    if (taskData?.task) {
      console.log('[矩阵日历] 开始拖拽任务:', taskData.task.name);
      setDraggedTask(taskData.task);
    }
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const currentDraggedTask = draggedTaskRef.current;
    
    console.log('[矩阵日历] 拖拽结束:', active.id, '->', over?.id);

    if (!over || !currentDraggedTask) {
      console.log('[矩阵日历] 没有目标或没有拖拽任务');
      setDraggedTask(null);
      return;
    }

    const overData = over.data.current;
    console.log('[矩阵日历] over.data:', overData);
    
    if (!overData) {
      console.log('[矩阵日历] 没有 overData');
      setDraggedTask(null);
      return;
    }

    const targetDate = overData.date as Date;
    const targetTaskType = overData.taskType as ResourceWorkType;

    console.log('[矩阵日历] 目标日期:', targetDate ? format(targetDate, 'yyyy-MM-dd') : 'null', '目标类型:', targetTaskType);

    // 检查类型是否匹配
    if (currentDraggedTask.taskType !== targetTaskType) {
      console.log('[矩阵日历] 类型不匹配:', currentDraggedTask.taskType, 'vs', targetTaskType);
      setDraggedTask(null);
      return;
    }

    // 计算新的日期范围
    const originalStartDate = currentDraggedTask.startDate ? new Date(currentDraggedTask.startDate) : new Date();
    const originalEndDate = currentDraggedTask.endDate ? new Date(currentDraggedTask.endDate) : originalStartDate;
    const durationDays = differenceInDays(originalEndDate, originalStartDate);

    const newStartDate = new Date(targetDate);
    newStartDate.setHours(0, 0, 0, 0);
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    console.log('[矩阵日历] 更新任务日期:', {
      taskName: currentDraggedTask.name,
      originalStart: format(originalStartDate, 'yyyy-MM-dd'),
      newStart: format(newStartDate, 'yyyy-MM-dd'),
      durationDays
    });

    if (onTaskUpdate) {
      onTaskUpdate(currentDraggedTask.id, {
        startDate: newStartDate,
        endDate: newEndDate,
      });
    }

    setDraggedTask(null);
  }, [onTaskUpdate]);

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
              <span>💡 提示: 拖拽任务卡片可移动日期</span>
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
