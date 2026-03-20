'use client';

import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Lock, Trash2 } from 'lucide-react';
import { Task, Project, Resource } from '@/types/schedule';
import { SUB_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/constants';

// 极简原生 select - 直接操作 DOM，零延迟
function InstantSelect({ 
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
  const ref = useRef<HTMLSelectElement>(null);
  const onChangeRef = useRef(onChange);
  
  // 保持 onChange 引用最新
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  return (
    <select
      ref={ref}
      defaultValue={value}
      onChange={(e) => onChangeRef.current(e.target.value)}
      className={`h-8 px-2 text-sm border rounded bg-white cursor-pointer ${className}`}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// 防抖输入
function FastInput({ 
  value, 
  onChange, 
  className,
  type = 'text',
  placeholder
}: { 
  value: string | number; 
  onChange: (v: string) => void; 
  className?: string;
  type?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeRef = useRef(onChange);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  return (
    <input
      ref={ref}
      type={type}
      defaultValue={value}
      placeholder={placeholder}
      onChange={(e) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onChangeRef.current(e.target.value);
        }, 200);
      }}
      className={`h-8 px-2 text-sm border rounded ${className || ''}`}
    />
  );
}

// 辅助函数
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

const formatDateTime = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// 预定义选项
const TASK_TYPE_OPTS = [{ value: 'none', label: '-' }, { value: '平面', label: '平面' }, { value: '后期', label: '后期' }, { value: '物料', label: '物料' }];
const PRIORITY_OPTS = [{ value: 'urgent', label: '紧急' }, { value: 'normal', label: '普通' }, { value: 'low', label: '低' }];
const STATUS_OPTS = [{ value: 'pending', label: '待处理' }, { value: 'in-progress', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'blocked', label: '已阻塞' }];
const SUB_TYPE_OPTS = [{ value: 'none', label: '-' }, ...SUB_TYPE_OPTIONS.map(o => ({ value: o, label: o }))];
const LANG_OPTS = [{ value: 'none', label: '-' }, ...LANGUAGE_OPTIONS.map(o => ({ value: o, label: o }))];

interface TaskRowProps {
  taskId: string;
  initialTask: Task;
  projects: { id: string; name: string }[];
  allTaskIds: string[];
  allTaskNames: Map<string, string>;
  resourceMap: Map<string, { id: string; name: string; workType?: string }>;
  graphicResources: { id: string; name: string }[];
  postResources: { id: string; name: string }[];
  resourcesByWorkType: Map<string, { id: string; name: string }[]>;
  activeProject: string;
  onChange: (taskId: string, field: keyof Task, value: any) => void;
  onToggleLock: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

// 完全独立的行组件 - 不依赖外部 tasks 状态
const TaskRow = memo(function TaskRow({
  taskId,
  initialTask,
  projects,
  allTaskIds,
  allTaskNames,
  resourceMap,
  graphicResources,
  postResources,
  resourcesByWorkType,
  activeProject,
  onChange,
  onToggleLock,
  onDelete,
}: TaskRowProps) {
  // 使用 ref 存储本地状态，避免重渲染
  const taskRef = useRef(initialTask);
  const [, forceUpdate] = useState(0);
  
  // 快速更新函数
  const updateField = useCallback((field: keyof Task, value: any) => {
    (taskRef.current as any)[field] = value;
    onChange(taskId, field, value);
  }, [taskId, onChange]);

  const task = taskRef.current;
  
  // 计算状态
  const now = new Date();
  const isOverdue = task.deadline && new Date(task.deadline) < now && task.status !== 'completed';
  const isCompound = task.estimatedHoursGraphic && task.estimatedHoursPost && 
    task.estimatedHoursGraphic > 0 && task.estimatedHoursPost > 0;

  // 获取可用资源
  const resources = task.taskType ? (resourcesByWorkType.get(task.taskType) || []) : [];
  const resourceOpts = [{ value: 'none', label: '自动' }, ...resources.map(r => ({ value: r.id, label: r.name }))];
  
  // 项目选项
  const projectOpts = [{ value: 'none', label: '未分配' }, ...projects.map(p => ({ value: p.id, label: p.name }))];
  
  // 依赖选项
  const depOpts = [{ value: 'none', label: '+' }];
  task.dependencies?.forEach(depId => {
    const name = allTaskNames.get(depId);
    if (name) depOpts.push({ value: depId, label: name.slice(0, 12) });
  });

  // 状态颜色
  const statusColors: Record<string, string> = {
    pending: 'text-slate-500', 'in-progress': 'text-blue-500',
    completed: 'text-green-500', blocked: 'text-red-500'
  };

  return (
    <TableRow>
      {/* 名称 */}
      <TableCell>
        <FastInput value={task.name} onChange={(v) => updateField('name', v)} className="h-8 min-w-[220px]" />
      </TableCell>
      
      {/* 项目 */}
      <TableCell>
        <InstantSelect
          value={task.projectId || 'none'}
          onChange={(v) => updateField('projectId', v === 'none' ? undefined : v)}
          options={projectOpts}
          className="min-w-[140px]"
        />
      </TableCell>
      
      {/* 任务类型 */}
      <TableCell>
        {isCompound ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">复合</Badge>
        ) : (
          <InstantSelect
            value={task.taskType || 'none'}
            onChange={(v) => updateField('taskType', v === 'none' ? undefined : v)}
            options={TASK_TYPE_OPTS}
            className="w-20"
          />
        )}
      </TableCell>
      
      {/* 细分类 */}
      <TableCell>
        <InstantSelect value={task.subType || 'none'} onChange={(v) => updateField('subType', v === 'none' ? undefined : v)} options={SUB_TYPE_OPTS} className="min-w-[100px]" />
      </TableCell>
      
      {/* 语言 */}
      <TableCell>
        <InstantSelect value={task.language || 'none'} onChange={(v) => updateField('language', v === 'none' ? undefined : v)} options={LANG_OPTS} className="w-24" />
      </TableCell>
      
      {/* 指定人员 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : isCompound ? (
          <div className="flex flex-col gap-1">
            <InstantSelect
              value={task.fixedResourceIdGraphic || 'none'}
              onChange={(v) => updateField('fixedResourceIdGraphic', v === 'none' ? undefined : v)}
              options={[{ value: 'none', label: '平面' }, ...graphicResources.map(r => ({ value: r.id, label: r.name }))]}
              className="min-w-[80px] h-6 text-xs"
            />
            <InstantSelect
              value={task.fixedResourceIdPost || 'none'}
              onChange={(v) => updateField('fixedResourceIdPost', v === 'none' ? undefined : v)}
              options={[{ value: 'none', label: '后期' }, ...postResources.map(r => ({ value: r.id, label: r.name }))]}
              className="min-w-[80px] h-6 text-xs"
            />
          </div>
        ) : (
          <InstantSelect value={task.fixedResourceId || 'none'} onChange={(v) => updateField('fixedResourceId', v === 'none' ? undefined : v)} options={resourceOpts} className="min-w-[100px]" />
        )}
      </TableCell>
      
      {/* 工时 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <FastInput type="datetime-local" value={formatDateTime(task.estimatedMaterialDate)} onChange={(v) => updateField('estimatedMaterialDate', v ? new Date(v) : undefined)} className="w-36 h-8 text-xs" />
        ) : (
          <FastInput type="number" value={task.estimatedHours || 0} onChange={(v) => updateField('estimatedHours', parseInt(v) || 0)} className="w-16 h-8" />
        )}
      </TableCell>
      
      {/* 平面/后期工时 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <div className="flex flex-col gap-1">
            <FastInput type="number" value={task.estimatedHoursGraphic || ''} onChange={(v) => updateField('estimatedHoursGraphic', v ? parseInt(v) : undefined)} className="w-14 h-6 text-xs" placeholder="平" />
            <FastInput type="number" value={task.estimatedHoursPost || ''} onChange={(v) => updateField('estimatedHoursPost', v ? parseInt(v) : undefined)} className="w-14 h-6 text-xs" placeholder="后" />
          </div>
        )}
      </TableCell>
      
      {/* 优先级 */}
      <TableCell>
        <InstantSelect value={task.priority} onChange={(v) => updateField('priority', v)} options={PRIORITY_OPTS} className="w-16" />
      </TableCell>
      
      {/* 状态 */}
      <TableCell>
        <div className="flex items-center gap-1">
          <InstantSelect
            value={task.status || 'pending'}
            onChange={(v) => updateField('status', v)}
            options={STATUS_OPTS}
            className={`w-20 ${statusColors[task.status || 'pending']}`}
          />
          {isOverdue && <span className="text-xs text-red-500">⚠️</span>}
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
              onChange={() => {
                if (!task.deadline) {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  d.setHours(18, 30, 0, 0);
                  updateField('deadline', d);
                } else {
                  updateField('deadline', undefined);
                }
              }}
              className="w-3 h-3"
            />
            {task.deadline ? (
              <FastInput type="date" value={formatDate(task.deadline)} onChange={(v) => { if (v) { const d = new Date(v); d.setHours(18, 30, 0, 0); updateField('deadline', d); } }} className="w-28 h-8 text-xs" />
            ) : (
              <span className="text-xs text-slate-400">不限</span>
            )}
          </div>
        )}
      </TableCell>
      
      {/* 依赖 */}
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <InstantSelect
            value="none"
            onChange={(v) => {
              if (v !== 'none' && !(task.dependencies || []).includes(v)) {
                updateField('dependencies', [...(task.dependencies || []), v]);
              }
            }}
            options={depOpts}
            className="w-16 h-6 text-xs"
          />
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {task.dependencies.slice(0, 2).map(depId => {
                const name = allTaskNames.get(depId);
                return name ? (
                  <Badge key={depId} variant="secondary" className="h-4 text-[10px] px-1">
                    {name.slice(0, 6)}
                    <button onClick={() => updateField('dependencies', task.dependencies?.filter(id => id !== depId))} className="ml-0.5">×</button>
                  </Badge>
                ) : null;
              })}
              {task.dependencies.length > 2 && <span className="text-[10px] text-slate-500">+{task.dependencies.length - 2}</span>}
            </div>
          )}
        </div>
      </TableCell>
      
      {/* 操作 */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onToggleLock(taskId)} className="h-6 w-6 p-0">
            <Lock className={`h-3 w-3 ${task.isLocked ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(taskId)} className="h-6 w-6 p-0" disabled={task.isSubTask}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prev, next) => {
  // 只比较 taskId，不比较任务内容
  return prev.taskId === next.taskId && prev.activeProject === next.activeProject;
});

export default TaskRow;
