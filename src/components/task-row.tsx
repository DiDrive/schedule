'use client';

import { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { Lock, Trash2 } from 'lucide-react';
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

// 细分类选项
const SUB_TYPE_OPTIONS = [
  '前瞻pv视频',
  '动态kv',
  '静态kv',
  '宣传海报',
  '产品图',
  '视频剪辑',
  '特效制作',
  '字幕制作',
  '调色',
  '音频处理',
  '其他'
];

// 语言选项
const LANGUAGE_OPTIONS = [
  '中文',
  '英文',
  '日文',
  '韩文',
  '中英双语',
  '多语言'
];

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

  // 计算状态
  const actualStatus = getTaskActualStatus(task);
  const isOverdue = isTaskOverdue(task);
  
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
      {/* 任务名称 */}
      <TableCell>
        <Input
          value={task.name}
          onChange={handleNameChange}
          className="h-8 min-w-[180px]"
        />
      </TableCell>
      
      {/* 项目 */}
      <TableCell>
        <Select
          value={task.projectId || 'none'}
          onValueChange={handleProjectChange}
          disabled={activeProject !== 'all'}
        >
          <SelectTrigger className="h-8 min-w-[100px]">
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
      <TableCell>
        {isCompoundTask ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
            复合
          </Badge>
        ) : (
          <Select
            value={task.taskType || 'none'}
            onValueChange={handleTaskTypeChange}
          >
            <SelectTrigger className="h-8 w-20">
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
      <TableCell>
        <Select
          value={task.subType || 'none'}
          onValueChange={handleSubTypeChange}
        >
          <SelectTrigger className="h-8 min-w-[100px]">
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
      <TableCell>
        <Select
          value={task.language || 'none'}
          onValueChange={handleLanguageChange}
        >
          <SelectTrigger className="h-8 w-24">
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
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : isCompoundTask ? (
          <div className="flex flex-col gap-1">
            <Select
              value={task.fixedResourceIdGraphic || 'none'}
              onValueChange={handleGraphicResourceChange}
            >
              <SelectTrigger className="h-6 text-xs min-w-[80px]">
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
              <SelectTrigger className="h-6 text-xs min-w-[80px]">
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
            <SelectTrigger className="h-8 min-w-[100px]">
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
        <TableCell>
          <Input
            type="datetime-local"
            value={formatDateTimeToInputValue(task.estimatedMaterialDate)}
            onChange={handleMaterialDateChange}
            className="w-36 h-8 text-xs"
          />
        </TableCell>
      ) : (
        <TableCell>
          <Input
            type="number"
            value={task.estimatedHours}
            onChange={handleHoursChange}
            className="w-16 h-8"
          />
        </TableCell>
      )}
      
      {/* 平面工时 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <Input
            type="number"
            value={task.estimatedHoursGraphic || ''}
            onChange={handleGraphicHoursChange}
            className="w-14 h-8"
            placeholder="0"
          />
        )}
      </TableCell>
      
      {/* 后期工时 */}
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <Input
            type="number"
            value={task.estimatedHoursPost || ''}
            onChange={handlePostHoursChange}
            className="w-14 h-8"
            placeholder="0"
          />
        )}
      </TableCell>
      
      {/* 优先级 */}
      <TableCell>
        <Select
          value={task.priority}
          onValueChange={handlePriorityChange}
        >
          <SelectTrigger className="h-8 w-16">
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
      <TableCell>
        <div className="flex items-center gap-1">
          <Select
            value={task.status || 'pending'}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="h-8 w-20">
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
      <TableCell>
        {task.taskType === '物料' ? (
          <span className="text-slate-400">-</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="radio"
              name={`deadline-${task.id}`}
              checked={task.deadline !== undefined}
              onChange={handleSetDeadline}
              className="w-3 h-3"
              disabled={task.status === 'completed'}
            />
            {task.deadline ? (
              <Input
                type="date"
                value={formatDateToInputValue(task.deadline)}
                onChange={handleDeadlineChange}
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
          <Select
            value=""
            onValueChange={handleAddDependency}
          >
            <SelectTrigger className="h-6 text-xs w-16">
              <SelectValue placeholder="+" />
            </SelectTrigger>
            <SelectContent>
              {tasks.filter(t => t.id !== task.id && !task.dependencies?.includes(t.id)).slice(0, 20).map(depTask => (
                <SelectItem key={depTask.id} value={depTask.id}>
                  {depTask.name.slice(0, 15)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {task.dependencies.slice(0, 2).map(depId => {
                const depTask = tasks.find(t => t.id === depId);
                if (!depTask) return null;
                return (
                  <Badge key={depId} variant="secondary" className="h-4 text-[10px] px-1">
                    {depTask.name.slice(0, 6)}
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
      <TableCell>
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
  // 自定义比较函数
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.projectId === nextProps.task.projectId &&
    prevProps.task.taskType === nextProps.task.taskType &&
    prevProps.task.subType === nextProps.task.subType &&
    prevProps.task.language === nextProps.task.language &&
    prevProps.task.fixedResourceId === nextProps.task.fixedResourceId &&
    prevProps.task.fixedResourceIdGraphic === nextProps.task.fixedResourceIdGraphic &&
    prevProps.task.fixedResourceIdPost === nextProps.task.fixedResourceIdPost &&
    prevProps.task.estimatedHours === nextProps.task.estimatedHours &&
    prevProps.task.estimatedHoursGraphic === nextProps.task.estimatedHoursGraphic &&
    prevProps.task.estimatedHoursPost === nextProps.task.estimatedHoursPost &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.deadline === nextProps.task.deadline &&
    prevProps.task.estimatedMaterialDate === nextProps.task.estimatedMaterialDate &&
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
