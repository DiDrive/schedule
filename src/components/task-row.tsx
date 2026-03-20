'use client';

import { memo, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Lock, Trash2 } from 'lucide-react';
import { Task } from '@/types/schedule';
import { SUB_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/constants';

// 极速原生输入 - 直接操作 DOM
function FastInput({ defaultValue, onChange, className, type, placeholder, disabled }: {
  defaultValue: string | number;
  onChange?: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  
  return (
    <input
      ref={ref}
      type={type || 'text'}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChangeRef.current?.(e.target.value)}
      className={`h-8 px-2 text-sm border rounded bg-white ${className || ''}`}
    />
  );
}

// 极速原生选择 - 直接操作 DOM，零 React 重渲染
function FastSelect({ defaultValue, options, onChange, className, disabled }: {
  defaultValue: string;
  options: { value: string; label: string }[];
  onChange?: (v: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  
  return (
    <select
      ref={ref}
      defaultValue={defaultValue}
      disabled={disabled}
      onChange={(e) => onChangeRef.current?.(e.target.value)}
      className={`h-8 px-2 text-sm border rounded bg-white cursor-pointer ${className || ''}`}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// 辅助函数
const formatDate = (d?: Date | string): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

const formatDateTime = (d?: Date | string): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 预定义选项
const TASK_TYPES = [{ value: '', label: '-' }, { value: '平面', label: '平面' }, { value: '后期', label: '后期' }, { value: '物料', label: '物料' }];
const PRIORITIES = [{ value: 'urgent', label: '紧急' }, { value: 'normal', label: '普通' }, { value: 'low', label: '低' }];
const STATUSES = [{ value: 'pending', label: '待处理' }, { value: 'in-progress', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'blocked', label: '已阻塞' }];
const SUB_TYPES = [{ value: '', label: '-' }, ...SUB_TYPE_OPTIONS.map(o => ({ value: o, label: o }))];
const LANGUAGES = [{ value: '', label: '-' }, ...LANGUAGE_OPTIONS.map(o => ({ value: o, label: o }))];

interface Props {
  taskId: string;
  task: Task;
  projects: { id: string; name: string }[];
  taskNames: Map<string, string>;
  resourcesByType: Map<string, { id: string; name: string }[]>;
  graphicResources: { id: string; name: string }[];
  postResources: { id: string; name: string }[];
  activeProject: string;
  onUpdate: (id: string, field: keyof Task, value: any) => void;
  onLock: (id: string) => void;
  onDelete: (id: string) => void;
}

const TaskRow = memo(function TaskRow({
  taskId, task, projects, taskNames, resourcesByType, graphicResources, postResources, activeProject, onUpdate, onLock, onDelete
}: Props) {
  // 本地状态 ref - 完全不触发 React 重渲染
  const data = useRef({ ...task });
  const updateRef = useRef(onUpdate);
  useEffect(() => { updateRef.current = onUpdate; }, [onUpdate]);
  
  // 极速更新函数 - 直接修改 ref，异步通知父组件
  const set = useCallback((field: keyof Task, value: any) => {
    (data.current as any)[field] = value;
    // 使用 queueMicrotask 异步通知，不阻塞当前操作
    queueMicrotask(() => updateRef.current(taskId, field, value));
  }, [taskId]);

  const t = data.current;
  const isCompound = t.estimatedHoursGraphic && t.estimatedHoursPost && t.estimatedHoursGraphic > 0 && t.estimatedHoursPost > 0;
  const isOverdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed';
  
  // 获取可用资源 - 根据 taskType 获取对应类型的资源
  const taskType = t.taskType || '';
  
  // 优先从 resourcesByType 获取（飞书有工作类型字段时）
  // 如果没有，则从缓存的 graphicResources/postResources 获取
  // 如果还是没有，则合并所有可用资源作为兜底
  let resources: { id: string; name: string }[] = [];
  
  if (taskType === '平面') {
    // 平面任务：优先使用按类型分组的资源，否则使用 graphicResources
    resources = resourcesByType.get('平面')?.length ? resourcesByType.get('平面')! : graphicResources;
    // 如果还是没有，使用所有资源作为兜底
    if (resources.length === 0) {
      resources = [...graphicResources, ...postResources];
    }
  } else if (taskType === '后期') {
    // 后期任务：优先使用按类型分组的资源，否则使用 postResources
    resources = resourcesByType.get('后期')?.length ? resourcesByType.get('后期')! : postResources;
    // 如果还是没有，使用所有资源作为兜底
    if (resources.length === 0) {
      resources = [...graphicResources, ...postResources];
    }
  } else if (taskType === '物料') {
    // 物料任务：不需要人员
    resources = [];
  }
  // 注意：复合任务 (isCompound=true) 不走这里，因为它在 UI 上显示两个下拉框
  
  // 复合任务的备选数据：如果 graphicResources/postResources 为空，使用所有资源
  const graphicOpts = graphicResources.length > 0 
    ? graphicResources 
    : [...graphicResources, ...postResources]; // 如果平面资源为空，使用所有资源
  const postOpts = postResources.length > 0 
    ? postResources 
    : [...graphicResources, ...postResources]; // 如果后期资源为空，使用所有资源
  
  const resourceOpts = [{ value: '', label: '自动' }, ...resources.map(r => ({ value: r.id, label: r.name }))];
  const projectOpts = [{ value: '', label: '未分配' }, ...projects.map(p => ({ value: p.id, label: p.name }))];
  
  
  const depOpts = [{ value: '', label: '+' }];
  (t.dependencies || []).forEach(id => {
    const name = taskNames.get(id);
    if (name && !depOpts.find(o => o.value === id)) depOpts.push({ value: id, label: name.slice(0, 12) });
  });

  const statusColor: Record<string, string> = { pending: 'text-slate-500', 'in-progress': 'text-blue-500', completed: 'text-green-500', blocked: 'text-red-500' };

  return (
    <TableRow>
      <TableCell><FastInput defaultValue={t.name} onChange={v => set('name', v)} className="h-8 min-w-[220px]" /></TableCell>
      <TableCell><FastSelect defaultValue={t.projectId || ''} options={projectOpts} onChange={v => set('projectId', v || undefined)} className="min-w-[140px]" disabled={activeProject !== 'all'} /></TableCell>
      <TableCell>
        {isCompound ? <Badge variant="outline" className="bg-purple-50 text-purple-700">复合</Badge> :
          <FastSelect defaultValue={t.taskType || ''} options={TASK_TYPES} onChange={v => set('taskType', v || undefined)} className="w-20" />}
      </TableCell>
      <TableCell><FastSelect defaultValue={t.subType || ''} options={SUB_TYPES} onChange={v => set('subType', v || undefined)} className="min-w-[100px]" /></TableCell>
      <TableCell><FastSelect defaultValue={t.language || ''} options={LANGUAGES} onChange={v => set('language', v || undefined)} className="w-24" /></TableCell>
      <TableCell>
        {t.taskType === '物料' ? <span className="text-slate-400">-</span> :
          isCompound ? (
            <div className="flex flex-col gap-1">
              <FastSelect defaultValue={t.fixedResourceIdGraphic || ''} options={[{ value: '', label: '平面' }, ...graphicOpts.map(r => ({ value: r.id, label: r.name }))]} onChange={v => set('fixedResourceIdGraphic', v || undefined)} className="min-w-[80px] h-6 text-xs" />
              <FastSelect defaultValue={t.fixedResourceIdPost || ''} options={[{ value: '', label: '后期' }, ...postOpts.map(r => ({ value: r.id, label: r.name }))]} onChange={v => set('fixedResourceIdPost', v || undefined)} className="min-w-[80px] h-6 text-xs" />
            </div>
          ) : <FastSelect defaultValue={t.fixedResourceId || ''} options={resourceOpts} onChange={v => set('fixedResourceId', v || undefined)} className="min-w-[100px]" />}
      </TableCell>
      <TableCell>
        {t.taskType === '物料' ? <FastInput type="datetime-local" defaultValue={formatDateTime(t.estimatedMaterialDate)} onChange={v => set('estimatedMaterialDate', v ? new Date(v) : undefined)} className="w-36 h-8 text-xs" /> :
          <FastInput type="number" defaultValue={t.estimatedHours || 0} onChange={v => set('estimatedHours', parseInt(v) || 0)} className="w-16 h-8" />}
      </TableCell>
      <TableCell>
        {t.taskType === '物料' ? <span className="text-slate-400">-</span> :
          <div className="flex flex-col gap-1">
            <FastInput type="number" defaultValue={t.estimatedHoursGraphic || ''} placeholder="平" onChange={v => set('estimatedHoursGraphic', v ? parseInt(v) : undefined)} className="w-14 h-6 text-xs" />
            <FastInput type="number" defaultValue={t.estimatedHoursPost || ''} placeholder="后" onChange={v => set('estimatedHoursPost', v ? parseInt(v) : undefined)} className="w-14 h-6 text-xs" />
          </div>}
      </TableCell>
      <TableCell><FastSelect defaultValue={t.priority} options={PRIORITIES} onChange={v => set('priority', v)} className="w-16" /></TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <FastSelect defaultValue={t.status || 'pending'} options={STATUSES} onChange={v => set('status', v)} className={`w-20 ${statusColor[t.status || 'pending']}`} />
          {isOverdue && <span className="text-xs text-red-500">⚠️</span>}
        </div>
      </TableCell>
      <TableCell>
        {t.taskType === '物料' ? <span className="text-slate-400">-</span> :
          <div className="flex items-center gap-1">
            <input type="checkbox" checked={!!t.deadline} onChange={() => set('deadline', t.deadline ? undefined : (() => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 30, 0, 0); return d; })())} className="w-3 h-3" />
            {t.deadline ? <FastInput type="date" defaultValue={formatDate(t.deadline)} onChange={v => { if (v) { const d = new Date(v); d.setHours(18, 30, 0, 0); set('deadline', d); } }} className="w-28 h-8 text-xs" /> : <span className="text-xs text-slate-400">不限</span>}
          </div>}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <FastSelect defaultValue="" options={depOpts.filter(o => o.value && !(t.dependencies || []).includes(o.value)).slice(0, 21)} onChange={v => { if (v && !(t.dependencies || []).includes(v)) set('dependencies', [...(t.dependencies || []), v]); }} className="w-16 h-6 text-xs" />
          {t.dependencies && t.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {t.dependencies.slice(0, 2).map(id => {
                const name = taskNames.get(id);
                return name ? <Badge key={id} variant="secondary" className="h-4 text-[10px] px-1">{name.slice(0, 6)}<button onClick={() => set('dependencies', t.dependencies?.filter(d => d !== id))} className="ml-0.5">×</button></Badge> : null;
              })}
              {t.dependencies.length > 2 && <span className="text-[10px] text-slate-500">+{t.dependencies.length - 2}</span>}
            </div>)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onLock(taskId)} className="h-6 w-6 p-0"><Lock className={`h-3 w-3 ${t.isLocked ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} /></Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(taskId)} className="h-6 w-6 p-0" disabled={t.isSubTask}><Trash2 className="h-3 w-3 text-red-500" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (p, n) => p.taskId === n.taskId && p.activeProject === n.activeProject);

export default TaskRow;
