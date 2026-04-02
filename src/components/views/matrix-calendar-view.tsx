'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Task, Resource, ResourceWorkType } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, GripVertical, Clock, User, FileText, Calendar as CalendarIcon, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isWeekend, parseISO, set } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 任务类型配置（矩阵日历专用）
type MatrixTaskType = ResourceWorkType | '脚本';

const TASK_TYPES: { key: MatrixTaskType; label: string; color: string }[] = [
  { key: '脚本', label: '脚本', color: '#6366f1' },
  { key: '平面', label: '平面节点', color: '#10b981' },
  { key: '后期', label: '后期节点', color: '#f59e0b' },
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

  const getResourceName = (resourceId: string | undefined) => {
    if (!resourceId) return '未分配';
    const resource = resources.find(r => r.id === resourceId);
    return resource?.name || '未知';
  };

  const getProjectName = (projectId: string | undefined) => {
    if (!projectId) return '未指定';
    const project = projects.find(p => p.id === projectId);
    return project?.name || task.projectName || '未知';
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
  const getTaskColor = () => {
    const taskType = task.taskType;
    if (taskType === '平面') return { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800' };
    if (taskType === '后期') return { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' };
    if (taskType === '物料') return { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' };
    return { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' };
  };

  const colors = getTaskColor();

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        ${colors.bg} ${colors.border} ${colors.text}
        px-2 py-1.5 rounded text-xs cursor-pointer
        border hover:shadow-md transition-all
        flex items-center gap-1 group
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
      `}
    >
      <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-50 flex-shrink-0" />
      <span className="truncate flex-1" title={displayName}>
        {displayName}
      </span>
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
  const [dragOverCell, setDragOverCell] = useState<{ date: Date; taskType: MatrixTaskType } | null>(null);

  // 获取当前月的所有日期
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
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

  // 根据任务类型和日期分组任务
  const tasksByTypeAndDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    // 初始化所有日期的任务数组
    monthDays.forEach(day => {
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
  }, [scheduledTasks, monthDays]);

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
  const handleDragOver = useCallback((e: React.DragEvent, date: Date, taskType: MatrixTaskType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // 检查任务类型是否匹配（只能同类型拖拽）
    if (draggedTask && draggedTask.taskType === taskType) {
      setDragOverCell({ date, taskType });
    }
  }, [draggedTask]);

  // 处理拖拽离开单元格
  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  // 处理放置
  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date, targetTaskType: MatrixTaskType) => {
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

    // 设置新的开始日期为放置日期的当天开始
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

      {/* 矩阵表格 */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <div className="min-w-max">
          {/* 表头 - 日期行 */}
          <div className="sticky top-0 z-20 bg-slate-800 text-white">
            <div className="flex">
              {/* 左上角固定单元格 */}
              <div className="w-24 min-w-24 p-2 border-r border-slate-600 font-medium text-center sticky left-0 z-30 bg-slate-800">
                类型\日期
              </div>
              {/* 日期列 */}
              {monthDays.map((day, idx) => {
                const isToday = isSameDay(day, new Date());
                const isWeekendDay = isWeekend(day);
                return (
                  <div
                    key={idx}
                    className={`
                      w-20 min-w-20 p-2 border-r border-slate-600 text-center
                      ${isToday ? 'bg-blue-600' : isWeekendDay ? 'bg-slate-700' : ''}
                    `}
                  >
                    <div className="text-xs opacity-80">
                      {format(day, 'E', { locale: zhCN })}
                    </div>
                    <div className="font-medium">
                      {format(day, 'M.d')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 任务类型行 */}
          {TASK_TYPES.map((taskType, typeIdx) => (
            <div key={taskType.key} className="flex border-b last:border-b-0">
              {/* 任务类型标签 */}
              <div
                className="w-24 min-w-24 p-2 border-r font-medium text-center sticky left-0 z-10 bg-slate-50 flex items-center justify-center"
                style={{ backgroundColor: taskType.color + '20' }}
              >
                <span style={{ color: taskType.color }}>{taskType.label}</span>
              </div>

              {/* 日期单元格 */}
              {monthDays.map((day, dayIdx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const cellKey = `${dateKey}-${taskType.key}`;
                const cellTasks = tasksByTypeAndDate[cellKey] || [];
                const isToday = isSameDay(day, new Date());
                const isWeekendDay = isWeekend(day);
                const isDragOver = dragOverCell &&
                  isSameDay(dragOverCell.date, day) &&
                  dragOverCell.taskType === taskType.key;

                return (
                  <div
                    key={dayIdx}
                    className={`
                      w-20 min-w-20 min-h-16 p-1 border-r
                      transition-colors
                      ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-slate-50' : 'bg-white'}
                      ${isDragOver ? 'bg-green-100 ring-2 ring-green-400' : ''}
                      hover:bg-slate-100
                    `}
                    onDragOver={(e) => handleDragOver(e, day, taskType.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day, taskType.key)}
                  >
                    {cellTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => handleTaskClick(task)}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedTask?.id === task.id}
                      />
                    ))}
                  </div>
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
