'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Task, Resource, ResourceWorkType } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, isWeekend } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 任务类型配置（矩阵日历专用）
type MatrixTaskType = ResourceWorkType | '脚本';

const TASK_TYPES: { key: MatrixTaskType; label: string; color: string; bgColor: string }[] = [
  { key: '脚本', label: '脚本', color: '#6366f1', bgColor: 'bg-indigo-100' },
  { key: '平面', label: '平面节点', color: '#10b981', bgColor: 'bg-emerald-100' },
  { key: '后期', label: '后期节点', color: '#f59e0b', bgColor: 'bg-amber-100' },
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

  if (!task) return null;

  const handleSave = () => {
    onSave(task.id, editedTask);
    onClose();
  };

  // 根据任务类型筛选可用资源
  const availableResources = useMemo(() => {
    const taskType = task.taskType;
    if (!taskType) return resources.filter(r => r.type === 'human');
    return resources.filter(r => r.type === 'human' && r.workType === taskType);
  }, [resources, task.taskType]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>任务详情</DialogTitle>
          <DialogDescription>
            查看和编辑任务信息
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 任务名称 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">任务名称</label>
            <Input
              value={editedTask.name || ''}
              onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
              placeholder="输入任务名称"
            />
          </div>

          {/* 所属项目 */}
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

          {/* 任务类型 */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">任务类型</label>
            <div className="flex items-center gap-2">
              <Badge variant={task.taskType === '平面' ? 'default' : task.taskType === '后期' ? 'secondary' : 'outline'}>
                {task.taskType || '未指定'}
              </Badge>
            </div>
          </div>

          {/* 负责人 */}
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

          {/* 工时 */}
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
              <label className="text-sm font-medium">开始日期</label>
              <Input
                type="date"
                value={editedTask.startDate ? format(new Date(editedTask.startDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => setEditedTask({ ...editedTask, startDate: e.target.value ? new Date(e.target.value) : undefined })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">结束日期</label>
              <Input
                type="date"
                value={editedTask.endDate ? format(new Date(editedTask.endDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => setEditedTask({ ...editedTask, endDate: e.target.value ? new Date(e.target.value) : undefined })}
              />
            </div>
          </div>

          {/* 描述 */}
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
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存更改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 任务卡片组件
function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;

  // 获取任务颜色
  const getTaskStyle = () => {
    const taskType = task.taskType;
    if (taskType === '平面') return { bg: 'bg-emerald-50', border: 'border-l-emerald-400', text: 'text-emerald-700' };
    if (taskType === '后期') return { bg: 'bg-amber-50', border: 'border-l-amber-400', text: 'text-amber-700' };
    if (taskType === '物料') return { bg: 'bg-blue-50', border: 'border-l-blue-400', text: 'text-blue-700' };
    return { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-700' };
  };

  const style = getTaskStyle();

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        ${style.bg} ${style.border} ${style.text}
        px-1.5 py-0.5 rounded text-xs cursor-pointer
        border-l-2 hover:shadow-sm transition-all
        truncate
        ${isDragging ? 'opacity-50' : ''}
      `}
      title={displayName}
    >
      {displayName}
    </div>
  );
}

// 日期单元格组件
function DateCell({
  date,
  isCurrentMonth,
  isToday,
  tasksByType,
  onTaskClick,
  onDragStart,
  onDragEnd,
  draggedTask,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasksByType: Record<string, Task[]>;
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  draggedTask: Task | null;
  onDragOver: (e: React.DragEvent, date: Date) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
  isDragOver: boolean;
}) {
  const dateKey = format(date, 'yyyy-MM-dd');

  return (
    <div
      className={`
        min-h-[100px] p-1 border-r border-b
        ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}
        ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}
        ${isDragOver ? 'bg-green-50' : ''}
        transition-colors
      `}
      onDragOver={(e) => onDragOver(e, date)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, date)}
    >
      {/* 日期数字 */}
      <div className={`
        text-sm font-medium mb-1
        ${isToday ? 'text-blue-600' : isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}
      `}>
        {format(date, 'd')}
      </div>

      {/* 按类型分组的任务 */}
      {TASK_TYPES.map(taskType => {
        const typeTasks = tasksByType[`${dateKey}-${taskType.key}`] || [];
        if (typeTasks.length === 0) return null;

        return (
          <div key={taskType.key} className="mb-1">
            {/* 类型标签 */}
            <div className="text-[10px] text-slate-500 mb-0.5">{taskType.label}</div>
            {/* 任务列表 */}
            <div className="space-y-0.5">
              {typeTasks.slice(0, 3).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  isDragging={draggedTask?.id === task.id}
                />
              ))}
              {typeTasks.length > 3 && (
                <div className="text-[10px] text-slate-500 pl-1">
                  +{typeTasks.length - 3} 更多
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MatrixCalendarView({
  scheduledTasks,
  resources,
  tasks,
  onTaskClick,
  onTaskUpdate,
}: MatrixCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  // 获取日历日期（包含上月和下月的填充日期）
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: zhCN, weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { locale: zhCN, weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // 将日期按周分组
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

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

    // 初始化所有日期的任务数组
    calendarDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      TASK_TYPES.forEach(type => {
        grouped[`${dateKey}-${type.key}`] = [];
      });
    });

    // 分配任务到对应日期和类型
    scheduledTasks.forEach(task => {
      if (!task.startDate) return;

      const startDate = new Date(task.startDate);
      const endDate = task.endDate ? new Date(task.endDate) : startDate;

      // 遍历任务时间范围内的所有日期
      let currentDateIter = new Date(startDate);
      while (currentDateIter <= endDate) {
        const dateKey = format(currentDateIter, 'yyyy-MM-dd');
        const taskType = task.taskType || '平面';

        const key = `${dateKey}-${taskType}`;
        if (grouped[key] && !grouped[key].find(t => t.id === task.id)) {
          grouped[key].push(task);
        }

        currentDateIter.setDate(currentDateIter.getDate() + 1);
      }
    });

    return grouped;
  }, [scheduledTasks, calendarDays]);

  // 处理拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDraggedTask(task);
  }, []);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverDate(null);
  }, []);

  // 处理拖拽经过日期单元格
  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(date);
  }, []);

  // 处理拖拽离开
  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  // 处理放置
  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();

    if (!draggedTask) return;

    // 计算新的开始日期
    const originalStartDate = draggedTask.startDate ? new Date(draggedTask.startDate) : new Date();
    const originalEndDate = draggedTask.endDate ? new Date(draggedTask.endDate) : originalStartDate;

    // 计算任务持续时间（天数）
    const durationDays = Math.ceil((originalEndDate.getTime() - originalStartDate.getTime()) / (1000 * 60 * 60 * 24));

    // 设置新的开始日期
    const newStartDate = new Date(targetDate);
    newStartDate.setHours(0, 0, 0, 0);

    // 计算新的结束日期
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    // 更新任务
    if (onTaskUpdate) {
      onTaskUpdate(draggedTask.id, {
        startDate: newStartDate,
        endDate: newEndDate,
      });
    }

    setDraggedTask(null);
    setDragOverDate(null);
  }, [draggedTask, onTaskUpdate]);

  // 处理任务点击
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
    if (onTaskClick) {
      onTaskClick(task);
    }
  }, [onTaskClick]);

  // 处理任务保存
  const handleTaskSave = useCallback((taskId: string, updates: Partial<Task>) => {
    if (onTaskUpdate) {
      onTaskUpdate(taskId, updates);
    }
  }, [onTaskUpdate]);

  // 切换月份
  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  return (
    <div className="flex flex-col h-full">
      {/* 月份切换控制 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            今天
          </Button>
        </div>
        <div className="text-lg font-semibold">
          {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
        </div>
        <div className="text-sm text-muted-foreground">
          拖拽任务卡片可调整日期
        </div>
      </div>

      {/* 日历表格 */}
      <div className="flex-1 overflow-auto border rounded-lg">
        {/* 表头 - 星期行 */}
        <div className="sticky top-0 z-20 bg-slate-800 text-white grid grid-cols-7">
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, idx) => (
            <div
              key={day}
              className={`
                p-2 text-center font-medium text-sm border-r last:border-r-0
                ${idx >= 5 ? 'bg-slate-700' : ''}
              `}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日历主体 - 按周分行 */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((day, dayIdx) => {
              const isCurrentMonth = day >= monthStart && day <= monthEnd;
              const isToday = isSameDay(day, today);
              const isDragOver = dragOverDate ? isSameDay(dragOverDate, day) : false;

              return (
                <DateCell
                  key={dayIdx}
                  date={day}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isToday}
                  tasksByType={tasksByDateAndType}
                  onTaskClick={handleTaskClick}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  draggedTask={draggedTask}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  isDragOver={isDragOver}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 任务详情弹窗 */}
      <TaskDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleTaskSave}
        resources={resources}
        projects={projects}
      />
    </div>
  );
}

export default MatrixCalendarView;
