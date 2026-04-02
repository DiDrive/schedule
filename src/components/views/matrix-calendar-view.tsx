'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isWeekend } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 任务类型配置（固定3行）
const TASK_TYPE_ROWS: { key: ResourceWorkType; label: string; color: string; bgColor: string }[] = [
  { key: '脚本', label: '脚本', color: '#6366f1', bgColor: 'bg-indigo-50' },
  { key: '平面', label: '平面节点', color: '#10b981', bgColor: 'bg-emerald-50' },
  { key: '后期', label: '后期节点', color: '#f59e0b', bgColor: 'bg-amber-50' },
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

  // 根据任务类型筛选可用资源 - 必须在条件返回之前调用
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
              <Badge variant={task.taskType === '平面' ? 'default' : task.taskType === '后期' ? 'secondary' : task.taskType === '脚本' ? 'outline' : 'outline'}>
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

          {/* 工时 - 脚本类型不显示平面/后期工时 */}
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

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        px-2 py-1 rounded text-xs cursor-pointer
        bg-white border hover:shadow-sm transition-all
        truncate
        ${isDragging ? 'opacity-50' : ''}
      `}
      title={displayName}
    >
      {displayName}
    </div>
  );
}

// 任务单元格组件 - 显示某类型在某日期的所有任务
function TaskCell({
  date,
  taskType,
  tasks,
  onTaskClick,
  onDragStart,
  onDragEnd,
  draggedTask,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  date: Date;
  taskType: ResourceWorkType;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  draggedTask: Task | null;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent, date: Date, taskType: ResourceWorkType) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date, taskType: ResourceWorkType) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = isSameDay(date, new Date());
  const isWeekendDay = isWeekend(date);

  return (
    <div
      className={`
        w-32 min-w-32 min-h-[120px] border-r border-b flex flex-col
        ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-slate-50' : 'bg-white'}
        ${isDragOver ? 'bg-green-100 ring-2 ring-green-400 ring-inset' : ''}
        transition-colors
      `}
      onDragOver={(e) => onDragOver(e, date, taskType)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, date, taskType)}
    >
      {/* 任务列表 - 可滚动 */}
      <div
        ref={scrollRef}
        className="flex-1 p-1 overflow-y-auto space-y-1"
        style={{ maxHeight: '200px' }}
      >
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedTask?.id === task.id}
          />
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-300 text-xs">
            -
          </div>
        )}
      </div>
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
  const [dragOverCell, setDragOverCell] = useState<{ date: Date; taskType: ResourceWorkType } | null>(null);

  // 获取当前周的所有日期（周一到周日）
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // 周一开始
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
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

    // 初始化所有日期和类型的任务数组
    weekDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      TASK_TYPE_ROWS.forEach(type => {
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
  }, [scheduledTasks, weekDays]);

  // 处理拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDraggedTask(task);
  }, []);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverCell(null);
  }, []);

  // 处理拖拽经过单元格
  const handleDragOver = useCallback((e: React.DragEvent, date: Date, taskType: ResourceWorkType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 只允许同类型拖拽
    if (draggedTask && draggedTask.taskType === taskType) {
      setDragOverCell({ date, taskType });
    }
  }, [draggedTask]);

  // 处理拖拽离开
  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  // 处理放置
  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date, targetTaskType: ResourceWorkType) => {
    e.preventDefault();

    if (!draggedTask) return;

    // 检查任务类型是否匹配
    if (draggedTask.taskType !== targetTaskType) {
      return;
    }

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
    setDragOverCell(null);
  }, [draggedTask, onTaskUpdate]);

  // 处理任务点击 - 只显示内部详情弹窗
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  }, []);

  // 处理任务保存
  const handleTaskSave = useCallback((taskId: string, updates: Partial<Task>) => {
    if (onTaskUpdate) {
      onTaskUpdate(taskId, updates);
    }
  }, [onTaskUpdate]);

  // 切换周
  const handlePrevWeek = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 计算当前周的范围文本
  const weekRangeText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    return `${format(start, 'M.d')} - ${format(end, 'M.d')}`;
  }, [weekDays]);

  const today = new Date();

  return (
    <div className="flex flex-col h-full">
      {/* 周切换控制 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            本周
          </Button>
        </div>
        <div className="text-lg font-semibold">
          {format(currentDate, 'yyyy年 M月')} (第 {format(currentDate, 'w')} 周)
        </div>
        <div className="text-sm text-muted-foreground">
          {weekRangeText} · 拖拽任务卡片可调整日期（同类型内）
        </div>
      </div>

      {/* 矩阵表格 */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <div className="min-w-max">
          {/* 表头 - 类型列标签 + 日期行 */}
          <div className="sticky top-0 z-20 flex bg-slate-800 text-white">
            {/* 左侧固定列 - 类型标签 */}
            <div className="w-24 min-w-24 p-2 border-r border-slate-600 font-medium text-center sticky left-0 z-30 bg-slate-800">
              类型\日期
            </div>
            {/* 日期列头 - 一周7天 */}
            {weekDays.map((day, idx) => {
              const isToday = isSameDay(day, today);
              const isWeekendDay = isWeekend(day);
              return (
                <div
                  key={idx}
                  className={`
                    w-32 min-w-32 p-2 border-r border-slate-600 text-center
                    ${isToday ? 'bg-blue-600' : isWeekendDay ? 'bg-slate-700' : ''}
                  `}
                >
                  <div className="text-xs opacity-80">
                    {format(day, 'EEEE', { locale: zhCN })}
                  </div>
                  <div className="font-medium">
                    {format(day, 'M月d日')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 任务类型行 - 固定3行 */}
          {TASK_TYPE_ROWS.map((taskType) => (
            <div key={taskType.key} className="flex border-b last:border-b-0">
              {/* 任务类型标签 - 固定在左侧 */}
              <div
                className="w-24 min-w-24 p-2 border-r font-medium text-center sticky left-0 z-10 flex items-center justify-center"
                style={{ backgroundColor: taskType.color + '15', color: taskType.color }}
              >
                {taskType.label}
              </div>

              {/* 日期单元格 - 一周7天 */}
              {weekDays.map((day, dayIdx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const cellTasks = tasksByDateAndType[`${dateKey}-${taskType.key}`] || [];
                const isDragOver = dragOverCell &&
                  isSameDay(dragOverCell.date, day) &&
                  dragOverCell.taskType === taskType.key;

                return (
                  <TaskCell
                    key={dayIdx}
                    date={day}
                    taskType={taskType.key}
                    tasks={cellTasks}
                    onTaskClick={handleTaskClick}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    draggedTask={draggedTask}
                    isDragOver={!!isDragOver}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                );
              })}
            </div>
          ))}
        </div>
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
