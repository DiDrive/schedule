'use client';

import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Lock, Trash2 } from 'lucide-react';
import { Task, Project, Resource } from '@/types/schedule';
import { SUB_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/constants';

// 轻量级原生 select 组件
function LiteSelect({ 
  value, 
  onChange, 
  options, 
  placeholder,
  disabled,
  className = ''
}: { 
  value: string; 
  onChange: (v: string) => void; 
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`h-8 px-2 text-sm border rounded bg-white ${className}`}
    >
      {placeholder && <option value="none">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
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

const SUB_TYPE_OPTIONS_LITE = SUB_TYPE_OPTIONS.map(opt => ({ value: opt, label: opt }));
const LANGUAGE_OPTIONS_LITE = LANGUAGE_OPTIONS.map(opt => ({ value: opt, label: opt }));

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

  // 同步外部值变化
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // 防抖更新
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  }, [onChange]);

  return (
    <Input
      value={localValue}
      onChange={handleChange}
      className={className}
    />
  );
}

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

// 使用原生 select 的高性能行组件
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
  
  // 计算状态
  const actualStatus = getTaskActualStatus(task);
  const isOverdue = isTaskOverdue(task);
  
  // 判断是否是复合任务
  const isCompoundTask = task.estimatedHoursGraphic && task.estimatedHoursPost && 
    task.estimatedHoursGraphic > 0 && task.estimatedHoursPost > 0;

  // 获取可用资源
  const displayResources = useMemo(() => {
    const filtered = task.taskType ? (resourcesByWorkType.get(task.taskType) || []) : [];
    const current = task.fixedResourceId ? resourceMap.get(task.fixedResourceId) : null;
    if (current && !filtered.find(r => r.id === task.fixedResourceId)) {
      return [current, ...filtered];
    }
    return filtered;
  }, [task.taskType, task.fixedResourceId, resourcesByWorkType, resourceMap]);

  // 可选的依赖任务
  const availableDependencies = useMemo(() => {
    return tasks.filter(t => t.id !== taskId && !task.dependencies?.includes(t.id)).slice(0, 30);
  }, [tasks, taskId, task.dependencies]);

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

  // 简化的事件处理
  const handleChange = useCallback((field: keyof Task, value: any) => {
    onTaskChange(taskId, field, value === 'none' ? undefined : value);
  }, [taskId, onTaskChange]);

  const handleNumberChange = useCallback((field: keyof Task, value: string) => {
    onTaskChange(taskId, field, value ? parseInt(value) : undefined);
  }, [taskId, onTaskChange]);

  const handleDateChange = useCallback((field: keyof Task, value: string) => {
    if (value) {
      const date = new Date(value);
      if (field === 'deadline') {
        date.setHours(18, 30, 0, 0);
      }
      onTaskChange(taskId, field, date);
    }
  }, [taskId, onTaskChange]);

  const handleAddDependency = useCallback((value: string) => {
    if (value && value !== 'none' && !task.dependencies?.includes(value)) {
      onTaskChange(taskId, 'dependencies', [...(task.dependencies || []), value]);
    }
  }, [taskId, task.dependencies, onTaskChange]);

  const handleRemoveDependency = useCallback((depId: string) => {
    onTaskChange(taskId, 'dependencies', task.dependencies?.filter(id => id !== depId) || []);
  }, [taskId, task.dependencies, onTaskChange]);

  const handleSetDeadline = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(18, 30, 0, 0);
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

  // 处理名称变化的回调
  const handleNameChange = useCallback((v: string) => {
    onTaskChange(taskId, 'name', v);
  }, [taskId, onTaskChange]);

  return (
    <TableRow>
      {/* 任务名称 */}
      <TableCell>
        <DebouncedInput
          value={task.name}
          onChange={handleNameChange}
          className="h-8 min-w-[220px]"
        />
      </TableCell>
      
      {/* 项目 */}
      <TableCell>
        <LiteSelect
          value={task.projectId || 'none'}
          onChange={(v) => handleChange('projectId', v)}
          options={projectOptions.slice(1)}
          placeholder="未分配"
          disabled={activeProject !== 'all'}
          className="min-w-[140px]"
        />
      </TableCell>
      
      {/* 任务类型 */}
      <TableCell>
        {isCompoundTask ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">复合</Badge>
        ) : (
          <LiteSelect
            value={task.taskType || 'none'}
            onChange={(v) => handleChange('taskType', v)}
            options={TASK_TYPE_OPTIONS}
            className="w-20"
          />
        )}
      </TableCell>
      
      {/* 细分类 */}
      <TableCell>
        <LiteSelect
          value={task.subType || 'none'}
          onChange={(v) => handleChange('subType', v)}
          options={SUB_TYPE_OPTIONS_LITE}
          placeholder="-"
          className="min-w-[100px]"
        />
      </TableCell>
      
      {/* 语言 */}
      <TableCell>
        <LiteSelect
          value={task.language || 'none'}
          onChange={(v) => handleChange('language', v)}
          options={LANGUAGE_OPTIONS_LITE}
          placeholder="-"
          className="w-24"
        />
      </TableCell>
      
      {/* 指定人员 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : isCompoundTask ? (
          <div className="flex flex-col gap-1">
            <LiteSelect
              value={task.fixedResourceIdGraphic || 'none'}
              onChange={(v) => handleChange('fixedResourceIdGraphic', v)}
              options={[
                { value: 'none', label: '平面-自动' },
                ...graphicResources.map(r => ({ value: r.id, label: r.name }))
              ]}
              className="min-w-[80px] h-6 text-xs"
            />
            <LiteSelect
              value={task.fixedResourceIdPost || 'none'}
              onChange={(v) => handleChange('fixedResourceIdPost', v)}
              options={[
                { value: 'none', label: '后期-自动' },
                ...postResources.map(r => ({ value: r.id, label: r.name }))
              ]}
              className="min-w-[80px] h-6 text-xs"
            />
          </div>
        ) : (
          <LiteSelect
            value={task.fixedResourceId || 'none'}
            onChange={(v) => handleChange('fixedResourceId', v)}
            options={resourceOptions}
            className="min-w-[100px]"
          />
        )}
      </TableCell>
      
      {/* 工时/提供时间 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <Input
            type="datetime-local"
            value={formatDateTimeToInputValue(task.estimatedMaterialDate)}
            onChange={(e) => handleDateChange('estimatedMaterialDate', e.target.value)}
            className="w-36 h-8 text-xs"
          />
        ) : (
          <Input
            type="number"
            value={task.estimatedHours}
            onChange={(e) => handleNumberChange('estimatedHours', e.target.value)}
            className="w-16 h-8"
          />
        )}
      </TableCell>
      
      {/* 平面/后期工时 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <>
            <Input
              type="number"
              value={task.estimatedHoursGraphic || ''}
              onChange={(e) => handleNumberChange('estimatedHoursGraphic', e.target.value)}
              className="w-14 h-8 mb-1"
              placeholder="平"
            />
            <Input
              type="number"
              value={task.estimatedHoursPost || ''}
              onChange={(e) => handleNumberChange('estimatedHoursPost', e.target.value)}
              className="w-14 h-8"
              placeholder="后"
            />
          </>
        )}
      </TableCell>
      
      {/* 优先级 */}
      <TableCell>
        <LiteSelect
          value={task.priority}
          onChange={(v) => handleChange('priority', v)}
          options={PRIORITY_OPTIONS}
          className="w-16"
        />
      </TableCell>
      
      {/* 状态 */}
      <TableCell>
        <div className="flex items-center gap-1">
          <LiteSelect
            value={task.status || 'pending'}
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
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!task.deadline}
              onChange={handleSetDeadline}
              className="w-3 h-3"
              disabled={task.status === 'completed'}
            />
            {task.deadline ? (
              <Input
                type="date"
                value={formatDateToInputValue(task.deadline)}
                onChange={(e) => handleDateChange('deadline', e.target.value)}
                className="w-28 h-8 text-xs"
                disabled={task.status === 'completed'}
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
          <LiteSelect
            value="none"
            onChange={handleAddDependency}
            options={[
              { value: 'none', label: '+' },
              ...availableDependencies.map(t => ({ value: t.id, label: t.name.slice(0, 15) }))
            ]}
            className="w-16 h-6 text-xs"
          />
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {task.dependencies.slice(0, 2).map(depId => {
                const depTask = tasks.find(t => t.id === depId);
                return depTask ? (
                  <Badge key={depId} variant="secondary" className="h-4 text-[10px] px-1">
                    {depTask.name.slice(0, 6)}
                    <button onClick={() => handleRemoveDependency(depId)} className="ml-0.5">×</button>
                  </Badge>
                ) : null;
              })}
              {task.dependencies.length > 2 && (
                <span className="text-[10px] text-slate-500">+{task.dependencies.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </TableCell>
      
      {/* 操作 */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleLock(taskId)}
            title={task.isLocked ? '已锁定' : '点击锁定'}
            className="h-6 w-6 p-0"
          >
            <Lock className={`h-3 w-3 ${task.isLocked ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(taskId)}
            className="h-6 w-6 p-0"
            disabled={task.isSubTask}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prev, next) => {
  // 高性能比较：只比较关键字段
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
