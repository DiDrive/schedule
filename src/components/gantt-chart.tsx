import { Task, ScheduleResult, Resource } from '@/types/schedule';

interface GanttChartProps {
  scheduleResult: ScheduleResult;
  resources?: Resource[];
  projects?: { id: string; color: string }[];
  showHour?: boolean;
}

export default function GanttChart({ scheduleResult, resources, projects, showHour = true }: GanttChartProps) {
  if (scheduleResult.tasks.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        暂无任务数据
      </div>
    );
  }

  // 计算时间范围
  const startDate = scheduleResult.tasks[0].startDate || new Date();
  const endDate = scheduleResult.tasks.reduce(
    (max, task) => (task.endDate && task.endDate > max ? task.endDate : max),
    startDate
  );

  // 计算总天数
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // 生成日期刻度
  const dateLabels = Array.from({ length: totalDays + 1 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });

  // 格式化时间显示
  const formatDateTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
  };

  const formatDateShort = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateLong = (date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  // 获取任务颜色
  const getTaskColor = (task: Task, isCritical: boolean) => {
    if (isCritical) return '#ef4444'; // 红色表示关键路径
    
    // 优先使用项目颜色
    if (projects && task.projectId) {
      const project = projects.find(p => p.id === task.projectId);
      if (project?.color) return project.color;
    }
    
    // 其次使用资源颜色
    if (resources && task.assignedResources.length > 0) {
      const resource = resources.find(r => r.id === task.assignedResources[0]);
      if (resource?.color) return resource.color;
    }
    
    return '#3b82f6'; // 默认蓝色
  };

  // 计算任务在甘特图上的位置
  const getTaskPosition = (task: Task) => {
    const taskStart = task.startDate || startDate;
    const taskEnd = task.endDate || startDate;

    const startOffset = (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24);

    return {
      left: (startOffset / totalDays) * 100,
      width: (duration / totalDays) * 100
    };
  };

  // 计算每列的宽度（根据总天数动态调整）
  const columnWidth = Math.max(60, Math.min(120, 600 / totalDays));

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* 表头 - 日期刻度 */}
        <div className="flex border-b bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
          {/* 任务名称列 */}
          <div className="w-48 flex-shrink-0 p-3 text-sm font-semibold border-r dark:border-slate-700">
            任务名称
          </div>
          {/* 日期刻度 */}
          <div className="flex flex-1">
            {dateLabels.map((date, index) => (
              <div
                key={index}
                className="text-xs text-center border-r dark:border-slate-700 py-2 px-1 flex-shrink-0"
                style={{ width: columnWidth }}
                title={formatDateLong(date)}
              >
                {formatDateShort(date)}
              </div>
            ))}
          </div>
        </div>

        {/* 任务行 */}
        <div className="divide-y dark:divide-slate-700">
          {scheduleResult.tasks.map(task => {
            const isCritical = scheduleResult.criticalPath.includes(task.id);
            const position = getTaskPosition(task);
            const taskColor = getTaskColor(task, isCritical);

            return (
              <div key={task.id} className="flex hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                {/* 任务名称列 */}
                <div className="w-48 flex-shrink-0 p-3 text-sm border-r dark:border-slate-700">
                  <div className="font-medium truncate" title={task.name}>{task.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {showHour ? formatDateTime(task.startDate || startDate) : (task.startDate || startDate).toLocaleDateString()}
                  </div>
                </div>

                {/* 甘特图条 */}
                <div className="flex flex-1 relative" style={{ minHeight: '40px' }}>
                  {/* 网格线 */}
                  {dateLabels.map((_, index) => (
                    <div
                      key={index}
                      className="absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800"
                      style={{ left: (index / totalDays) * 100 + '%', width: `${100 / totalDays}%` }}
                    />
                  ))}

                  {/* 任务条 */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-6 rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    style={{
                      left: `${position.left}%`,
                      width: `${Math.max(position.width, 0.5)}%`,
                      backgroundColor: taskColor
                    }}
                    title={`${task.name}: ${formatDateTime(task.startDate || startDate)} - ${formatDateTime(task.endDate || endDate)}`}
                  />

                  {/* 关键路径标记 */}
                  {isCritical && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6 w-1.5 bg-red-600 rounded-l"
                      style={{ left: `${position.left}%` }}
                      title="关键路径"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="flex gap-4 mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>普通任务</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>关键路径</span>
          </div>
          {resources && resources.length > 0 && (
            <div className="flex items-center gap-2">
              <span>不同颜色代表不同资源</span>
            </div>
          )}
          {projects && projects.length > 0 && (
            <div className="flex items-center gap-2">
              <span>不同颜色代表不同项目</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
