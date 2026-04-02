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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isSameDay, 
  isWeekend,
  getWeek,
  differenceInDays
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 任务类型配置
const TASK_TYPES: { key: ResourceWorkType; label: string }[] = [
  { key: '脚本', label: '脚本' },
  { key: '平面', label: '平面节点' },
  { key: '后期', label: '后期节点' },
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
              <Badge variant="outline">
                {task.taskType || '未指定'}
              </Badge>
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

// 任务卡片组件 - 统一白色背景
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

// 任务单元格组件
function TaskCell({
  date,
  taskType,
  weekNumber,
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
  weekNumber: number;
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
  const isToday = isSameDay(date, new Date());
  const isWeekendDay = isWeekend(date);

  return (
    <div
      className={`
        w-28 min-w-28 min-h-[80px] border-r border-b flex flex-col
        ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-slate-50' : 'bg-white'}
        ${isDragOver ? 'bg-green-100 ring-2 ring-green-400 ring-inset' : ''}
        transition-colors
      `}
      onDragOver={(e) => onDragOver(e, date, taskType)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, date, taskType)}
    >
      <div
        className="flex-1 p-1 overflow-y-auto space-y-1"
        style={{ maxHeight: '150px' }}
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
      
      // 只包含在当前月内的周（至少有一天在月内）
      const hasDayInMonth = weekDays.some(day => {
        const month = currentDate.getMonth();
        return day.getMonth() === month;
      });
      
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

  // 星期几标签（固定7列）
  const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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

    // 分配任务到对应日期和类型
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

  // 生成所有行：任务类型 × 周数
  const rows = useMemo(() => {
    const result: { taskType: ResourceWorkType; weekNumber: number; label: string }[] = [];
    
    // 先按周分组，再按任务类型分组
    monthWeeks.forEach(week => {
      TASK_TYPES.forEach(taskType => {
        result.push({
          taskType: taskType.key,
          weekNumber: week.weekNumber,
          label: `${taskType.label}-第${week.weekNumber}周`,
        });
      });
    });
    
    return result;
  }, [monthWeeks]);

  // 处理拖拽
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDraggedTask(task);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverCell(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date, taskType: ResourceWorkType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTask && draggedTask.taskType === taskType) {
      setDragOverCell({ date, taskType });
    }
  }, [draggedTask]);

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date, targetTaskType: ResourceWorkType) => {
    e.preventDefault();
    if (!draggedTask) return;
    if (draggedTask.taskType !== targetTaskType) return;

    const originalStartDate = draggedTask.startDate ? new Date(draggedTask.startDate) : new Date();
    const originalEndDate = draggedTask.endDate ? new Date(draggedTask.endDate) : originalStartDate;
    const durationDays = differenceInDays(originalEndDate, originalStartDate);

    const newStartDate = new Date(targetDate);
    newStartDate.setHours(0, 0, 0, 0);
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    if (onTaskUpdate) {
      onTaskUpdate(draggedTask.id, {
        startDate: newStartDate,
        endDate: newEndDate,
      });
    }

    setDraggedTask(null);
    setDragOverCell(null);
  }, [draggedTask, onTaskUpdate]);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  }, []);

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

  const handleThisMonth = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();

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
          <Button variant="outline" size="sm" onClick={handleThisMonth}>
            本月
          </Button>
        </div>
        <div className="text-lg font-semibold">
          {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
        </div>
        <div className="text-sm text-muted-foreground">
          拖拽任务卡片可调整日期（同类型内）
        </div>
      </div>

      {/* 矩阵表格 */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <div className="min-w-max">
          {/* 表头 - 类型列标签 + 星期行 */}
          <div className="sticky top-0 z-20 flex bg-slate-700 text-white">
            {/* 左侧固定列 - 类型标签 */}
            <div className="w-32 min-w-32 p-2 border-r border-slate-600 font-medium text-center sticky left-0 z-30 bg-slate-700">
              类型\日期
            </div>
            {/* 星期列头 - 固定7列 */}
            {weekDayLabels.map((label, idx) => (
              <div
                key={idx}
                className="w-28 min-w-28 p-2 border-r border-slate-600 text-center"
              >
                <div className="font-medium">{label}</div>
              </div>
            ))}
          </div>

          {/* 数据行 - 任务类型 × 周数 */}
          {rows.map((row, rowIdx) => {
            // 找到这一周对应的日期
            const weekData = monthWeeks.find(w => w.weekNumber === row.weekNumber);
            if (!weekData) return null;

            return (
              <div key={`${row.taskType}-${row.weekNumber}`} className="flex border-b last:border-b-0">
                {/* 行标签 - 任务类型 + 周数 */}
                <div
                  className="w-32 min-w-32 p-2 border-r font-medium text-center sticky left-0 z-10 bg-slate-100 flex items-center justify-center"
                >
                  {row.label}
                </div>

                {/* 日期单元格 - 一周7天 */}
                {weekData.days.map((day, dayIdx) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const cellTasks = tasksByDateAndType[`${dateKey}-${row.taskType}`] || [];
                  const isDragOver = dragOverCell &&
                    isSameDay(dragOverCell.date, day) &&
                    dragOverCell.taskType === row.taskType;

                  return (
                    <TaskCell
                      key={dayIdx}
                      date={day}
                      taskType={row.taskType}
                      weekNumber={row.weekNumber}
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
            );
          })}
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
