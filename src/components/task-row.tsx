'use client';

import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Lock, Trash2 } from 'lucide-react';
import { Task, Project, Resource } from '@/types/schedule';
import { SUB_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/constants';

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

// 防抖 hook
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  // 更新 callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}

interface TaskRowProps {
  task: Task;
  project: Project | undefined;
  projects: Project[];
  dependencyOptions: { id: string; name: string }[];  // 预计算的依赖选项
  dependencyNames: Map<string, string>;  // 预计算的依赖名称映射
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

// 使用轻量级的行组件
const TaskRow = memo(function TaskRow({
  task,
  project,
  projects,
  dependencyOptions,
  dependencyNames,
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
  // 计算状态
  const actualStatus = getTaskActualStatus(task);
  const isOverdue = isTaskOverdue(task);
  
  // 判断是否是复合任务
  const isCompoundTask = task.estimatedHoursGraphic && task.estimatedHoursPost && 
    task.estimatedHoursGraphic > 0 && task.estimatedHoursPost > 0;

  // 获取可用资源 - 使用 useMemo 缓存
  const displayResources = useMemo(() => {
    const filtered = task.taskType ? (resourcesByWorkType.get(task.taskType) || []) : [];
    const current = task.fixedResourceId ? resourceMap.get(task.fixedResourceId) : null;
    if (current && !filtered.find(r => r.id === task.fixedResourceId)) {
      return [current, ...filtered];
    }
    return filtered;
  }, [task.taskType, task.fixedResourceId, resourcesByWorkType, resourceMap]);

  // ========== 性能优化：使用本地状态 + onBlur 更新 ==========
  // 文本输入本地状态
  const [localName, setLocalName] = useState(task.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // 数字输入本地状态
  const [localHours, setLocalHours] = useState(task.estimatedHours?.toString() || '');
  const [localGraphicHours, setLocalGraphicHours] = useState(task.estimatedHoursGraphic?.toString() || '');
  const [localPostHours, setLocalPostHours] = useState(task.estimatedHoursPost?.toString() || '');
  
  // 同步本地状态与 props
  useEffect(() => {
    setLocalName(task.name);
  }, [task.name]);
  
  useEffect(() => {
    setLocalHours(task.estimatedHours?.toString() || '');
  }, [task.estimatedHours]);
  
  useEffect(() => {
    setLocalGraphicHours(task.estimatedHoursGraphic?.toString() || '');
  }, [task.estimatedHoursGraphic]);
  
  useEffect(() => {
    setLocalPostHours(task.estimatedHoursPost?.toString() || '');
  }, [task.estimatedHoursPost]);

  // 任务名称：本地状态 + onBlur 更新
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  }, []);
  
  const handleNameBlur = useCallback(() => {
    if (localName !== task.name) {
      onTaskChange(task.id, 'name', localName);
    }
  }, [task.id, task.name, localName, onTaskChange]);

  // 工时：本地状态 + onBlur 更新
  const handleHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalHours(e.target.value);
  }, []);
  
  const handleHoursBlur = useCallback(() => {
    const newValue = parseInt(localHours) || 0;
    if (newValue !== task.estimatedHours) {
      onTaskChange(task.id, 'estimatedHours', newValue);
    }
  }, [task.id, task.estimatedHours, localHours, onTaskChange]);
  
  // 平面工时：本地状态 + onBlur 更新
  const handleGraphicHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalGraphicHours(e.target.value);
  }, []);
  
  const handleGraphicHoursBlur = useCallback(() => {
    const newValue = localGraphicHours ? parseInt(localGraphicHours) : undefined;
    if (newValue !== task.estimatedHoursGraphic) {
      onTaskChange(task.id, 'estimatedHoursGraphic', newValue);
    }
  }, [task.id, task.estimatedHoursGraphic, localGraphicHours, onTaskChange]);
  
  // 后期工时：本地状态 + onBlur 更新
  const handlePostHoursChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalPostHours(e.target.value);
  }, []);
  
  const handlePostHoursBlur = useCallback(() => {
    const newValue = localPostHours ? parseInt(localPostHours) : undefined;
    if (newValue !== task.estimatedHoursPost) {
      onTaskChange(task.id, 'estimatedHoursPost', newValue);
    }
  }, [task.id, task.estimatedHoursPost, localPostHours, onTaskChange]);

  // Select 组件保持即时更新（因为本来就是单次操作）
  const handleProjectChange = useCallback((value: string) => {
    onTaskChange(task.id, 'projectId', value !== 'none' ? value : '');
  }, [task.id, onTaskChange]);

  const handleTaskTypeChange = useCallback((value: string) => {
    onTaskChange(task.id, 'taskType', value !== 'none' ? value : '');
  }, [task.id, onTaskChange]);

  const handleSubTypeChange = useCallback((value: string) => {
    onTaskChange(task.id, 'subType', value !== 'none' ? value : undefined);
  }, [task.id, onTaskChange]);

  const handleLanguageChange = useCallback((value: string) => {
    onTaskChange(task.id, 'language', value !== 'none' ? value : undefined);
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

  // 过滤掉已经是依赖的任务（使用预计算的选项）
  const availableDependencies = useMemo(() => {
    return dependencyOptions.filter(opt => !task.dependencies?.includes(opt.id)).slice(0, 20);
  }, [dependencyOptions, task.dependencies]);

  return (
    <TableRow key={task.id}>
      {/* 任务名称 */}
      <TableCell className="p-1">
        <Input
          value={localName}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          className="h-8 w-full text-sm"
        />
      </TableCell>
      
      {/* 项目 */}
      <TableCell className="p-1">
        <Select
          value={task.projectId || 'none'}
          onValueChange={handleProjectChange}
          disabled={activeProject !== 'all'}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue placeholder="选择项目" />
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
      
      {/* 任务类型 */}
      <TableCell className="p-1">
        {isCompoundTask ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-xs">
            复合
          </Badge>
        ) : (
          <Select
            value={task.taskType || 'none'}
            onValueChange={handleTaskTypeChange}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              <SelectItem value="平面">平面</SelectItem>
              <SelectItem value="后期">后期</SelectItem>
              <SelectItem value="物料">物料</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      
      {/* 细分类 */}
      <TableCell className="p-1">
        <Select
          value={task.subType || 'none'}
          onValueChange={handleSubTypeChange}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue placeholder="细分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-</SelectItem>
            {SUB_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      
      {/* 语言 */}
      <TableCell className="p-1">
        <Select
          value={task.language || 'none'}
          onValueChange={handleLanguageChange}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue placeholder="语言" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-</SelectItem>
            {LANGUAGE_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      
      {/* 指定人员 */}
      <TableCell className="p-1">
        {task.taskType === '物料' ? (
          <span className="text-slate-400 text-sm">-</span>
        ) : isCompoundTask ? (
          <div className="flex flex-col gap-1">
            <Select
              value={task.fixedResourceIdGraphic || 'none'}
              onValueChange={handleGraphicResourceChange}
            >
              <SelectTrigger className="h-6 text-xs w-full">
                <SelectValue placeholder="平面">
                  {task.fixedResourceIdGraphic ? resourceMap.get(task.fixedResourceIdGraphic)?.name : '平面'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">自动</SelectItem>
                {graphicResources.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={task.fixedResourceIdPost || 'none'}
              onValueChange={handlePostResourceChange}
            >
              <SelectTrigger className="h-6 text-xs w-full">
                <SelectValue placeholder="后期">
                  {task.fixedResourceIdPost ? resourceMap.get(task.fixedResourceIdPost)?.name : '后期'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">自动</SelectItem>
                {postResources.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Select
            value={task.fixedResourceId || 'none'}
            onValueChange={handleFixedResourceChange}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue placeholder="自动">
                {task.fixedResourceId ? resourceMap.get(task.fixedResourceId)?.name : '自动'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">自动</SelectItem>
              {displayResources.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      
      {/* 工时/提供时间 */}
      {task.taskType === '物料' ? (
        <TableCell className="p-1">
          <Input
            type="datetime-local"
            value={formatDateTimeToInputValue(task.estimatedMaterialDate)}
            onChange={handleMaterialDateChange}
            className="w-full h-8 text-xs"
          />
        </TableCell>
      ) : (
        <TableCell className="p-1">
          <Input
            type="number"
            value={localHours}
            onChange={handleHoursChange}
            onBlur={handleHoursBlur}
            className="w-full h-8 text-sm"
          />
        </TableCell>
      )}
      
      {/* 平面工时 */}
      <TableCell className="p-1">
        {task.taskType === '物料' ? (
          <span className="text-slate-400 text-sm">-</span>
        ) : (
          <Input
            type="number"
            value={localGraphicHours}
            onChange={handleGraphicHoursChange}
            onBlur={handleGraphicHoursBlur}
            className="w-full h-8 text-sm"
            placeholder="0"
          />
        )}
      </TableCell>
      
      {/* 后期工时 */}
      <TableCell className="p-1">
        {task.taskType === '物料' ? (
          <span className="text-slate-400 text-sm">-</span>
        ) : (
          <Input
            type="number"
            value={localPostHours}
            onChange={handlePostHoursChange}
            onBlur={handlePostHoursBlur}
            className="w-full h-8 text-sm"
            placeholder="0"
          />
        )}
      </TableCell>
      
      {/* 优先级 */}
      <TableCell className="p-1">
        <Select
          value={task.priority}
          onValueChange={handlePriorityChange}
        >
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">紧急</SelectItem>
            <SelectItem value="normal">普通</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      
      {/* 状态 */}
      <TableCell className="p-1">
        <div className="flex items-center gap-1">
          <Select
            value={task.status || 'pending'}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="h-8 w-full text-sm">
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
            <span className="text-xs text-red-500">⚠️</span>
          )}
        </div>
      </TableCell>
      
      {/* 截止日期 */}
      <TableCell className="p-1">
        {task.taskType === '物料' ? (
          <span className="text-slate-400 text-sm">-</span>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 cursor-pointer" title="不确定截止日期">
                <input
                  type="radio"
                  name={`deadline-${task.id}`}
                  checked={task.deadline === undefined}
                  onChange={() => onTaskChange(task.id, 'deadline', undefined)}
                  className="w-3 h-3"
                  disabled={task.status === 'completed'}
                />
                <span className="text-xs text-slate-500">不限</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer" title="确定截止日期">
                <input
                  type="radio"
                  name={`deadline-${task.id}`}
                  checked={task.deadline !== undefined}
                  onChange={handleSetDeadline}
                  className="w-3 h-3"
                  disabled={task.status === 'completed'}
                />
                <span className="text-xs text-slate-500">限定</span>
              </label>
            </div>
            {task.deadline && (
              <Input
                type="date"
                value={formatDateToInputValue(task.deadline)}
                onChange={handleDeadlineChange}
                className="w-full h-7 text-xs"
                disabled={task.status === 'completed'}
              />
            )}
          </div>
        )}
      </TableCell>
      
      {/* 子任务依赖：只对复合任务显示 */}
      <TableCell className="p-1">
        {isCompoundTask ? (
          <Select
            value={task.subTaskDependencyMode || 'parallel'}
            onValueChange={(value) => onTaskChange(task.id, 'subTaskDependencyMode', value as 'parallel' | 'serial')}
          >
            <SelectTrigger className="h-6 text-xs w-16">
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
      
      {/* 依赖 */}
      <TableCell className="p-1">
        <div className="flex flex-col gap-0.5">
          <Select
            value=""
            onValueChange={handleAddDependency}
          >
            <SelectTrigger className="h-6 text-xs w-full">
              <SelectValue placeholder="+" />
            </SelectTrigger>
            <SelectContent>
              {availableDependencies.map(depTask => (
                <SelectItem key={depTask.id} value={depTask.id}>
                  {depTask.name.slice(0, 15)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {task.dependencies.slice(0, 2).map(depId => {
                const depName = dependencyNames.get(depId);
                if (!depName) return null;
                return (
                  <Badge key={depId} variant="secondary" className="h-4 text-[10px] px-1">
                    {depName.slice(0, 6)}
                    <button onClick={() => handleRemoveDependency(depId)} className="ml-0.5">×</button>
                  </Badge>
                );
              })}
              {task.dependencies.length > 2 && (
                <span className="text-[10px] text-slate-500">+{task.dependencies.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </TableCell>
      
      {/* 操作 */}
      <TableCell className="p-1">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleLock(task.id)}
            title={task.isLocked ? '已锁定' : '点击锁定'}
            className="h-6 w-6 p-0"
          >
            <Lock className={`h-3 w-3 ${task.isLocked ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(task.id)}
            className="h-6 w-6 p-0"
            disabled={task.isSubTask}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数 - 只比较真正会变化的字段
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;
  
  return (
    prevTask.id === nextTask.id &&
    prevTask.name === nextTask.name &&
    prevTask.projectId === nextTask.projectId &&
    prevTask.taskType === nextTask.taskType &&
    prevTask.subType === nextTask.subType &&
    prevTask.language === nextTask.language &&
    prevTask.fixedResourceId === nextTask.fixedResourceId &&
    prevTask.fixedResourceIdGraphic === nextTask.fixedResourceIdGraphic &&
    prevTask.fixedResourceIdPost === nextTask.fixedResourceIdPost &&
    prevTask.estimatedHours === nextTask.estimatedHours &&
    prevTask.estimatedHoursGraphic === nextTask.estimatedHoursGraphic &&
    prevTask.estimatedHoursPost === nextTask.estimatedHoursPost &&
    prevTask.priority === nextTask.priority &&
    prevTask.status === nextTask.status &&
    prevTask.deadline === nextTask.deadline &&
    prevTask.estimatedMaterialDate === nextTask.estimatedMaterialDate &&
    prevTask.dependencies?.length === nextTask.dependencies?.length &&
    prevTask.isLocked === nextTask.isLocked &&
    prevTask.isSubTask === nextTask.isSubTask &&
    prevProps.activeProject === nextProps.activeProject
  );
});

export default TaskRow;
