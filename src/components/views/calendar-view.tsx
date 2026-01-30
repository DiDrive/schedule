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

  // 判断是否是工作日（周一到周五）
  const isWorkDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=周一, 5=周五
  };

  // 按日期分组任务（只包括工作日，且只显示真正有工作的日期）
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Array<{ task: Task; timeRanges: string[] }>> = {};

    scheduledTasks.forEach(scheduledTask => {
      const startDate = new Date(scheduledTask.startDate!);
      const endDate = new Date(scheduledTask.endDate!);

      // 模拟 calculateEndDate 的工作时间分配过程
      // 只添加真正有实际工作的日期
      let currentDate = new Date(startDate);
      const startWorkHour = 9.5; // 9:30
      const endWorkHour = 19; // 19:00
      const lunchStart = 12; // 12:00
      const lunchEnd = 13.5; // 13:30

      while (currentDate <= endDate) {
        if (!isWorkDay(currentDate)) {
          // 非工作日，跳过
          currentDate.setDate(currentDate.getDate() + 1);
          currentDate.setHours(0, 0, 0, 0);
          continue;
        }

        // 计算这一天的实际工作时间
        const dayStart = new Date(currentDate);
        dayStart.setHours(Math.floor(startWorkHour), (startWorkHour % 1) * 60, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(Math.floor(endWorkHour), (endWorkHour % 1) * 60, 0, 0);

        const lunchStartTime = new Date(currentDate);
        lunchStartTime.setHours(Math.floor(lunchStart), (lunchStart % 1) * 60, 0, 0);

        const lunchEndTime = new Date(currentDate);
        lunchEndTime.setHours(Math.floor(lunchEnd), (lunchEnd % 1) * 60, 0, 0);

        // 确定任务在当天的实际工作时段
        let actualTaskStart = new Date(currentDate);
        if (currentDate.getTime() < dayStart.getTime()) {
          actualTaskStart = dayStart;
        }

        let actualTaskEnd = new Date(endDate);
        if (actualTaskEnd.getTime() > dayEnd.getTime()) {
          actualTaskEnd = dayEnd;
        }

        // 计算这一天的实际工作小时数（考虑午休）
        let dailyWorkHours = 0;
        const timeRanges: string[] = [];

        // 如果任务在午休前开始
        if (actualTaskStart < lunchStartTime && actualTaskEnd > lunchStartTime) {
          // 午休前的工作时间
          const workBeforeLunch = Math.min(lunchStartTime.getTime(), actualTaskEnd.getTime()) - actualTaskStart.getTime();
          dailyWorkHours += workBeforeLunch;

          if (workBeforeLunch > 0) {
            const workBeforeEnd = new Date(actualTaskStart.getTime() + workBeforeLunch);
            timeRanges.push(`${format(actualTaskStart, 'HH:mm')}-${format(workBeforeEnd, 'HH:mm')}`);
          }

          // 午休后的工作时间
          if (actualTaskEnd > lunchEndTime) {
            const workAfterLunch = actualTaskEnd.getTime() - lunchEndTime.getTime();
            dailyWorkHours += workAfterLunch;

            if (workAfterLunch > 0) {
              const workAfterEnd = new Date(lunchEndTime.getTime() + workAfterLunch);
              timeRanges.push(`${format(lunchEndTime, 'HH:mm')}-${format(workAfterEnd, 'HH:mm')}`);
            }
          }
        } else if (actualTaskStart >= lunchEndTime) {
          // 在午休后工作
          dailyWorkHours = actualTaskEnd.getTime() - actualTaskStart.getTime();
          if (dailyWorkHours > 0) {
            timeRanges.push(`${format(actualTaskStart, 'HH:mm')}-${format(actualTaskEnd, 'HH:mm')}`);
          }
        } else if (actualTaskEnd <= lunchStartTime) {
          // 在午休前工作
          dailyWorkHours = actualTaskEnd.getTime() - actualTaskStart.getTime();
          if (dailyWorkHours > 0) {
            timeRanges.push(`${format(actualTaskStart, 'HH:mm')}-${format(actualTaskEnd, 'HH:mm')}`);
          }
        }

        // 转换为小时
        dailyWorkHours = dailyWorkHours / (1000 * 60 * 60);

        // 只有当天有实际工作时间（>0）才显示任务
        if (dailyWorkHours > 0 && timeRanges.length > 0) {
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          // 避免重复添加同一任务
          if (!grouped[dateKey].find(t => t.task.id === scheduledTask.id)) {
            grouped[dateKey].push({ task: scheduledTask, timeRanges });
          }
        }

        // 移动到下一天
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }
    });

    return grouped;
  }, [scheduledTasks]);

  // 获取当月范围的任务日期（只包括工作日，且只显示真正有工作的日期）
  const monthTasks: Record<string, Array<{ task: Task; timeRanges: string[] }>> = useMemo(() => {
    const tasksInMonth: Record<string, Array<{ task: Task; timeRanges: string[] }>> = {};

    scheduledTasks.forEach(scheduledTask => {
      const startDate = new Date(scheduledTask.startDate!);
      const endDate = new Date(scheduledTask.endDate!);

      // 模拟 calculateEndDate 的工作时间分配过程
      // 只添加真正有实际工作且在当前月份的日期
      let taskDate = new Date(startDate);
      const startWorkHour = 9.5; // 9:30
      const endWorkHour = 19; // 19:00
      const lunchStart = 12; // 12:00
      const lunchEnd = 13.5; // 13:30

      while (taskDate <= endDate) {
        if (!isWorkDay(taskDate)) {
          // 非工作日，跳过
          taskDate.setDate(taskDate.getDate() + 1);
          taskDate.setHours(0, 0, 0, 0);
          continue;
        }

        if (!isSameMonth(taskDate, currentDate)) {
          // 不在当前月份，跳过
          taskDate.setDate(taskDate.getDate() + 1);
          taskDate.setHours(0, 0, 0, 0);
          continue;
        }

        // 计算这一天的实际工作时间
        const dayStart = new Date(taskDate);
        dayStart.setHours(Math.floor(startWorkHour), (startWorkHour % 1) * 60, 0, 0);

        const dayEnd = new Date(taskDate);
        dayEnd.setHours(Math.floor(endWorkHour), (endWorkHour % 1) * 60, 0, 0);

        const lunchStartTime = new Date(taskDate);
        lunchStartTime.setHours(Math.floor(lunchStart), (lunchStart % 1) * 60, 0, 0);

        const lunchEndTime = new Date(taskDate);
        lunchEndTime.setHours(Math.floor(lunchEnd), (lunchEnd % 1) * 60, 0, 0);

        // 确定任务在当天的实际工作时段
        let actualTaskStart = new Date(taskDate);
        if (taskDate.getTime() < dayStart.getTime()) {
          actualTaskStart = dayStart;
        }

        let actualTaskEnd = new Date(endDate);
        if (actualTaskEnd.getTime() > dayEnd.getTime()) {
          actualTaskEnd = dayEnd;
        }

        // 计算这一天的实际工作小时数（考虑午休）
        let dailyWorkHours = 0;
        const timeRanges: string[] = [];

        // 如果任务在午休前开始
        if (actualTaskStart < lunchStartTime && actualTaskEnd > lunchStartTime) {
          // 午休前的工作时间
          const workBeforeLunch = Math.min(lunchStartTime.getTime(), actualTaskEnd.getTime()) - actualTaskStart.getTime();
          dailyWorkHours += workBeforeLunch;

          if (workBeforeLunch > 0) {
            const workBeforeEnd = new Date(actualTaskStart.getTime() + workBeforeLunch);
            timeRanges.push(`${format(actualTaskStart, 'HH:mm')}-${format(workBeforeEnd, 'HH:mm')}`);
          }

          // 午休后的工作时间
          if (actualTaskEnd > lunchEndTime) {
            const workAfterLunch = actualTaskEnd.getTime() - lunchEndTime.getTime();
            dailyWorkHours += workAfterLunch;

            if (workAfterLunch > 0) {
              const workAfterEnd = new Date(lunchEndTime.getTime() + workAfterLunch);
              timeRanges.push(`${format(lunchEndTime, 'HH:mm')}-${format(workAfterEnd, 'HH:mm')}`);
            }
          }
        } else if (actualTaskStart >= lunchEndTime) {
          // 在午休后工作
          dailyWorkHours = actualTaskEnd.getTime() - actualTaskStart.getTime();
          if (dailyWorkHours > 0) {
            timeRanges.push(`${format(actualTaskStart, 'HH:mm')}-${format(actualTaskEnd, 'HH:mm')}`);
          }
        } else if (actualTaskEnd <= lunchStartTime) {
          // 在午休前工作
          dailyWorkHours = actualTaskEnd.getTime() - actualTaskStart.getTime();
          if (dailyWorkHours > 0) {
            timeRanges.push(`${format(actualTaskStart, 'HH:mm')}-${format(actualTaskEnd, 'HH:mm')}`);
          }
        }

        // 转换为小时
        dailyWorkHours = dailyWorkHours / (1000 * 60 * 60);

        // 只有当天有实际工作时间（>0）才显示任务
        if (dailyWorkHours > 0 && timeRanges.length > 0 && isSameMonth(taskDate, currentDate)) {
          const dateKey = format(taskDate, 'yyyy-MM-dd');
          if (!tasksInMonth[dateKey]) {
            tasksInMonth[dateKey] = [];
          }
          // 避免重复添加同一任务
          if (!tasksInMonth[dateKey].find(t => t.task.id === scheduledTask.id)) {
            tasksInMonth[dateKey].push({ task: scheduledTask, timeRanges });
          }
        }

        // 移动到下一天
        taskDate.setDate(taskDate.getDate() + 1);
        taskDate.setHours(0, 0, 0, 0);
      }
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
            const isWeekend = !isWorkDay(day);

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border rounded-lg ${
                  !isCurrentMonth ? 'bg-slate-50' : isWeekend ? 'bg-slate-100' : 'bg-white'
                } ${isToday ? 'border-blue-500' : 'border-slate-200'} hover:border-blue-300 transition-colors`}
              >
                <div className={`text-sm font-medium mb-2 ${!isCurrentMonth || isWeekend ? 'text-slate-400' : ''} ${isToday ? 'text-blue-600' : ''}`}>
                  {format(day, 'd')}
                </div>

                {/* 只在工作日显示任务 */}
                {!isWeekend && (
                  <div className="space-y-1 overflow-y-auto max-h-[80px]">
                    {dayTasks.map(({ task: scheduledTask, timeRanges }, taskIndex) => {
                      const task = getTaskDetails(scheduledTask);
                      const resource = getResource(scheduledTask.assignedResources[0]!);
                      const isMultiDay = isMultiDayTask(scheduledTask, day);

                      if (!task) return null;

                      // 检查任务是否超期
                      const isOverdue = task.deadline && task.endDate && task.endDate > task.deadline;

                      return (
                        <div
                          key={taskIndex}
                          className={`text-xs p-1.5 rounded cursor-pointer border-2 ${
                            isOverdue
                              ? 'bg-red-50 text-red-800 border-red-600 hover:bg-red-100'
                              : task.taskType === '平面'
                              ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                              : task.taskType === '后期'
                              ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                              : 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
                          }`}
                          title={`${task.name}\n负责人: ${resource?.name || '未分配'}\n时间: ${timeRanges.join(', ')}${isOverdue ? '\n⚠️ 已超期' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate flex-1 font-medium">{task.name}</span>
                            {isOverdue && <span className="text-[10px] text-red-600 font-bold ml-1">超期</span>}
                            {isMultiDay && <span className="text-[10px] ml-1">↔</span>}
                          </div>
                          {resource && (
                            <div className="truncate text-[10px] opacity-75">
                              {resource.name}
                            </div>
                          )}
                          <div className="truncate text-[10px] opacity-75 mt-0.5">
                            {timeRanges.join(', ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 统计信息 */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100 border-2 border-green-300"></div>
              <span>平面任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-100 border-2 border-blue-300"></div>
              <span>后期任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-100 border-2 border-orange-300"></div>
              <span>物料任务</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-50 border-2 border-red-600"></div>
              <span className="text-red-600 font-medium">超期任务</span>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            本月工作日任务: {Object.values(monthTasks).flat().length} 项
          </div>
          <div className="text-xs text-slate-500 mt-1">
            * 仅显示工作日（周一至周五）的任务安排
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
