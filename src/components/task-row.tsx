'use client';

import { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Lock } from 'lucide-react';
import { Task, Project, Resource } from '@/types/schedule';

// 辅助函数
const formatDateToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTimeToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateTime = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};

interface TaskRowProps {
  task: Task;
  project: Project | undefined;
  projects: Project[];
  tasks: Task[];
  resourceMap: Map<string, Resource>;
  graphicResources: Resource[];
  postResources: Resource[];
  resourcesByWorkType: Map<string, Resource[]>;
  sharedResources: Resource[];
  activeProject: string;
  getTaskActualStatus: (task: Task) => string;
  isTaskOverdue: (task: Task) => boolean;
  onTaskChange: (taskId: string, field: keyof Task, value: any) => void;
  onToggleLock: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  getProjectById: (projectId: string) => Project | undefined;
}

const TaskRow = memo(function TaskRow({
  task,
  project,
  projects,
  tasks,
  resourceMap,
  graphicResources,
  postResources,
  resourcesByWorkType,
  sharedResources,
  activeProject,
  getTaskActualStatus,
  isTaskOverdue,
  onTaskChange,
  onToggleLock,
  onDelete,
  getProjectById,
}: TaskRowProps) {
  // 使用 useCallback 缓存事件处理器
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTaskChange(task.id, 'name', e.target.value);
  }, [task.id, onTaskChange]);

  const handleProjectChange = useCallback((value: string) => {
    onTaskChange(task.id, 'projectId', value !== 'none' ? value : '');
  }, [task.id, onTaskChange]);

  const handleTaskTypeChange = useCallback((value: string) => {
    onTaskChange(task.id, 'taskType', value !== 'none' ? value : '');
  }, [task.id, onTaskChange]);

  const handleFixedResourceChange = useCallback((value: string) => {
    onTaskChange(task.id, 'fixedResourceId', value !== 'none' ? value : undefined);
  }, [task.id, onTaskChange]);

  const handleGraphicResourceChange = useCallback((value: string) => {
    onTaskChange(task.id, 'fixedResourceIdGraphic', value !== 'none' ? value : undefined);
  }, [task.id, onTaskChange]);

  const handlePostResourceChange = useCallback((value: string) => {
    onTaskChange(task.id, 'fixedResourceIdPost', value !== 'none' ? value : undefined);
  }, [task.id, onTaskChange]);

  const handleHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTaskChange(task.id, 'estimatedHours', parseInt(e.target.value) || 0);
  }, [task.id, onTaskChange]);

  const handleGraphicHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTaskChange(task.id, 'estimatedHoursGraphic', e.target.value ? parseInt(e.target.value) : undefined);
  }, [task.id, onTaskChange]);

  const handlePostHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTaskChange(task.id, 'estimatedHoursPost', e.target.value ? parseInt(e.target.value) : undefined);
  }, [task.id, onTaskChange]);

  const handlePriorityChange = useCallback((value: string) => {
    onTaskChange(task.id, 'priority', value);
  }, [task.id, onTaskChange]);

  const handleStatusChange = useCallback((value: string) => {
    onTaskChange(task.id, 'status', value);
  }, [task.id, onTaskChange]);

  const handleDeadlineChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTaskChange(task.id, 'deadline', new Date(e.target.value));
  }, [task.id, onTaskChange]);

  const handleMaterialDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTaskChange(task.id, 'estimatedMaterialDate', new Date(e.target.value));
  }, [task.id, onTaskChange]);

  const handleSubTaskModeChange = useCallback((value: string) => {
    onTaskChange(task.id, 'subTaskDependencyMode', value as 'parallel' | 'serial');
  }, [task.id, onTaskChange]);

  const handleAddDependency = useCallback((value: string) => {
    if (value && !task.dependencies?.includes(value)) {
      const newDeps = [...(task.dependencies || []), value];
      onTaskChange(task.id, 'dependencies', newDeps);
    }
  }, [task.id, task.dependencies, onTaskChange]);

  const handleRemoveDependency = useCallback((depId: string) => {
    const newDeps = task.dependencies?.filter(id => id !== depId) || [];
    onTaskChange(task.id, 'dependencies', newDeps);
  }, [task.id, task.dependencies, onTaskChange]);

  const handleSetDeadline = useCallback(() => {
    const defaultDeadline = new Date();
    let daysToAdd = 7;
    while (daysToAdd > 0) {
      defaultDeadline.setDate(defaultDeadline.getDate() + 1);
      const dayOfWeek = defaultDeadline.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysToAdd--;
      }
    }
    onTaskChange(task.id, 'deadline', defaultDeadline);
  }, [task.id, onTaskChange]);

  const handleClearDeadline = useCallback(() => {
    onTaskChange(task.id, 'deadline', undefined);
  }, [task.id, onTaskChange]);

  const handleConfirmComplete = useCallback(() => {
    onTaskChange(task.id, 'status', 'completed');
  }, [task.id, onTaskChange]);

  // 计算状态
  const actualStatus = getTaskActualStatus(task);
  const isOverdue = isTaskOverdue(task);
  const canConfirmComplete = actualStatus === 'to-confirm' && task.status !== 'completed';
  
  // 判断是否是复合任务
  const isCompoundTask = task.estimatedHoursGraphic && task.estimatedHoursPost && 
    task.estimatedHoursGraphic > 0 && task.estimatedHoursPost > 0;

  // 获取可用资源
  const filteredResources = task.taskType 
    ? (resourcesByWorkType.get(task.taskType) || [])
    : [];
  const currentResource = task.fixedResourceId ? resourceMap.get(task.fixedResourceId) : null;
  const displayResources = currentResource && !filteredResources.find(r => r.id === task.fixedResourceId)
    ? [currentResource, ...filteredResources]
    : filteredResources;

  return (
    <TableRow key={task.id}>
      <TableCell>
        <Input
          value={task.name}
          onChange={handleNameChange}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Select
          value={task.projectId || 'none'}
          onValueChange={handleProjectChange}
          disabled={activeProject !== 'all'}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">未分配</SelectItem>
            {projects.map(proj => (
              <SelectItem key={proj.id} value={proj.id}>
                {proj.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {isCompoundTask ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700">
            复合
          </Badge>
        ) : (
          <Select
            value={task.taskType || 'none'}
            onValueChange={handleTaskTypeChange}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未指定</SelectItem>
              <SelectItem value="平面">平面</SelectItem>
              <SelectItem value="后期">后期</SelectItem>
              <SelectItem value="物料">物料</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : isCompoundTask ? (
          <div className="flex flex-col gap-1 min-w-[160px]">
            {/* 平面负责人 */}
            <Select
              value={task.fixedResourceIdGraphic || 'none'}
              onValueChange={handleGraphicResourceChange}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="平面负责人">
                  {task.fixedResourceIdGraphic ? (() => {
                    const resource = resourceMap.get(task.fixedResourceIdGraphic);
                    return resource ? (
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        {resource.name}
                      </span>
                    ) : '平面负责人';
                  })() : '平面负责人'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">自动分配</SelectItem>
                {graphicResources.map(resource => (
                  <SelectItem key={resource.id} value={resource.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>{resource.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* 后期负责人 */}
            <Select
              value={task.fixedResourceIdPost || 'none'}
              onValueChange={handlePostResourceChange}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="后期负责人">
                  {task.fixedResourceIdPost ? (() => {
                    const resource = resourceMap.get(task.fixedResourceIdPost);
                    return resource ? (
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {resource.name}
                      </span>
                    ) : '后期负责人';
                  })() : '后期负责人'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">自动分配</SelectItem>
                {postResources.map(resource => (
                  <SelectItem key={resource.id} value={resource.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>{resource.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Select
            value={task.fixedResourceId || 'none'}
            onValueChange={handleFixedResourceChange}
          >
            <SelectTrigger className="h-8 min-w-[140px]">
              <SelectValue>
                {task.fixedResourceId ? (() => {
                  const resource = resourceMap.get(task.fixedResourceId);
                  if (resource) {
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: resource.color }}
                        />
                        <span>{resource.name}</span>
                      </div>
                    );
                  }
                  return <span className="text-slate-400 text-sm">未分配</span>;
                })() : (
                  <span className="text-slate-400 text-sm">自动分配</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">自动分配</SelectItem>
              {displayResources.length > 0 ? (
                displayResources.map(resource => (
                  <SelectItem key={resource.id} value={resource.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: resource.color }}
                      />
                      <span>{resource.name}</span>
                      <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">
                        {resource.workType}
                      </Badge>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-xs text-slate-500">
                  {!task.taskType ? "请先选择任务类型" : sharedResources.length === 0 ? "暂无可用人员" : "无匹配人员"}
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      {task.taskType === '物料' ? (
        <>
          <TableCell>
            <div className="relative">
              <Input
                type="datetime-local"
                value={formatDateTimeToInputValue(task.estimatedMaterialDate)}
                onChange={handleMaterialDateChange}
                className={`w-48 h-8 ${!task.estimatedMaterialDate ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}
                placeholder="选择提供时间"
              />
              {!task.estimatedMaterialDate && (
                <div className="absolute top-full left-0 mt-1 text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                  ⚠️ 请填写提供时间
                </div>
              )}
            </div>
          </TableCell>
          <TableCell><span className="text-slate-400">-</span></TableCell>
          <TableCell><span className="text-slate-400">-</span></TableCell>
          <TableCell><span className="text-slate-400">-</span></TableCell>
          <TableCell><span className="text-slate-400">-</span></TableCell>
        </>
      ) : (
        <>
          <TableCell>
            <Input
              type="number"
              value={task.estimatedHours}
              onChange={handleHoursChange}
              className="w-24 h-8"
            />
          </TableCell>
          <TableCell>
            <Input
              type="number"
              value={task.estimatedHoursGraphic || ''}
              onChange={handleGraphicHoursChange}
              className="w-20 h-8"
              placeholder="0"
            />
          </TableCell>
          <TableCell>
            <Input
              type="number"
              value={task.estimatedHoursPost || ''}
              onChange={handlePostHoursChange}
              className="w-20 h-8"
              placeholder="0"
            />
          </TableCell>
          <TableCell>
            <Select
              value={task.priority}
              onValueChange={handlePriorityChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">紧急</SelectItem>
                <SelectItem value="normal">普通</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1 flex-wrap">
              <Select
                value={task.status || 'pending'}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="h-8 min-w-[90px]">
                  <SelectValue>
                    {actualStatus === 'pending' && <span className="text-slate-500">待处理</span>}
                    {actualStatus === 'in-progress' && <span className="text-blue-500">进行中</span>}
                    {actualStatus === 'to-confirm' && <span className="text-amber-500">待确认</span>}
                    {actualStatus === 'completed' && <span className="text-green-500">已完成</span>}
                    {actualStatus === 'blocked' && <span className="text-red-500">已阻塞</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="in-progress">进行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="blocked">已阻塞</SelectItem>
                </SelectContent>
              </Select>
              
              {isOverdue && actualStatus !== 'completed' && (
                <span className="text-xs text-red-500 font-medium" title="已超过截止日期">
                  ⚠️超期
                </span>
              )}
              
              {canConfirmComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                  onClick={handleConfirmComplete}
                >
                  ✓ 确认完成
                </Button>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name={`deadline-type-${task.id}`}
                    checked={task.deadline !== undefined}
                    onChange={handleSetDeadline}
                    className="w-3 h-3"
                    disabled={task.status === 'completed'}
                  />
                  <span className="text-xs">指定日期</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name={`deadline-type-${task.id}`}
                    checked={task.deadline === undefined}
                    onChange={handleClearDeadline}
                    className="w-3 h-3"
                    disabled={task.status === 'completed'}
                  />
                  <span className="text-xs">不确定</span>
                </label>
              </div>
              {task.deadline && (
                <Input
                  type="date"
                  value={formatDateToInputValue(task.deadline)}
                  onChange={handleDeadlineChange}
                  className="w-36 h-8"
                  disabled={task.status === 'completed'}
                />
              )}
              {task.status === 'completed' && task.actualEndDate && (
                <div className="text-[10px] text-green-600 font-medium">
                  ✓ 实际完成: {formatDateTime(task.actualEndDate)}
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>
            {isCompoundTask ? (
              <Select
                value={task.subTaskDependencyMode || 'parallel'}
                onValueChange={handleSubTaskModeChange}
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parallel">
                    <span className="flex items-center gap-1">
                      <span className="text-green-600">∥</span> 并行
                    </span>
                  </SelectItem>
                  <SelectItem value="serial">
                    <span className="flex items-center gap-1">
                      <span className="text-blue-600">→</span> 串行
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="text-slate-400 text-xs">-</span>
            )}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Select
                value=""
                onValueChange={handleAddDependency}
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="添加依赖" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.filter(t => t.id !== task.id && !task.dependencies?.includes(t.id)).map(depTask => (
                    <SelectItem key={depTask.id} value={depTask.id}>
                      {depTask.name} ({getProjectById(depTask.projectId || '')?.name}){depTask.taskType === '物料' && ' (物料)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {task.dependencies && task.dependencies.length > 0 ? (
                  task.dependencies.map(depId => {
                    const depTask = tasks.find(t => t.id === depId);
                    if (!depTask) return null;
                    return (
                      <Badge key={depId} variant="secondary" className="h-6 flex items-center gap-1">
                        {depTask.name}
                        <button
                          onClick={() => handleRemoveDependency(depId)}
                          className="hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-400">无依赖</span>
                )}
              </div>
            </div>
          </TableCell>
        </>
      )}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleLock(task.id)}
            title={task.isLocked ? '任务已锁定，排期时将保留当前时间分配' : '点击锁定任务，排期时保留当前时间分配'}
          >
            <Lock
              className={`h-4 w-4 ${task.isLocked ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(task.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            disabled={task.isSubTask}
          >
            删除
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有当 task 相关字段变化时才重新渲染
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.projectId === nextProps.task.projectId &&
    prevProps.task.taskType === nextProps.task.taskType &&
    prevProps.task.fixedResourceId === nextProps.task.fixedResourceId &&
    prevProps.task.fixedResourceIdGraphic === nextProps.task.fixedResourceIdGraphic &&
    prevProps.task.fixedResourceIdPost === nextProps.task.fixedResourceIdPost &&
    prevProps.task.estimatedHours === nextProps.task.estimatedHours &&
    prevProps.task.estimatedHoursGraphic === nextProps.task.estimatedHoursGraphic &&
    prevProps.task.estimatedHoursPost === nextProps.task.estimatedHoursPost &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.deadline === nextProps.task.deadline &&
    prevProps.task.actualEndDate === nextProps.task.actualEndDate &&
    prevProps.task.estimatedMaterialDate === nextProps.task.estimatedMaterialDate &&
    prevProps.task.subTaskDependencyMode === nextProps.task.subTaskDependencyMode &&
    JSON.stringify(prevProps.task.dependencies) === JSON.stringify(nextProps.task.dependencies) &&
    prevProps.task.isLocked === nextProps.task.isLocked &&
    prevProps.task.isSubTask === nextProps.task.isSubTask &&
    prevProps.activeProject === nextProps.activeProject &&
    prevProps.graphicResources.length === nextProps.graphicResources.length &&
    prevProps.postResources.length === nextProps.postResources.length &&
    prevProps.projects.length === nextProps.projects.length &&
    prevProps.tasks.length === nextProps.tasks.length
  );
});

export default TaskRow;
