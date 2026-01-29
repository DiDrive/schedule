'use client';

import React, { useState, useMemo } from 'react';
import { Task, Resource } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface CalendarViewProps {
  scheduledTasks: Task[];
  resources: Resource[];
  tasks: Task[];
}

export function CalendarView({ scheduledTasks, resources, tasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 获取当月的所有日期
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    return days;
  }, [currentDate]);

  // 获取当月的周范围（包括上个月和下个月的部分日期）
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { locale: zhCN });
    const end = endOfWeek(endOfMonth(currentDate), { locale: zhCN });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // 按日期分组任务
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    scheduledTasks.forEach(scheduledTask => {
      const startDate = new Date(scheduledTask.startDate!);
      const endDate = new Date(scheduledTask.endDate!);

      // 为任务的每一天添加任务
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(scheduledTask);
      });
    });

    return grouped;
  }, [scheduledTasks]);

  // 获取当月范围的任务日期
  const monthTasks: Record<string, Task[]> = useMemo(() => {
    const tasksInMonth: Record<string, Task[]> = {};

    scheduledTasks.forEach(scheduledTask => {
      const startDate = new Date(scheduledTask.startDate!);
      const endDate = new Date(scheduledTask.endDate!);

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach(day => {
        if (isSameMonth(day, currentDate)) {
          const dateKey = format(day, 'yyyy-MM-dd');
          if (!tasksInMonth[dateKey]) {
            tasksInMonth[dateKey] = [];
          }
          if (!tasksInMonth[dateKey].includes(scheduledTask)) {
            tasksInMonth[dateKey].push(scheduledTask);
          }
        }
      });
    });

    return tasksInMonth;
  }, [scheduledTasks, currentDate]);

  // 获取任务对应的资源
  const getResource = (resourceId: string) => {
    return resources.find(r => r.id === resourceId);
  };

  // 获取任务详情
  const getTaskDetails = (scheduledTask: Task) => {
    const task = tasks.find(t => t.id === scheduledTask.id);
    return task;
  };

  // 判断任务是否跨天
  const isMultiDayTask = (scheduledTask: Task, date: Date) => {
    const startDate = new Date(scheduledTask.startDate!);
    const endDate = new Date(scheduledTask.endDate!);
    return !isSameDay(startDate, endDate);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>排期日历</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              今天
            </Button>
            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[140px] text-center">
              {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 星期标题 */}
        <div className="grid grid-cols-7 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="text-center font-medium text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border rounded-lg ${
                  !isCurrentMonth ? 'bg-slate-50' : 'bg-white'
                } ${isToday ? 'border-blue-500' : 'border-slate-200'} hover:border-blue-300 transition-colors`}
              >
                <div className={`text-sm font-medium mb-2 ${!isCurrentMonth ? 'text-slate-400' : ''} ${isToday ? 'text-blue-600' : ''}`}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[80px]">
                  {dayTasks.map((scheduledTask, taskIndex) => {
                    const task = getTaskDetails(scheduledTask);
                    const resource = getResource(scheduledTask.assignedResources[0]!);
                    const isMultiDay = isMultiDayTask(scheduledTask, day);

                    if (!task) return null;

                    return (
                      <div
                        key={taskIndex}
                        className={`text-xs p-1.5 rounded cursor-pointer truncate ${
                          task.taskType === '平面'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : task.taskType === '后期'
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                        }`}
                        title={`${task.name}\n负责人: ${resource?.name || '未分配'}\n${format(new Date(scheduledTask.startDate!), 'HH:mm')} - ${format(new Date(scheduledTask.endDate!), 'HH:mm')}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate flex-1">{task.name}</span>
                          {isMultiDay && <span className="text-[10px] ml-1">↔</span>}
                        </div>
                        {resource && (
                          <div className="truncate text-[10px] opacity-75">
                            {resource.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 统计信息 */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100"></div>
              <span>平面任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-100"></div>
              <span>后期任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-100"></div>
              <span>物料任务</span>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            本月总任务: {Object.values(monthTasks).flat().length} 项
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
