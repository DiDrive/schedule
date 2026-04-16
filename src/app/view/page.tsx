'use client';

import React, { useState, useMemo, useEffect, memo } from 'react';
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

  // 从数据库加载数据
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
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
        }));
        setTasks(convertedTasks);
        
        // 转换资源
        const convertedResources: Resource[] = data.resources.map(dbRes => ({
          id: dbRes.id,
          name: dbRes.name,
          type: dbRes.type as Resource['type'],
          workType: dbRes.work_type as Resource['workType'],
          availability: 1, // 默认可用性为 100%
        }));
        setResources(convertedResources);
        
        // 设置调休/加班日
        setExtraWorkDays(new Set(data.calendarExtraWorkDays || []));
        
        console.log('[展示端] 加载数据完成:', convertedTasks.length, '个任务');
      } catch (error) {
        console.error('[展示端] 加载数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

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

  // 计算日历周
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
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
            {/* 日历头部 */}
            <div className="flex border-b border-slate-200">
              <div className="w-20 min-w-20"></div>
              {weeks.slice(0, 7).map((day, idx) => {
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

            {/* 日历内容 */}
            <div>
              {TASK_TYPE_CONFIG.map((taskType) => (
                <div key={taskType.key} className="flex border-b last:border-b-0 border-slate-200">
                  <div className={`w-20 min-w-20 p-2 border-r border-slate-300 text-center font-medium text-sm ${taskType.bgColor}`}>
                    {taskType.label}
                  </div>

                  {weeks.slice(0, 7).map((day, dayIdx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const cellTasks = tasksByDateAndType[`${dateKey}-${taskType.key}`] || [];
                    const isInMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    const isWorkDay = isWorkingDay(day, extraWorkDays);
                    const isHoliday = isWeekend(day) || HOLIDAYS_2025.has(dateKey);

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

            {/* 统计信息 */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <span>任务总数：<strong className="text-slate-800">{filteredTasks.length}</strong></span>
                <span>本周有日期任务：<strong className="text-slate-800">{Object.keys(tasksByDateAndType).length}</strong></span>
                <span className="text-xs text-slate-400">
                  最后更新：{format(new Date(), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
