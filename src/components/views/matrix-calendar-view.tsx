'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  isSameMonth
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

// 任务卡片组件 - 根据类型显示不同颜色
function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const projectPrefix = task.projectName ? `【${task.projectName}】` : '';
  const displayName = projectPrefix + task.name;

  // 根据任务类型获取颜色
  const getTypeStyle = (taskType?: ResourceWorkType) => {
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
  };

  return (
    <div
      onClick={onClick}
      className={`
        px-2 py-1 rounded text-xs cursor-pointer
        border transition-all truncate
        ${getTypeStyle(task.taskType)}
      `}
      title={displayName}
    >
      {displayName}
    </div>
  );
}

// 单周表格组件
function WeekTable({
  weekNumber,
  weekDays,
  tasksByDateAndType,
  currentMonth,
  onTaskClick,
}: {
  weekNumber: number;
  weekDays: Date[];
  tasksByDateAndType: Record<string, Task[]>;
  currentMonth: Date;
  onTaskClick: (task: Task) => void;
}) {
  const today = new Date();
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];

  return (
    <div className="mb-4">
      {/* 周标题 */}
      <div className="bg-slate-700 text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
        <span className="font-medium">第{weekNumber}周</span>
        <span className="text-sm opacity-80">
          {format(weekStart, 'M.d')} - {format(weekEnd, 'M.d')}
        </span>
      </div>

      {/* 表格 */}
      <div className="border border-t-0 border-slate-300 rounded-b-lg overflow-hidden">
        {/* 表头 - 日期行 */}
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

        {/* 数据行 - 每种任务类型一行 */}
        {TASK_TYPE_CONFIG.map((taskType) => (
          <div key={taskType.key} className="flex border-b last:border-b-0 border-slate-200">
            {/* 类型标签 */}
            <div
              className={`
                w-20 min-w-20 p-2 border-r border-slate-300 text-center font-medium text-sm
                ${taskType.bgColor}
              `}
            >
              {taskType.label}
            </div>

            {/* 日期单元格 */}
            {weekDays.map((day, dayIdx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const cellTasks = tasksByDateAndType[`${dateKey}-${taskType.key}`] || [];
              const isToday = isSameDay(day, today);
              const isWeekendDay = isWeekend(day);
              const isInMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={dayIdx}
                  className={`
                    flex-1 min-w-24 min-h-[60px] p-1 border-r last:border-r-0 border-slate-200
                    ${isToday ? 'bg-blue-50' : isWeekendDay ? 'bg-slate-50/50' : 'bg-white'}
                    ${!isInMonth ? 'opacity-40' : ''}
                  `}
                >
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {cellTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(task)}
                      />
                    ))}
                    {cellTasks.length === 0 && (
                      <div className="h-8 flex items-center justify-center text-slate-300 text-xs">
                        -
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
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

      // 只包含至少有一天在当前月内的周
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
          点击任务卡片查看详情
        </div>
      </div>

      {/* 周表格列表 - 滚动区域 */}
      <div className="flex-1 overflow-y-auto">
        {monthWeeks.map((week) => (
          <WeekTable
            key={week.weekNumber}
            weekNumber={week.weekNumber}
            weekDays={week.days}
            tasksByDateAndType={tasksByDateAndType}
            currentMonth={currentDate}
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
