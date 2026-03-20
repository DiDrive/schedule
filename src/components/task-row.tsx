'use client';

import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Lock, Trash2 } from 'lucide-react';
import { Task, Project, Resource } from '@/types/schedule';
import { SUB_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/constants';

// 轻量级原生 select 组件 - 立即响应
function FastSelect({ 
  value, 
  onChange, 
  options, 
  className = ''
}: { 
  value: string; 
  onChange: (v: string) => void; 
  options: { value: string; label: string }[];
  className?: string;
}) {
  // 本地状态实现立即响应
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue); // 立即更新本地状态
    onChange(newValue);       // 后台通知父组件
  }, [onChange]);

  return (
    <select
      value={localValue}
      onChange={handleChange}
      className={`h-8 px-2 text-sm border rounded bg-white cursor-pointer ${className}`}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// 防抖输入组件
function DebouncedInput({ 
  value, 
  onChange, 
  className 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(newValue), 300);
  }, [onChange]);

  return <Input value={localValue} onChange={handleChange} className={className} />;
}

// 辅助函数
const formatDateToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

const formatDateTimeToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// 预定义选项
const TASK_TYPE_OPTIONS = [
  { value: 'none', label: '-' },
  { value: '平面', label: '平面' },
  { value: '后期', label: '后期' },
  { value: '物料', label: '物料' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '紧急' },
  { value: 'normal', label: '普通' },
  { value: 'low', label: '低' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'in-progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'blocked', label: '已阻塞' },
];

const SUB_TYPE_OPTIONS_LITE = [{ value: 'none', label: '-' }, ...SUB_TYPE_OPTIONS.map(opt => ({ value: opt, label: opt }))];
const LANGUAGE_OPTIONS_LITE = [{ value: 'none', label: '-' }, ...LANGUAGE_OPTIONS.map(opt => ({ value: opt, label: opt }))];

interface TaskRowProps {
  task: Task;
  projects: Project[];
  tasks: Task[];
  resourceMap: Map<string, Resource>;
  graphicResources: Resource[];
  postResources: Resource[];
  resourcesByWorkType: Map<string, Resource[]>;
  activeProject: string;
  getTaskActualStatus: (task: Task) => string;
  isTaskOverdue: (task: Task) => boolean;
  onTaskChange: (taskId: string, field: keyof Task, value: any) => void;
  onToggleLock: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

// 高性能行组件 - 使用乐观更新
const TaskRow = memo(function TaskRow({
  task,
  projects,
  tasks,
  resourceMap,
  graphicResources,
  postResources,
  resourcesByWorkType,
  activeProject,
  getTaskActualStatus,
  isTaskOverdue,
  onTaskChange,
  onToggleLock,
  onDelete,
}: TaskRowProps) {
  const taskId = task.id;
  
  // 本地状态 - 实现乐观更新
  const [localTask, setLocalTask] = useState(task);
  
  // 同步外部状态变化
  useEffect(() => {
    setLocalTask(task);
  }, [task]);
  
  // 计算状态
  const actualStatus = getTaskActualStatus(localTask);
  const isOverdue = isTaskOverdue(localTask);
  
  // 判断是否是复合任务
  const isCompoundTask = localTask.estimatedHoursGraphic && localTask.estimatedHoursPost && 
    localTask.estimatedHoursGraphic > 0 && localTask.estimatedHoursPost > 0;

  // 获取可用资源
  const displayResources = useMemo(() => {
    const filtered = localTask.taskType ? (resourcesByWorkType.get(localTask.taskType) || []) : [];
    const current = localTask.fixedResourceId ? resourceMap.get(localTask.fixedResourceId) : null;
    if (current && !filtered.find(r => r.id === localTask.fixedResourceId)) {
      return [current, ...filtered];
    }
    return filtered;
  }, [localTask.taskType, localTask.fixedResourceId, resourcesByWorkType, resourceMap]);

  // 可选的依赖任务
  const availableDependencies = useMemo(() => {
    return tasks.filter(t => t.id !== taskId && !localTask.dependencies?.includes(t.id)).slice(0, 30);
  }, [tasks, taskId, localTask.dependencies]);

  // 项目选项
  const projectOptions = useMemo(() => [
    { value: 'none', label: '未分配' },
    ...projects.map(p => ({ value: p.id, label: p.name }))
  ], [projects]);

  // 资源选项
  const resourceOptions = useMemo(() => [
    { value: 'none', label: '自动' },
    ...displayResources.map(r => ({ value: r.id, label: r.name }))
  ], [displayResources]);

  // 乐观更新处理
  const handleChange = useCallback((field: keyof Task, value: any) => {
    // 立即更新本地状态
    setLocalTask(prev => ({ ...prev, [field]: value === 'none' ? undefined : value }));
    // 后台通知父组件
    onTaskChange(taskId, field, value === 'none' ? undefined : value);
  }, [taskId, onTaskChange]);

  const handleNumberChange = useCallback((field: keyof Task, value: string) => {
    const numValue = value ? parseInt(value) : undefined;
    setLocalTask(prev => ({ ...prev, [field]: numValue }));
    onTaskChange(taskId, field, numValue);
  }, [taskId, onTaskChange]);

  const handleDateChange = useCallback((field: keyof Task, value: string) => {
    if (value) {
      const date = new Date(value);
      if (field === 'deadline') date.setHours(18, 30, 0, 0);
      setLocalTask(prev => ({ ...prev, [field]: date }));
      onTaskChange(taskId, field, date);
    }
  }, [taskId, onTaskChange]);

  const handleAddDependency = useCallback((value: string) => {
    if (value && value !== 'none' && !localTask.dependencies?.includes(value)) {
      const newDeps = [...(localTask.dependencies || []), value];
      setLocalTask(prev => ({ ...prev, dependencies: newDeps }));
      onTaskChange(taskId, 'dependencies', newDeps);
    }
  }, [taskId, localTask.dependencies, onTaskChange]);

  const handleRemoveDependency = useCallback((depId: string) => {
    const newDeps = localTask.dependencies?.filter(id => id !== depId) || [];
    setLocalTask(prev => ({ ...prev, dependencies: newDeps }));
    onTaskChange(taskId, 'dependencies', newDeps);
  }, [taskId, localTask.dependencies, onTaskChange]);

  const handleSetDeadline = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(18, 30, 0, 0);
    setLocalTask(prev => ({ ...prev, deadline: d }));
    onTaskChange(taskId, 'deadline', d);
  }, [taskId, onTaskChange]);

  // 渲染状态颜色
  const statusColor = {
    'pending': 'text-slate-500',
    'in-progress': 'text-blue-500',
    'to-confirm': 'text-amber-500',
    'completed': 'text-green-500',
    'blocked': 'text-red-500',
  }[actualStatus] || 'text-slate-500';

  return (
    <TableRow>
      {/* 任务名称 */}
      <TableCell>
        <DebouncedInput
          value={localTask.name}
          onChange={(v) => { setLocalTask(prev => ({ ...prev, name: v })); onTaskChange(taskId, 'name', v); }}
          className="h-8 min-w-[220px]"
        />
      </TableCell>
      
      {/* 项目 */}
      <TableCell>
        <FastSelect
          value={localTask.projectId || 'none'}
          onChange={(v) => handleChange('projectId', v)}
          options={projectOptions}
          className="min-w-[140px]"
        />
      </TableCell>
      
      {/* 任务类型 */}
      <TableCell>
        {isCompoundTask ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">复合</Badge>
        ) : (
          <FastSelect
            value={localTask.taskType || 'none'}
            onChange={(v) => handleChange('taskType', v)}
            options={TASK_TYPE_OPTIONS}
            className="w-20"
          />
        )}
      </TableCell>
      
      {/* 细分类 */}
      <TableCell>
        <FastSelect
          value={localTask.subType || 'none'}
          onChange={(v) => handleChange('subType', v)}
          options={SUB_TYPE_OPTIONS_LITE}
          className="min-w-[100px]"
        />
      </TableCell>
      
      {/* 语言 */}
      <TableCell>
        <FastSelect
          value={localTask.language || 'none'}
          onChange={(v) => handleChange('language', v)}
          options={LANGUAGE_OPTIONS_LITE}
          className="w-24"
        />
      </TableCell>
      
      {/* 指定人员 */}
      <TableCell>
        {localTask.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : isCompoundTask ? (
          <div className="flex flex-col gap-1">
            <FastSelect
              value={localTask.fixedResourceIdGraphic || 'none'}
              onChange={(v) => handleChange('fixedResourceIdGraphic', v)}
              options={[{ value: 'none', label: '平面' }, ...graphicResources.map(r => ({ value: r.id, label: r.name }))]}
              className="min-w-[80px] h-6 text-xs"
            />
            <FastSelect
              value={localTask.fixedResourceIdPost || 'none'}
              onChange={(v) => handleChange('fixedResourceIdPost', v)}
              options={[{ value: 'none', label: '后期' }, ...postResources.map(r => ({ value: r.id, label: r.name }))]}
              className="min-w-[80px] h-6 text-xs"
            />
          </div>
        ) : (
          <FastSelect
            value={localTask.fixedResourceId || 'none'}
            onChange={(v) => handleChange('fixedResourceId', v)}
            options={resourceOptions}
            className="min-w-[100px]"
          />
        )}
      </TableCell>
      
      {/* 工时 */}
      <TableCell>
        {localTask.taskType === '物料' ? (
          <Input
            type="datetime-local"
            value={formatDateTimeToInputValue(localTask.estimatedMaterialDate)}
            onChange={(e) => handleDateChange('estimatedMaterialDate', e.target.value)}
            className="w-36 h-8 text-xs"
          />
        ) : (
          <Input
            type="number"
            value={localTask.estimatedHours}
            onChange={(e) => handleNumberChange('estimatedHours', e.target.value)}
            className="w-16 h-8"
          />
        )}
      </TableCell>
      
      {/* 平面/后期工时 */}
      <TableCell>
        {localTask.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <div className="flex flex-col gap-1">
            <Input
              type="number"
              value={localTask.estimatedHoursGraphic || ''}
              onChange={(e) => handleNumberChange('estimatedHoursGraphic', e.target.value)}
              className="w-14 h-6 text-xs"
              placeholder="平"
            />
            <Input
              type="number"
              value={localTask.estimatedHoursPost || ''}
              onChange={(e) => handleNumberChange('estimatedHoursPost', e.target.value)}
              className="w-14 h-6 text-xs"
              placeholder="后"
            />
          </div>
        )}
      </TableCell>
      
      {/* 优先级 */}
      <TableCell>
        <FastSelect
          value={localTask.priority}
          onChange={(v) => handleChange('priority', v)}
          options={PRIORITY_OPTIONS}
          className="w-16"
        />
      </TableCell>
      
      {/* 状态 */}
      <TableCell>
        <div className="flex items-center gap-1">
          <FastSelect
            value={localTask.status || 'pending'}
            onChange={(v) => handleChange('status', v)}
            options={STATUS_OPTIONS}
            className={`w-20 ${statusColor}`}
          />
          {isOverdue && actualStatus !== 'completed' && (
            <span className="text-xs text-red-500">⚠️</span>
          )}
        </div>
      </TableCell>
      
      {/* 截止日期 */}
      <TableCell>
        {localTask.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!localTask.deadline}
              onChange={handleSetDeadline}
              className="w-3 h-3"
            />
            {localTask.deadline ? (
              <Input
                type="date"
                value={formatDateToInputValue(localTask.deadline)}
                onChange={(e) => handleDateChange('deadline', e.target.value)}
                className="w-28 h-8 text-xs"
              />
            ) : (
              <span className="text-xs text-slate-400">不限</span>
            )}
          </div>
        )}
      </TableCell>
      
      {/* 依赖 */}
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <FastSelect
            value="none"
            onChange={handleAddDependency}
            options={[{ value: 'none', label: '+' }, ...availableDependencies.map(t => ({ value: t.id, label: t.name.slice(0, 12) }))]}
            className="w-16 h-6 text-xs"
          />
          {localTask.dependencies && localTask.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {localTask.dependencies.slice(0, 2).map(depId => {
                const depTask = tasks.find(t => t.id === depId);
                return depTask ? (
                  <Badge key={depId} variant="secondary" className="h-4 text-[10px] px-1">
                    {depTask.name.slice(0, 6)}
                    <button onClick={() => handleRemoveDependency(depId)} className="ml-0.5">×</button>
                  </Badge>
                ) : null;
              })}
              {localTask.dependencies.length > 2 && (
                <span className="text-[10px] text-slate-500">+{localTask.dependencies.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </TableCell>
      
      {/* 操作 */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onToggleLock(taskId)} className="h-6 w-6 p-0">
            <Lock className={`h-3 w-3 ${localTask.isLocked ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(taskId)} className="h-6 w-6 p-0" disabled={localTask.isSubTask}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prev, next) => {
  // 高性能比较
  const p = prev.task, n = next.task;
  return (
    p.id === n.id &&
    p.name === n.name &&
    p.projectId === n.projectId &&
    p.taskType === n.taskType &&
    p.subType === n.subType &&
    p.language === n.language &&
    p.fixedResourceId === n.fixedResourceId &&
    p.fixedResourceIdGraphic === n.fixedResourceIdGraphic &&
    p.fixedResourceIdPost === n.fixedResourceIdPost &&
    p.estimatedHours === n.estimatedHours &&
    p.estimatedHoursGraphic === n.estimatedHoursGraphic &&
    p.estimatedHoursPost === n.estimatedHoursPost &&
    p.priority === n.priority &&
    p.status === n.status &&
    p.deadline === n.deadline &&
    p.isLocked === n.isLocked &&
    p.dependencies?.length === n.dependencies?.length &&
    prev.activeProject === next.activeProject
  );
});

export default TaskRow;
