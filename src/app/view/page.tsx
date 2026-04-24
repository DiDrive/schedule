'use client';

import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Grid3X3 } from 'lucide-react';
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
  isSameMonth,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { loadAllData } from '@/storage/database/db-service';
import type { Task, Resource, ResourceWorkType } from '@/types/schedule';

// 任务类型配置
const TASK_TYPE_CONFIG: { key: ResourceWorkType; label: string; bgColor: string; borderColor: string }[] = [
  { key: '脚本', label: '脚本', bgColor: 'bg-indigo-100', borderColor: 'border-indigo-400' },
  { key: '平面', label: '平面节点', bgColor: 'bg-teal-100', borderColor: 'border-teal-400' },
  { key: '后期', label: '后期节点', bgColor: 'bg-orange-100', borderColor: 'border-orange-400' },
];

// 2025年法定节假日
const HOLIDAYS_2025: Set<string> = new Set([
  '2025-01-01',
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
  '2025-04-04', '2025-04-05', '2025-04-06',
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
  '2025-05-31', '2025-06-01', '2025-06-02',
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
]);

// 检查是否是工作日
function isWorkingDay(date: Date, extraWorkDays?: Set<string>): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  if (extraWorkDays?.has(dateStr)) return true;
  if (isWeekend(date)) return false;
  if (HOLIDAYS_2025.has(dateStr)) return false;
  return true;
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

function getTaskUniqueKey(task: Task): string {
  const displayKey = getTaskDisplayKey(task);
  if (displayKey) return `biz:${displayKey}`;
  return `id:${task.id}`;
}

function getTaskCompletenessScore(task: Task): number {
  let score = 0;
  if (task.taskType) score += 4;
  if (task.endDate || task.startDate || task.deadline) score += 3;
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
    assignedResources: primary.assignedResources?.length ? primary.assignedResources : (secondary.assignedResources || []),
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

function getTaskDate(task: Task): Date | undefined {
  if (task.endDate) return new Date(task.endDate);
  if (task.startDate) return new Date(task.startDate);
  if (task.deadline) return new Date(task.deadline);
  return undefined;
}

// 翻页按钮
function NavButton({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent h-8 w-8"
    >
      {direction === 'prev' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );
}

// 任务卡片（只读，无拖拽）
const ReadonlyTaskCard = memo(function ReadonlyTaskCard({
  task,
}: {
  task: Task;
}) {
  const getTypeStyle = () => {
    switch (task.taskType) {
      case '脚本':
        return 'bg-indigo-100 border-indigo-400';
      case '平面':
        return 'bg-teal-100 border-teal-400';
      case '后期':
        return 'bg-orange-100 border-orange-400';
      default:
        return 'bg-gray-100 border-gray-400';
    }
  };

  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`
        px-1 py-0.5 rounded text-xs border cursor-default
        ${getTypeStyle()}
        ${isCompleted ? 'opacity-60 line-through' : ''}
      `}
      title={`${task.name}${task.endDate ? '\n完成日期: ' + format(new Date(task.endDate), 'yyyy-MM-dd') : ''}`}
    >
      <span className="truncate block">{task.name}</span>
    </div>
  );
});

export default function ViewPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [extraWorkDays, setExtraWorkDays] = useState<Set<string>>(new Set());
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | '脚本' | '平面' | '后期'>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const loadData = useCallback(async (showLoading: boolean) => {
    try {
      if (showLoading) setIsLoading(true);
      const data = await loadAllData();

      // 转换任务
      const convertedTasks: Task[] = data.tasks.map(dbTask => ({
        id: dbTask.id,
        name: dbTask.name,
        description: dbTask.description || '',
        estimatedHours: dbTask.estimated_hours || 0,
        assignedResources: (dbTask.assigned_resources as string[]) || [],
        deadline: dbTask.deadline ? new Date(dbTask.deadline) : undefined,
        priority: (dbTask.priority as Task['priority']) || 'normal',
        status: (dbTask.status as Task['status']) || 'pending',
        taskType: dbTask.task_type as Task['taskType'],
        projectId: dbTask.project_id,
        projectName: dbTask.project_name,
        startDate: dbTask.start_date ? new Date(dbTask.start_date) : undefined,
        endDate: dbTask.end_date ? new Date(dbTask.end_date) : undefined,
        category: dbTask.category,
        subType: dbTask.sub_type,
        language: dbTask.language,
        dubbing: dbTask.dubbing,
        contactPerson: dbTask.contact_person,
        businessMonth: dbTask.business_month,
      }));
      setTasks(normalizeTasks(convertedTasks));

      // 转换资源
      const convertedResources: Resource[] = data.resources.map(dbRes => ({
        id: dbRes.id,
        name: dbRes.name,
        type: dbRes.type as Resource['type'],
        workType: dbRes.work_type as Resource['workType'],
        availability: 1,
      }));
      setResources(convertedResources);
      setExtraWorkDays(new Set(data.calendarExtraWorkDays || []));
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('[展示端] 加载数据失败:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // 初次加载 + 实时轮询
  useEffect(() => {
    loadData(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  // 筛选后的任务
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) {
        return false;
      }
      if (resourceFilter !== 'all') {
        const assignedIds = task.assignedResources || [];
        if (!assignedIds.includes(resourceFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, taskTypeFilter, resourceFilter]);

  // 计算当前月份所有周（每周 7 天）
  const monthWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weeks: { weekNumber: number; days: Date[] }[] = [];
    let currentWeekStart = calStart;

    while (currentWeekStart <= calEnd) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
      const hasDayInMonth = weekDays.some((day) => isSameMonth(day, currentDate));

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

  // 按日期和类型分组任务
  const tasksByDateAndType = useMemo(() => {
    const grouped: Record<string, Task[]> = Object.create(null);

    for (const task of filteredTasks) {
      if (!task.taskType) continue;

      let taskDate: Date | undefined;
      if (task.endDate) {
        taskDate = new Date(task.endDate);
      } else if (task.startDate) {
        taskDate = new Date(task.startDate);
      } else if (task.deadline) {
        taskDate = new Date(task.deadline);
      }

      if (!taskDate) continue;
      if (!isWorkingDay(taskDate, extraWorkDays)) continue;

      const dateKey = format(taskDate, 'yyyy-MM-dd');
      const key = `${dateKey}-${task.taskType}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(task);
    }

    return grouped;
  }, [filteredTasks, extraWorkDays]);

  // 仅统计“当前月份、可在矩阵中实际展示”的任务数量
  const currentMonthMatrixTaskCount = useMemo(() => {
    const uniqueKeys = new Set<string>();
    for (const task of filteredTasks) {
      if (!task.taskType) continue;
      const taskDate = getTaskDate(task);
      if (!taskDate) continue;
      if (!isSameMonth(taskDate, currentDate)) continue;
      if (!isWorkingDay(taskDate, extraWorkDays)) continue;
      uniqueKeys.add(getTaskUniqueKey(task));
    }
    return uniqueKeys.size;
  }, [filteredTasks, currentDate, extraWorkDays]);

  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  const handleThisMonth = () => setCurrentDate(new Date());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Grid3X3 className="h-6 w-6" />
            矩阵日历视图
          </h1>
          <p className="text-slate-500 mt-1">只读展示，实时同步</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              {/* 月份导航 */}
              <div className="flex items-center gap-2">
                <NavButton direction="prev" onClick={handlePrevMonth} />
                <span className="text-lg font-semibold min-w-[140px] text-center">
                  {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
                </span>
                <NavButton direction="next" onClick={handleNextMonth} />
                <Button variant="outline" size="sm" onClick={handleThisMonth}>
                  今天
                </Button>
              </div>

              {/* 筛选 */}
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => loadData(false)}>
                  立即刷新
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">任务类型：</span>
                  <Select value={taskTypeFilter} onValueChange={(v: any) => setTaskTypeFilter(v)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="脚本">脚本</SelectItem>
                      <SelectItem value="平面">平面</SelectItem>
                      <SelectItem value="后期">后期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">人员：</span>
                  <Select value={resourceFilter} onValueChange={setResourceFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部人员</SelectItem>
                      {resources
                        .filter(r => r.type === 'human')
                        .map(resource => (
                          <SelectItem key={resource.id} value={resource.id}>
                            {resource.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div>
              {monthWeeks.map((week) => (
                <div key={week.weekNumber} className="border-b border-slate-200 last:border-b-0">
                  {/* 每周头部 */}
                  <div className="flex border-b border-slate-200 bg-slate-50/60">
                    <div className="w-20 min-w-20 p-2 border-r border-slate-300 text-center text-xs font-medium text-slate-600">
                      第{week.weekNumber}周
                    </div>
                    {week.days.map((day, idx) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={idx}
                          className={`flex-1 min-w-24 p-2 border-r last:border-r-0 border-slate-300 text-center ${isToday ? 'bg-blue-50' : ''}`}
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

                  {/* 每周内容 */}
                  {TASK_TYPE_CONFIG.map((taskType) => (
                    <div key={taskType.key} className="flex border-b last:border-b-0 border-slate-200">
                      <div className={`w-20 min-w-20 p-2 border-r border-slate-300 text-center font-medium text-sm ${taskType.bgColor}`}>
                        {taskType.label}
                      </div>

                      {week.days.map((day, dayIdx) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const cellTasks = tasksByDateAndType[`${dateKey}-${taskType.key}`] || [];
                        const isInMonth = isSameMonth(day, currentDate);
                        const isToday = isSameDay(day, new Date());
                        const isWorkDay = isWorkingDay(day, extraWorkDays);

                        return (
                          <div
                            key={dayIdx}
                            className={`
                              flex-1 min-w-24 min-h-[80px] p-1 border-r last:border-r-0 border-slate-300
                              ${isToday ? 'bg-blue-50' : !isWorkDay ? 'bg-slate-50' : ''}
                              ${!isInMonth ? 'opacity-40' : ''}
                            `}
                          >
                            <div className="space-y-1">
                              {cellTasks.slice(0, 3).map((task) => (
                                <ReadonlyTaskCard key={task.id} task={task} />
                              ))}
                              {cellTasks.length > 3 && (
                                <div className="text-xs text-slate-500 text-center">
                                  +{cellTasks.length - 3} 更多
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* 统计信息 */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <span>矩阵日历任务总数：<strong className="text-slate-800">{currentMonthMatrixTaskCount}</strong></span>
                <span className="text-xs text-slate-400">
                  最后更新：{lastSyncedAt ? format(lastSyncedAt, 'yyyy-MM-dd HH:mm:ss') : '--'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
