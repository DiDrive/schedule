import { Task, ScheduleResult, Resource, Project } from '@/types/schedule';
import { Badge } from '@/components/ui/badge';
import { calculateWorkHours } from '@/lib/schedule-algorithms';

interface ProjectColor {
  id: string;
  color: string;
  name?: string;
}

interface GanttChartProps {
  scheduleResult: ScheduleResult;
  resources?: Resource[];
  projects?: ProjectColor[];
  showHour?: boolean;
  showTaskLevel?: boolean;
  onTaskClick?: (task: Task) => void;
}

export default function GanttChart({
  scheduleResult,
  resources,
  projects,
  showHour = true,
  showTaskLevel = true,
  onTaskClick
}: GanttChartProps) {
  if (scheduleResult.tasks.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        暂无任务数据
      </div>
    );
  }

  // 工作时间配置
  const WORK_START_HOUR = 9.5; // 9:30
  const WORK_END_HOUR = 18.5; // 18:30
  const LUNCH_BREAK_START = 12; // 12:00
  const LUNCH_BREAK_END = 13.5; // 13:30
  const WORK_DAYS = [1, 2, 3, 4, 5]; // 周一到周五

  // 计算时间范围
  const firstTaskStart = scheduleResult.tasks[0].startDate || new Date();
  const lastTaskEnd = scheduleResult.tasks.reduce(
    (max, task) => (task.endDate && task.endDate > max ? task.endDate : max),
    firstTaskStart
  );

  // 标准化到整天0点
  let startDayTime = new Date(firstTaskStart);
  startDayTime.setHours(0, 0, 0, 0);

  let endDayTime = new Date(lastTaskEnd);
  endDayTime.setHours(23, 59, 59, 999);

  // 如果开始日期是周末，回退到最近的工作日
  while (!WORK_DAYS.includes(startDayTime.getDay())) {
    startDayTime.setDate(startDayTime.getDate() - 1);
  }

  // 如果结束日期是周末，前进到最近的工作日
  while (!WORK_DAYS.includes(endDayTime.getDay())) {
    endDayTime.setDate(endDayTime.getDate() + 1);
  }

  // 确保至少有1个工作日
  const tempStart = new Date(startDayTime);
  tempStart.setHours(0, 0, 0, 0);
  const tempEnd = new Date(endDayTime);
  tempEnd.setHours(0, 0, 0, 0);
  if (tempStart.getTime() === tempEnd.getTime()) {
    endDayTime.setDate(endDayTime.getDate() + 1);
  }

  // 生成所有日期（包含非工作日），用于计算工作日
  const totalCalendarDays = Math.floor((endDayTime.getTime() - startDayTime.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // 生成所有工作日（排除周末）
  const allCalendarDates = Array.from({ length: totalCalendarDays }, (_, i) => {
    const date = new Date(startDayTime);
    date.setDate(date.getDate() + i);
    return date;
  });

  const workDaysList = allCalendarDates.filter(date => WORK_DAYS.includes(date.getDay()));

  const totalWorkDays = workDaysList.length;

  // 工作日映射：日期 -> 索引
  const workDayIndexMap = new Map<string, number>();
  workDaysList.forEach((date, index) => {
    workDayIndexMap.set(date.toDateString(), index);
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

  // 获取项目颜色
  const getProjectColor = (projectId: string) => {
    const project = projects?.find(p => p.id === projectId);
    return project?.color || '#3b82f6';
  };

  // 获取任务颜色
  const getTaskColor = (task: Task, isCritical: boolean) => {
    if (isCritical) return '#ef4444'; // 红色表示关键路径

    // 优先使用项目颜色
    if (projects && task.projectId) {
      return getProjectColor(task.projectId);
    }

    // 其次使用资源颜色
    if (resources && task.assignedResources.length > 0) {
      const resource = resources.find(r => r.id === task.assignedResources[0]);
      if (resource?.color) return resource.color;
    }

    return '#3b82f6'; // 默认蓝色
  };

  // 计算任务在甘特图上的位置（基于工作日和时间段）
  const getTaskPosition = (task: Task) => {
    // 确保 taskStart 和 taskEnd 是 Date 对象
    let taskStart = task.startDate || startDayTime;
    // 对于已完成的任务，使用实际完成时间
    let taskEnd = (task.status === 'completed' && task.actualEndDate) 
      ? task.actualEndDate 
      : (task.endDate || startDayTime);

    if (!(taskStart instanceof Date)) {
      taskStart = new Date(taskStart);
    }
    if (!(taskEnd instanceof Date)) {
      taskEnd = new Date(taskEnd);
    }

    // 找到任务开始日期在工作日列表中的索引
    const taskStartDayStr = taskStart.toDateString();
    const dayIndex = workDayIndexMap.get(taskStartDayStr) ?? 0;

    // 计算当天的工作开始时间
    const taskWorkStart = new Date(taskStart);
    taskWorkStart.setHours(Math.floor(WORK_START_HOUR), (WORK_START_HOUR % 1) * 60, 0, 0);

    // 计算午休时间段
    const lunchStart = new Date(taskStart);
    lunchStart.setHours(Math.floor(LUNCH_BREAK_START), (LUNCH_BREAK_START % 1) * 60, 0, 0);

    const lunchEnd = new Date(taskStart);
    lunchEnd.setHours(Math.floor(LUNCH_BREAK_END), (LUNCH_BREAK_END % 1) * 60, 0, 0);

    // 计算任务开始时间相对于工作开始时间的偏移（排除午休）
    let startHourOffset = (taskStart.getTime() - taskWorkStart.getTime()) / (1000 * 60 * 60);

    // 如果任务开始时间在午休后，需要减去午休时间
    if (taskStart >= lunchEnd) {
      startHourOffset -= (LUNCH_BREAK_END - LUNCH_BREAK_START);
    }

    // 计算当天实际工作时间（减去午休）
    const dailyWorkHours = (WORK_END_HOUR - WORK_START_HOUR) - (LUNCH_BREAK_END - LUNCH_BREAK_START);

    // 使用实际的时间跨度（已考虑效率）计算宽度
    // 任务的实际完成时间已经由排期算法根据效率计算好了
    // 这里只需要将其转换为甘特图位置
    const actualWorkHours = calculateWorkHours(taskStart, taskEnd);

    // 计算总宽度天数（基于实际工作时间）
    let remainingDuration = actualWorkHours;
    let totalWidthDays = 0;

    // 从任务开始日期开始计算
    let currentDate = new Date(taskStart);
    let isFirstDay = true;

    while (remainingDuration > 0.001) { // 使用小阈值避免浮点数误差
      const currentDayStr = currentDate.toDateString();

      // 检查是否是工作日
      if (!WORK_DAYS.includes(currentDate.getDay())) {
        // 跳过非工作日
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      // 当天的可用工作时间
      let availableHours = dailyWorkHours;

      // 如果是第一天，从任务开始时间计算
      if (isFirstDay) {
        availableHours = dailyWorkHours - startHourOffset;
        isFirstDay = false;
      }

      // 计算当天可以使用的小时数
      const hoursUsed = Math.min(remainingDuration, availableHours);

      // 累加天数（每天都用实际工作时间占比）
      totalWidthDays += hoursUsed / dailyWorkHours;

      remainingDuration -= hoursUsed;

      // 移动到下一天
      if (remainingDuration > 0.001) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }
    }

    // 计算left位置（使用初始的startHourOffset）
    const left = ((dayIndex + startHourOffset / dailyWorkHours) / totalWorkDays) * 100;
    const width = (totalWidthDays / totalWorkDays) * 100;

    return {
      left,
      width
    };
  };

  // 计算里程碑（物料任务）在甘特图上的位置
  const getMilestonePosition = (task: Task) => {
    // 使用排期算法计算后的时间
    let materialDate = task.startDate || task.endDate || startDayTime;
    if (!(materialDate instanceof Date)) {
      materialDate = new Date(materialDate);
    }

    // 计算从时间范围开始到物料日期之间的工作日数量
    // 这样即使物料日期在周末，也能计算出正确的位置
    let workDayCount = 0;
    let currentDate = new Date(startDayTime);
    
    // 标准化物料日期到当天0点
    const materialDateNormalized = new Date(materialDate);
    materialDateNormalized.setHours(0, 0, 0, 0);
    
    // 标准化当前日期到当天0点
    currentDate.setHours(0, 0, 0, 0);
    
    // 遍历从开始日期到物料日期
    while (currentDate < materialDateNormalized) {
      if (WORK_DAYS.includes(currentDate.getDay())) {
        workDayCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 计算当天的工作开始时间
    const workStart = new Date(materialDate);
    workStart.setHours(Math.floor(WORK_START_HOUR), (WORK_START_HOUR % 1) * 60, 0, 0);

    // 计算午休时间段
    const lunchStart = new Date(materialDate);
    lunchStart.setHours(Math.floor(LUNCH_BREAK_START), (LUNCH_BREAK_START % 1) * 60, 0, 0);

    const lunchEnd = new Date(materialDate);
    lunchEnd.setHours(Math.floor(LUNCH_BREAK_END), (LUNCH_BREAK_END % 1) * 60, 0, 0);

    // 计算里程碑时间相对于工作开始时间的偏移（排除午休）
    let hourOffset = (materialDate.getTime() - workStart.getTime()) / (1000 * 60 * 60);

    // 如果里程碑时间在午休后，需要减去午休时间
    if (materialDate >= lunchEnd) {
      hourOffset -= (LUNCH_BREAK_END - LUNCH_BREAK_START);
    }

    // 计算当天实际工作时间（减去午休）
    const dailyWorkHours = (WORK_END_HOUR - WORK_START_HOUR) - (LUNCH_BREAK_END - LUNCH_BREAK_START);

    // 里程碑作为一个点，只计算 left 位置
    const left = ((workDayCount + hourOffset / dailyWorkHours) / totalWorkDays) * 100;

    return { left };
  };

  // 获取资源名称
  const getResourceNames = (task: Task): string => {
    if (!resources || task.assignedResources.length === 0) return '';
    const names = task.assignedResources
      .map(id => resources.find(r => r.id === id)?.name)
      .filter(Boolean) as string[];
    return names.join(', ');
  };

  // 计算每列的宽度（使用百分比，基于工作日数量）
  const columnPercent = 100 / totalWorkDays;

  // 按项目分组任务
  const tasksByProject = projects
    ? projects.map(project => ({
        project,
        tasks: scheduleResult.tasks.filter(t => t.projectId === project.id)
      }))
    : [{ project: null, tasks: scheduleResult.tasks }];

  // 按任务类型分组任务（平面/后期/物料），并在组内按开始时间排序
  const groupTasksByType = (tasks: Task[]) => {
    const types = ['平面', '后期', '物料'];
    return types.map(type => ({
      type,
      tasks: tasks
        .filter(t => t.taskType === type)
        .sort((a, b) => {
          // 按开始时间排序
          const aStart = a.startDate?.getTime() || 0;
          const bStart = b.startDate?.getTime() || 0;
          return aStart - bStart;
        })
    })).filter(group => group.tasks.length > 0);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[1000px]">
        {/* 表头 - 日期刻度 */}
        <div className="flex border-b bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
          {/* 名称列 */}
          <div className="w-52 flex-shrink-0 p-3 text-sm font-semibold border-r dark:border-slate-700">
            {projects ? '项目 / 任务' : '任务名称'}
          </div>
          {/* 日期刻度 */}
          <div className="flex flex-1">
            {workDaysList.map((date, index) => {
              const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
              const weekday = weekDays[date.getDay()];
              return (
                <div
                  key={index}
                  className="text-xs text-center border-r dark:border-slate-700 py-1 px-0.5 flex-shrink-0 flex flex-col justify-center"
                  style={{ width: `${columnPercent}%` }}
                  title={formatDateLong(date)}
                >
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatDateShort(date)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-500">
                    周{weekday}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 项目和任务行 */}
        <div>
          {tasksByProject.map(({ project, tasks: projectTasks }, projectIndex) => {
            if (projectTasks.length === 0) return null;

            const projectStart = projectTasks.reduce(
              (min, task) => (task.startDate && task.startDate < min ? task.startDate : min),
              projectTasks[0].startDate || startDayTime
            );
            const projectEnd = projectTasks.reduce(
              (max, task) => (task.endDate && task.endDate > max ? task.endDate : max),
              projectTasks[0].endDate || startDayTime
            );

            // 计算项目的预估总工时（所有任务工时之和），用于位置计算
            const projectEstimatedHours = projectTasks.reduce(
              (sum, task) => sum + task.estimatedHours,
              0
            );

            // 使用与任务条相同的计算逻辑，传入正确的 estimatedHours
            const projectPosition = getTaskPosition({
              ...projectTasks[0],
              name: project?.name || '项目',
              startDate: projectStart,
              endDate: projectEnd,
              estimatedHours: projectEstimatedHours
            } as Task);

            const projectColor = project ? project.color : '#3b82f6';

            return (
              <div key={project?.id || 'default'} className="mb-4">
                {/* 项目行 */}
                {project && (
                  <div className="flex bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                    {/* 项目名称 */}
                    <div className="w-52 flex-shrink-0 p-3 border-r dark:border-slate-700">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: projectColor }}
                        />
                        {project.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatDateTime(projectStart)} - {formatDateTime(projectEnd)}
                      </div>
                    </div>

                    {/* 项目甘特图条 */}
                    <div className="flex flex-1 relative" style={{ minHeight: '48px' }}>
                      {/* 网格线 - 在每个工作日的结束处绘制 */}
                      {workDaysList.slice(1).map((_, index) => (
                        <div
                          key={index}
                          className="absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800"
                          style={{ left: `${(index + 1) / totalWorkDays * 100}%`, width: '1px' }}
                        />
                      ))}

                      {/* 项目条 */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-8 rounded shadow-sm"
                        style={{
                          left: `${projectPosition.left}%`,
                          width: `${Math.max(projectPosition.width, 0.5)}%`,
                          backgroundColor: projectColor,
                          opacity: 0.7
                        }}
                        title={`${project.name}: ${formatDateTime(projectStart)} - ${formatDateTime(projectEnd)}`}
                      />

                      {/* 项目任务数标记 */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 ml-2 text-xs font-medium"
                        style={{ left: `${Math.min(projectPosition.left + projectPosition.width + 1, 95)}%` }}
                      >
                        {projectTasks.length} 个任务
                      </div>
                    </div>
                  </div>
                )}

                {/* 任务行 */}
                {showTaskLevel && (
                  <div>
                    {groupTasksByType(projectTasks).map((typeGroup, typeIndex) => (
                      <div key={typeIndex}>
                        {/* 任务类型标题行 */}
                        <div className="flex bg-slate-100 dark:bg-slate-800/50 border-b dark:border-slate-700">
                          <div className="w-52 flex-shrink-0 p-2 border-r dark:border-slate-700">
                            <div className="text-sm font-semibold flex items-center gap-2">
                              {typeGroup.type === '平面' && (
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                              )}
                              {typeGroup.type === '后期' && (
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                              )}
                              {typeGroup.type === '物料' && (
                                <div className="w-2 h-2 rotate-45 bg-amber-500" />
                              )}
                              {typeGroup.type}任务
                            </div>
                          </div>
                          <div className="flex-1 p-2 text-xs text-slate-500">
                            共 {typeGroup.tasks.length} 个任务
                          </div>
                        </div>

                        {/* 任务列表 */}
                        <div className="divide-y dark:divide-slate-700">
                          {typeGroup.tasks.map(task => {
                      const isCritical = scheduleResult.criticalPath.includes(task.id);
                      const isMaterial = task.taskType === '物料';

                      // 物料任务（里程碑）
                      if (isMaterial) {
                        // 使用专门的里程碑位置计算函数
                        const position = getMilestonePosition(task);

                        return (
                          <div
                            key={task.id}
                            className="flex hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                          >
                            {/* 任务名称 */}
                            <div className="w-52 flex-shrink-0 p-3 border-r dark:border-slate-700">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rotate-45 bg-amber-500 border-2 border-amber-300" />
                                <div className="text-sm font-medium truncate" title={task.name}>
                                  {task.name}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 mt-1 pl-5">
                                里程碑: {formatDateTime(task.startDate || task.endDate || new Date())}
                              </div>
                            </div>

                            {/* 里程碑（菱形） */}
                            <div className="flex flex-1 relative" style={{ minHeight: '36px' }}>
                              {/* 网格线 */}
                              {workDaysList.slice(1).map((_, index) => (
                                <div
                                  key={index}
                                  className="absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800"
                                  style={{ left: `${(index + 1) / totalWorkDays * 100}%`, width: '1px' }}
                                />
                              ))}

                              {/* 里程碑图标 - 菱形 */}
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-amber-500 border-2 border-amber-300 shadow-md cursor-pointer hover:bg-amber-400 transition-colors"
                                style={{
                                  left: `calc(${position.left}% - 8px)`
                                }}
                                title={`${task.name} - 物料提供日期: ${formatDateLong(task.startDate || task.endDate || new Date())}`}
                              />
                            </div>
                          </div>
                        );
                      }

                      // 普通任务
                      const position = getTaskPosition(task);
                      const taskColor = getTaskColor(task, isCritical);

                      // 检查任务状态
                      const isCompleted = task.status === 'completed';
                      const isOverdue = !isCompleted && task.deadline && task.endDate && task.endDate > task.deadline;

                      return (
                        <div
                          key={task.id}
                          className="flex hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        >
                          {/* 任务名称 */}
                          <div className="w-52 flex-shrink-0 p-3 border-r dark:border-slate-700">
                            <div className="flex items-center gap-2">
                              {!project && (
                                <div
                                  className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : ''}`}
                                  style={isCompleted ? {} : { backgroundColor: taskColor }}
                                />
                              )}
                              <div className={`text-sm font-medium truncate ${isCompleted ? 'text-green-600 line-through' : ''}`} title={task.name}>
                                {isCompleted && <span className="mr-1">✓</span>}
                                {task.name}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 pl-4">
                              {isCompleted && task.actualEndDate ? (
                                // 已完成任务显示实际完成时间
                                <span className="text-green-600">
                                  完成: {showHour ? formatDateTime(task.actualEndDate) : task.actualEndDate.toLocaleDateString()}
                                </span>
                              ) : (
                                // 未完成任务显示排期开始时间
                                showHour ? formatDateTime(task.startDate || startDayTime) : (task.startDate || startDayTime).toLocaleDateString()
                              )}
                            </div>
                            {isCompleted && (
                              <Badge className="text-xs ml-4 mt-1 bg-green-600 hover:bg-green-700">
                                已完成
                              </Badge>
                            )}
                            {isCritical && !isCompleted && (
                              <Badge variant="destructive" className="text-xs ml-4 mt-1">
                                关键路径
                              </Badge>
                            )}
                            {isOverdue && (
                              <Badge className="text-xs ml-4 mt-1 bg-red-600 hover:bg-red-700">
                                超期
                              </Badge>
                            )}
                            {resources && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-4 truncate">
                                负责人: {getResourceNames(task)}
                              </div>
                            )}
                            {resources && task.assignedResources.length > 0 && !task.isCritical && (
                              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 pl-4">
                                {(() => {
                                  const resource = resources.find(r => r.id === task.assignedResources[0]);
                                  const efficiency = resource?.efficiency || 1.0;
                                  const actualHours = task.estimatedHours / efficiency;
                                  return `效率: ${efficiency}× | 预估${task.estimatedHours}h → 实际${actualHours.toFixed(1)}h`;
                                })()}
                              </div>
                            )}
                          </div>

                          {/* 任务甘特图条 */}
                          <div className="flex flex-1 relative" style={{ minHeight: '36px' }}>
                            {/* 网格线 - 在每个工作日的结束处绘制（跳过第一个，因为第一个的开始是整体起点） */}
                            {workDaysList.slice(1).map((_, index) => (
                              <div
                                key={index}
                                className="absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800"
                                style={{ left: `${(index + 1) / totalWorkDays * 100}%`, width: '1px' }}
                              />
                            ))}

                            {/* 任务条 */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 h-5 rounded shadow-sm cursor-pointer hover:shadow-md transition-all hover:h-6 ${
                                isCompleted ? 'border-2 border-green-600' : ''
                              } ${isOverdue ? 'border-2 border-red-600 shadow-lg' : ''}`}
                              style={{
                                left: `${position.left}%`,
                                width: `${Math.max(position.width, 0.3)}%`,
                                backgroundColor: isCompleted ? '#dcfce7' : (isOverdue ? '#fee2e2' : taskColor)
                              }}
                              title={isCompleted && task.actualEndDate 
                                ? `${task.name}: ${formatDateTime(task.startDate || startDayTime)} - ${formatDateTime(task.actualEndDate)} (实际完成)`
                                : `${task.name}: ${formatDateTime(task.startDate || startDayTime)} - ${formatDateTime(task.endDate || endDayTime)}${isCompleted ? ' (已完成)' : ''}${isOverdue ? ' (已超期)' : ''}`
                              }
                              onClick={() => (isOverdue || isCompleted) && onTaskClick && onTaskClick(task)}
                            />

                            {/* 完成标记 */}
                            {isCompleted && (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 text-green-600 font-bold flex items-center justify-center"
                                style={{ left: `${position.left}%`, width: `${Math.max(position.width, 0.3)}%` }}
                              >
                                ✓
                              </div>
                            )}

                            {/* 工时标记 - 已完成任务显示实际用时 */}
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -right-1 text-xs font-medium bg-white dark:bg-slate-900 px-1 rounded ${isCompleted ? 'text-green-600' : 'text-slate-500'}"
                              style={{ left: `${Math.min(position.left + position.width + 0.5, 95)}%` }}
                            >
                              {isCompleted && task.actualEndDate && task.startDate
                                ? `${Math.round((task.actualEndDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60))}h`
                                : `${task.estimatedHours}h`
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="flex gap-4 mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>普通任务</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs py-0 px-2">关键路径</Badge>
            <span>关键路径任务</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-100 border-2 border-green-600 flex items-center justify-center text-[8px] text-green-600 font-bold">
              ✓
            </div>
            <span>已完成任务</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-100 border-2 border-red-600" />
            <span>超期任务</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rotate-45 bg-amber-500 border-2 border-amber-300" />
            <span>物料里程碑</span>
          </div>
          {projects && projects.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" />
                <span>项目时间跨度</span>
              </div>
              <div className="flex items-center gap-2">
                <span>不同颜色代表不同项目</span>
              </div>
            </>
          )}
          {resources && resources.length > 0 && !projects && (
            <div className="flex items-center gap-2">
              <span>不同颜色代表不同人员</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
