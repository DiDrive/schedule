'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, GitBranch, Users, AlertTriangle, CheckCircle2, Network, Plus, Trash2, Settings, Download, Sparkles, Loader2, Calendar, MoreVertical, Globe, FileText, RefreshCw, Lock, Zap } from 'lucide-react';
import { generateSchedule, generateIncrementalSchedule, detectResourceConflicts } from '@/lib/schedule-algorithms';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { defaultWorkingHours } from '@/lib/sample-data';
import { Task, ScheduleResult, Project, Resource, ResourceLevel, ResourceConflictStrategy, ConflictTask } from '@/types/schedule';
import GanttChart from '@/components/gantt-chart';
import { CalendarView } from '@/components/views/calendar-view';
import { ConflictResolutionDialog } from '@/components/conflict-resolution-dialog';
import { TaskSplitDialog } from '@/components/task-split-dialog';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import TemplateDialog from '@/components/template-dialog';
import TaskRow from '@/components/task-row';

// 辅助函数：将 Date 或字符串转换为 YYYY-MM-DD 格式
const formatDateToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  // 检查日期是否有效
  if (isNaN(d.getTime())) return '';
  // 使用本地时间，避免时区问题
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 辅助函数：将 Date 或字符串转换为 YYYY-MM-DDTHH:mm 格式（用于datetime-local）
const formatDateTimeToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  // 检查日期是否有效
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// 辅助函数：格式化日期时间
const formatDateTime = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  // 检查日期是否有效
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};

const formatDate = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  // 检查日期是否有效
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

// 默认项目数据
const defaultProjects: Project[] = [
  {
    id: 'proj-1',
    name: '宣传片项目',
    description: '企业宣传视频制作',
    priority: 'urgent',
    resourcePool: ['res-1', 'res-2', 'res-3', 'res-4'],
    color: '#3b82f6',
    tasks: []
  },
  {
    id: 'proj-2',
    name: '广告片项目',
    description: '产品广告视频制作',
    priority: 'urgent',
    resourcePool: ['res-1', 'res-3'],
    color: '#10b981',
    tasks: []
  },
  {
    id: 'proj-3',
    name: '纪录片项目',
    description: '企业纪录片制作',
    priority: 'normal',
    resourcePool: ['res-2', 'res-5'],
    color: '#f59e0b',
    tasks: []
  }
];

// 默认任务数据（自动分配资源）
const defaultTasks: Task[] = [
  {
    id: 'task-p1-1',
    name: '概念设计',
    description: '设计视频整体风格和创意',
    estimatedHours: 16,
    assignedResources: [], // 自动分配
    projectId: 'proj-1',
    priority: 'high',
    status: 'pending',
    taskType: '平面',
    dependencies: []
  },
  {
    id: 'task-p1-2',
    name: '分镜设计',
    description: '绘制详细的分镜脚本',
    estimatedHours: 40,
    assignedResources: [], // 自动分配
    projectId: 'proj-1',
    priority: 'high',
    status: 'pending',
    taskType: '平面',
    dependencies: ['task-p1-1']
  },
  {
    id: 'task-p1-3',
    name: '视频剪辑',
    description: '完成视频剪辑和拼接',
    estimatedHours: 64,
    assignedResources: [], // 自动分配
    projectId: 'proj-1',
    priority: 'normal',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p1-2']
  },
  {
    id: 'task-p2-1',
    name: '品牌VI设计',
    description: '设计品牌视觉识别',
    estimatedHours: 24,
    assignedResources: [], // 自动分配
    projectId: 'proj-2',
    priority: 'urgent',
    status: 'pending',
    taskType: '平面',
    dependencies: []
  },
  {
    id: 'task-p2-2',
    name: '产品包装设计',
    description: '完成产品包装设计',
    estimatedHours: 40,
    assignedResources: [], // 自动分配
    projectId: 'proj-2',
    priority: 'high',
    status: 'pending',
    taskType: '平面',
    dependencies: ['task-p2-1']
  },
  {
    id: 'task-p2-3',
    name: '特效制作',
    description: '制作视频特效和动画',
    estimatedHours: 80,
    assignedResources: [], // 自动分配
    projectId: 'proj-2',
    priority: 'high',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p2-2']
  },
  {
    id: 'task-p3-1',
    name: '采访拍摄',
    description: '进行人物采访拍摄',
    estimatedHours: 32,
    assignedResources: [], // 自动分配
    projectId: 'proj-3',
    priority: 'high',
    status: 'pending',
    taskType: '后期',
    dependencies: []
  },
  {
    id: 'task-p3-2',
    name: '字幕制作',
    description: '制作视频字幕和图示',
    estimatedHours: 48,
    assignedResources: [], // 自动分配
    projectId: 'proj-3',
    priority: 'high',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p3-1']
  },
  {
    id: 'task-p3-3',
    name: '调色和音频处理',
    description: '完成画面调色和音频处理',
    estimatedHours: 56,
    assignedResources: [], // 自动分配
    projectId: 'proj-3',
    priority: 'normal',
    status: 'pending',
    taskType: '后期',
    dependencies: ['task-p3-2']
  }
];

// 默认共享资源（带等级和效率）
const defaultResources: Resource[] = [
  {
    id: 'res-1',
    name: '张设计师',
    type: 'human',
    workType: '平面',
    level: 'senior',
    efficiency: 1.5,
    skills: ['平面设计', '品牌VI', 'UI设计'],
    availability: 0.9,
    color: '#3b82f6'
  },
  {
    id: 'res-2',
    name: '李后期',
    type: 'human',
    workType: '后期',
    level: 'senior',
    efficiency: 1.5,
    skills: ['视频剪辑', '特效制作', '调色'],
    availability: 1.0,
    color: '#10b981'
  },
  {
    id: 'res-3',
    name: '王平面',
    type: 'human',
    workType: '平面',
    level: 'junior',
    efficiency: 1.0,
    skills: ['插画设计', '分镜设计', '排版'],
    availability: 0.8,
    color: '#f59e0b'
  },
  {
    id: 'res-4',
    name: '赵后期',
    type: 'human',
    workType: '后期',
    level: 'junior',
    efficiency: 1.0,
    skills: ['字幕制作', '音频处理', '剪辑'],
    availability: 0.85,
    color: '#8b5cf6'
  },
  {
    id: 'res-5',
    name: '小助理',
    type: 'human',
    workType: '后期',
    level: 'assistant',
    efficiency: 0.7,
    skills: ['基础剪辑', '素材整理', '字幕制作'],
    availability: 0.9,
    color: '#ec4899'
  }
];

export default function ComplexScenario() {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [sharedResources, setSharedResources] = useState<Resource[]>(defaultResources);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [activeProject, setActiveProject] = useState<string>('all');
  const [activeTaskType, setActiveTaskType] = useState<'all' | '平面' | '后期' | '物料'>('all');
  const [activeView, setActiveView] = useState<'gantt' | 'calendar'>('gantt');
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [isAiOptimizing, setIsAiOptimizing] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState<ResourceConflictStrategy>('auto-switch');
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<Map<string, ConflictTask[]>>(new Map());
  const [justResolvedConflict, setJustResolvedConflict] = useState(false);
  const [savedResolutions, setSavedResolutions] = useState<Map<string, 'switch' | 'delay'> | null>(null);
  const [deadlineWarningCount, setDeadlineWarningCount] = useState(0);
  const [showDeadlineWarningDialog, setShowDeadlineWarningDialog] = useState(false);
  const [deadlineWarningDays, setDeadlineWarningDays] = useState(3); // 默认3天
  const [showDeadlineSettingsDialog, setShowDeadlineSettingsDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [nearDeadlineCount, setNearDeadlineCount] = useState(0); // 临近任务数
  const [overdueCount, setOverdueCount] = useState(0); // 超期任务数
  const [showTaskSplitDialog, setShowTaskSplitDialog] = useState(false);
  const [selectedTaskForSplit, setSelectedTaskForSplit] = useState<Task | null>(null);
  const [isSyncingToFeishu, setIsSyncingToFeishu] = useState(false);
  const [isLoadingFromFeishu, setIsLoadingFromFeishu] = useState(false);
  const [showFeishuDialog, setShowFeishuDialog] = useState(false);
  
  // 增量排期相关状态
  const [forceFullReschedule, setForceFullReschedule] = useState(false); // 强制完全重新排期

  // 标记是否需要强制生成排期（用于任务拆分后立即生成）
  const forceGenerateSchedule = useRef(false);

  // 全局任务ID计数器，确保ID唯一
  const taskIdCounter = useRef(Date.now());

  // 使用 ref 跟踪是否已经加载过数据，避免重复加载
  const hasLoadedData = useRef(false);

  // 数据加载：只在组件首次挂载时执行
  useEffect(() => {
    if (hasLoadedData.current) return;
    hasLoadedData.current = true;

    console.log('[数据加载] 开始加载数据...');
    
    // 检查数据来源
    const dataSourceInfo = localStorage.getItem('complex-scenario-data-source');
    if (dataSourceInfo) {
      const source = JSON.parse(dataSourceInfo);
      console.log('[数据加载] 数据来源:', source.source);
      console.log('[数据加载] 加载模式:', source.loadMode);
      console.log('[数据加载] 任务数量:', source.taskCount);
      console.log('[数据加载] 保存时间:', new Date(source.timestamp).toLocaleString());
    }

    const savedProjects = localStorage.getItem('complex-scenario-projects');
    const savedTasks = localStorage.getItem('complex-scenario-tasks');
    const savedResources = localStorage.getItem('complex-scenario-resources');
    const savedScheduleResult = localStorage.getItem('complex-scenario-schedule-result');

    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);
      console.log('[数据加载] 从localStorage加载了', parsed.length, '个任务');
      if (parsed.length > 0) {
        console.log('[数据加载] 第一个任务:', parsed[0].name);
        console.log('[数据加载] 最后一个任务:', parsed[parsed.length - 1].name);
      }
    }

    // 检查并清理可能存在的不一致数据
    if (savedResources) {
      const resources = JSON.parse(savedResources);
      console.log('[数据加载] 检测到已保存的资源数据，数量:', resources.length);

      // 检查资源是否有 feishuPersonId 字段（飞书数据的标志）
      const hasFeishuData = resources.some((r: any) => r.feishuPersonId);

      if (!hasFeishuData && resources.length > 0) {
        console.warn('[数据加载] 检测到旧格式的资源数据，建议从飞书重新加载以确保数据一致性');
      }
    }

    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      setProjects(parsed);
    }

    // 先加载资源，这样在加载任务时可以验证资源ID
    if (savedResources) {
      setSharedResources(JSON.parse(savedResources));
    }

    if (savedTasks) {
      // 检测是否有重复ID问题（只检查 tasks 中的数据）
      let hasDuplicateIds = false;
      let duplicateIds: string[] = [];

      const parsed = JSON.parse(savedTasks);

      // 收集所有任务ID进行检查
      const allTaskIds = new Map<string, number>();
      parsed.forEach((t: Task) => {
        const count = allTaskIds.get(t.id) || 0;
        allTaskIds.set(t.id, count + 1);
        if (count > 0) {
          hasDuplicateIds = true;
          if (!duplicateIds.includes(t.id)) {
            duplicateIds.push(t.id);
          }
        }

        // 检测多次拆分导致的嵌套ID
        const subCount = (t.id.match(/-sub-/g) || []).length;
        if (subCount >= 2) {
          hasDuplicateIds = true;
          if (!duplicateIds.includes(t.id)) {
            duplicateIds.push(t.id);
          }
        }
      });

      if (hasDuplicateIds) {
        console.warn('检测到数据异常，重复的任务ID:', duplicateIds);
        console.warn('清除旧数据并重新加载');
        // 清除所有旧数据
        localStorage.removeItem('complex-scenario-projects');
        localStorage.removeItem('complex-scenario-tasks');
        localStorage.removeItem('complex-scenario-resources');
        localStorage.removeItem('complex-scenario-schedule-result');

        // 使用默认数据
        setProjects(defaultProjects);
        setTasks(defaultTasks);
        setSharedResources(defaultResources);
        setScheduleResult(null);
        hasLoadedData.current = true;
        return;
      }
    }
    
    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);

      // 从已加载的资源中提取所有有效的资源ID
      const resourceIds = new Set<string>();
      if (savedResources) {
        const resources = JSON.parse(savedResources);
        resources.forEach((r: any) => resourceIds.add(r.id));
        console.log('[数据加载] 可用的资源ID列表:', Array.from(resourceIds));
      }

      // 重新构建任务ID集合（因为之前可能因为重复ID而返回）
      const taskIdSet = new Set<string>();
      parsed.forEach((t: Task) => taskIdSet.add(t.id));

      // 将日期字符串转换回 Date 对象
      const tasksWithDates = parsed.map((t: Task) => {
        const deadline = t.deadline ? new Date(t.deadline) : undefined;
        // 统一将截止日期时间设置为18:30:00（下班时间）
        if (deadline) {
          deadline.setHours(18, 30, 0, 0);
        }

        // 清理无效的依赖关系（指向不存在的任务ID）
        const validDependencies = (t.dependencies || []).filter(depId => {
          const isValid = taskIdSet.has(depId) && depId !== t.id; // 检查依赖是否存在且不是自依赖
          if (!isValid && depId) {
            console.warn(`发现无效依赖: 任务 ${t.name} (${t.id}) 依赖不存在的任务 ${depId}`);
          }
          return isValid;
        });

        // 验证并清理无效的资源引用
        let validFixedResourceId = t.fixedResourceId;
        let validAssignedResources = t.assignedResources || [];

        // 检查 fixedResourceId 是否存在
        if (t.fixedResourceId && !resourceIds.has(t.fixedResourceId)) {
          console.warn(`[数据加载] 任务 ${t.name} (${t.id}): fixedResourceId ${t.fixedResourceId} 不存在，已清除`);
          validFixedResourceId = undefined;
        }

        // 检查 assignedResources 中的资源ID是否都存在
        validAssignedResources = (t.assignedResources || []).filter(resourceId => {
          if (!resourceIds.has(resourceId)) {
            console.warn(`[数据加载] 任务 ${t.name} (${t.id}): assignedResources ${resourceId} 不存在，已移除`);
            return false;
          }
          return true;
        });

        if (t.fixedResourceId !== validFixedResourceId || JSON.stringify(t.assignedResources) !== JSON.stringify(validAssignedResources)) {
          console.log(`[数据加载] 任务 ${t.name} (${t.id}): 资源引用已清理`);
        }

        return {
          ...t,
          deadline,
          startDate: t.startDate ? new Date(t.startDate) : undefined,
          endDate: t.endDate ? new Date(t.endDate) : undefined,
          dependencies: validDependencies,
          fixedResourceId: validFixedResourceId,
          assignedResources: validAssignedResources
        };
      });
      setTasks(tasksWithDates);
    }

    // 资源已经在前面的代码中加载了，这里不需要重复加载

    if (savedScheduleResult) {
      const parsed = JSON.parse(savedScheduleResult);
      // 将日期字符串转换回 Date 对象
      const scheduleResultWithDates = {
        ...parsed,
        tasks: parsed.tasks.map((t: Task) => {
          const deadline = t.deadline ? new Date(t.deadline) : undefined;
          // 统一将截止日期时间设置为18:30:00（下班时间）
          if (deadline) {
            deadline.setHours(18, 30, 0, 0);
          }
          return {
            ...t,
            deadline,
            startDate: t.startDate ? new Date(t.startDate) : undefined,
            endDate: t.endDate ? new Date(t.endDate) : undefined
          };
        }),
        resourceConflicts: parsed.resourceConflicts.map((rc: any) => ({
          ...rc,
          timeRange: {
            start: new Date(rc.timeRange.start),
            end: new Date(rc.timeRange.end)
          }
        })),
        projects: parsed.projects
      };
      setScheduleResult(scheduleResultWithDates);
    }
  }, []);

  // 防抖保存到 localStorage - 避免每次输入都触发大量序列化操作
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 延迟 500ms 保存，避免频繁写入
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
      localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));
      localStorage.setItem('complex-scenario-resources', JSON.stringify(sharedResources));
      if (scheduleResult) {
        localStorage.setItem('complex-scenario-schedule-result', JSON.stringify(scheduleResult));
      }
    }, 500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [projects, tasks, sharedResources, scheduleResult]);

  // 计算快到截止日期的任务数量
  useEffect(() => {
    if (!scheduleResult) {
      setDeadlineWarningCount(0);
      setNearDeadlineCount(0);
      setOverdueCount(0);
      return;
    }

    const warningTasks = scheduleResult.tasks.filter(task => {
      if (!task.deadline || !task.endDate) return false;

      const daysToDeadline = Math.ceil(
        (task.deadline.getTime() - task.endDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 如果任务的结束时间已经超过了截止日期，或者距离截止日期小于设定的天数
      return daysToDeadline < deadlineWarningDays;
    });

    // 分别计算临近任务数和超期任务数
    const nearTasks = warningTasks.filter(task => {
      if (!task.deadline || !task.endDate) return false;
      const daysToDeadline = Math.ceil(
        (task.deadline.getTime() - task.endDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysToDeadline >= 0 && daysToDeadline < deadlineWarningDays;
    });

    const overdueTasks = warningTasks.filter(task => {
      if (!task.deadline || !task.endDate) return false;
      const daysToDeadline = Math.ceil(
        (task.deadline.getTime() - task.endDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysToDeadline < 0;
    });

    setDeadlineWarningCount(warningTasks.length);
    setNearDeadlineCount(nearTasks.length);
    setOverdueCount(overdueTasks.length);
  }, [scheduleResult, deadlineWarningDays]);

  // ==================== 性能优化：缓存资源筛选结果 ====================
  // 缓存平面资源列表
  const graphicResources = useMemo(() => 
    sharedResources.filter(r => r.type === 'human' && r.workType === '平面'),
    [sharedResources]
  );
  
  // 缓存后期资源列表
  const postResources = useMemo(() => 
    sharedResources.filter(r => r.type === 'human' && r.workType === '后期'),
    [sharedResources]
  );
  
  // 缓存物料资源列表
  const materialResources = useMemo(() => 
    sharedResources.filter(r => r.type === 'human' && r.workType === '物料'),
    [sharedResources]
  );
  
  // 缓存资源ID到资源的映射（用于快速查找）
  const resourceMap = useMemo(() => {
    const map = new Map<string, Resource>();
    sharedResources.forEach(r => map.set(r.id, r));
    return map;
  }, [sharedResources]);
  
  // 缓存按工作类型分组的资源
  const resourcesByWorkType = useMemo(() => {
    const map = new Map<string, Resource[]>();
    sharedResources.forEach(r => {
      if (r.type === 'human' && r.workType) {
        const list = map.get(r.workType) || [];
        list.push(r);
        map.set(r.workType, list);
      }
    });
    return map;
  }, [sharedResources]);
  
  // 缓存筛选后的任务列表（避免每次渲染都执行 filter）
  const filteredTasks = useMemo(() => 
    tasks.filter(task =>
      (activeProject === 'all' || task.projectId === activeProject) &&
      (activeTaskType === 'all' || task.taskType === activeTaskType)
    ),
    [tasks, activeProject, activeTaskType]
  );
  
  // 缓存项目ID到项目的映射
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);
  
  // 获取项目的辅助函数（使用缓存）
  const getProjectById = useCallback((projectId: string) => 
    projectMap.get(projectId),
    [projectMap]
  );

  const handleGenerateSchedule = (force = false, tasksOverride?: Task[]) => {
    const tasksToUse = tasksOverride || tasks;
    console.log('[ComplexScenario] handleGenerateSchedule called, force:', force, 'tasks count:', tasksToUse.length);
    console.log('[ComplexScenario] 强制完全重新排期:', forceFullReschedule);
    
    // 拆分复合任务：将同时填写了平面和后期工时的任务拆分为父任务+子任务
    const expandedTasks: Task[] = [];
    tasksToUse.forEach(task => {
      // 检查是否是复合任务（同时填写了平面和后期工时，且不是子任务）
      if (task.estimatedHoursGraphic && task.estimatedHoursPost && 
          task.estimatedHoursGraphic > 0 && task.estimatedHoursPost > 0 &&
          !task.isSubTask && !task.parentTaskId) {
        console.log(`[ComplexScenario] 拆分复合任务: ${task.name}`);
        
        // 创建父任务（保持原任务信息）
        const parentTask: Task = {
          ...task,
          estimatedHours: task.estimatedHoursGraphic + task.estimatedHoursPost
        };
        
        // 创建平面子任务
        const graphicTask: Task = {
          id: `${task.id}-graphic`,
          name: `${task.name}（平面）`,
          parentTaskId: task.id,
          isSubTask: true,
          subTaskType: '平面',
          taskType: '平面',
          projectId: task.projectId,
          estimatedHours: task.estimatedHoursGraphic,
          estimatedHoursGraphic: task.estimatedHoursGraphic,
          deadline: task.deadline,
          priority: task.priority,
          status: task.status,
          assignedResources: [],
          dependencies: task.dependencies || [], // 继承父任务的依赖
          fixedResourceId: task.fixedResourceIdGraphic, // 使用指定的平面负责人
          subType: task.subType, // 继承细分类
          language: task.language, // 继承语言
        };
        
        // 后期子任务的依赖：根据配置决定是否依赖平面子任务
        const postTaskDependencies = task.subTaskDependencyMode === 'serial' 
          ? [`${task.id}-graphic`] // 串行：后期依赖平面
          : (task.dependencies || []); // 并行：继承父任务的依赖
        
        // 创建后期子任务
        const postTask: Task = {
          id: `${task.id}-post`,
          name: `${task.name}（后期）`,
          parentTaskId: task.id,
          isSubTask: true,
          subTaskType: '后期',
          taskType: '后期',
          projectId: task.projectId,
          estimatedHours: task.estimatedHoursPost,
          estimatedHoursPost: task.estimatedHoursPost,
          deadline: task.deadline,
          priority: task.priority,
          status: task.status,
          assignedResources: [],
          dependencies: postTaskDependencies,
          fixedResourceId: task.fixedResourceIdPost, // 使用指定的后期负责人
          subType: task.subType, // 继承细分类
          language: task.language, // 继承语言
        };
        
        expandedTasks.push(parentTask, graphicTask, postTask);
      } else if (task.isSubTask || task.parentTaskId) {
        // 已经是子任务，直接添加（避免重复拆分）
        expandedTasks.push(task);
      } else {
        // 普通任务，直接添加
        expandedTasks.push(task);
      }
    });
    
    console.log('[ComplexScenario] 拆分后任务数:', expandedTasks.length);

    // 检查是否有物料任务未填写提供时间
    const materialTasksWithoutDate = expandedTasks.filter(t => t.taskType === '物料' && !t.estimatedMaterialDate);
    if (materialTasksWithoutDate.length > 0) {
      setIsComputing(false);
      const taskNames = materialTasksWithoutDate.map(t => t.name).join('、');
      alert(`⚠️ 无法生成排期\n\n以下物料任务尚未填写提供时间：\n${taskNames}\n\n请先在任务管理中填写这些任务的提供时间。`);
      return;
    }

    setIsComputing(true);

    // 如果刚刚解决过冲突，直接生成排期（跳过冲突检测）
    if (justResolvedConflict && savedResolutions) {
      setTimeout(() => {
        console.log('[ComplexScenario] 生成排期（使用保存的解决方案）');
        // 使用增量排期
        const result = generateIncrementalSchedule(
          expandedTasks, 
          sharedResources, 
          new Date(), 
          defaultWorkingHours, 
          conflictStrategy, 
          forceFullReschedule
        );
        setScheduleResult(result);

        // 同步更新原始任务的时间和状态
        syncTasksWithScheduleResult(result.tasks);

        // 基于新生成的排期结果重新检测冲突，更新 pendingConflicts
        const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
        setPendingConflicts(newConflicts);

        setIsComputing(false);
        
        // 显示增量排期提示
        showIncrementalScheduleNotification(result, expandedTasks);
      }, 500);
      return;
    }

    // 如果强制生成，跳过冲突检测
    if (force) {
      setTimeout(() => {
        console.log('[ComplexScenario] 强制生成排期（跳过冲突检测）');
        // 使用增量排期
        const result = generateIncrementalSchedule(
          expandedTasks, 
          sharedResources, 
          new Date(), 
          defaultWorkingHours, 
          conflictStrategy, 
          forceFullReschedule
        );
        setScheduleResult(result);

        // 同步更新原始任务的时间和状态
        syncTasksWithScheduleResult(result.tasks);

        // 基于 scheduleResult 重新检测冲突，确保 pendingConflicts 同步
        const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
        setPendingConflicts(newConflicts);

        setIsComputing(false);
        
        // 显示增量排期提示
        showIncrementalScheduleNotification(result, expandedTasks);
      }, 500);
      return;
    }

    // 否则，检测资源冲突（始终使用当前正在编辑的任务列表）
    const conflicts = detectResourceConflicts(expandedTasks, sharedResources, undefined);

    console.log('[ComplexScenario] 检测到冲突数量:', conflicts.size);

    if (conflicts.size > 0) {
      // 有冲突，显示对话框
      setPendingConflicts(conflicts);
      setConflictDialogOpen(true);
      setIsComputing(false);
    } else {
      // 没有冲突，直接生成排期
      setTimeout(() => {
        console.log('[ComplexScenario] 生成排期（无冲突）');
        // 使用增量排期
        const result = generateIncrementalSchedule(
          expandedTasks, 
          sharedResources, 
          new Date(), 
          defaultWorkingHours, 
          conflictStrategy, 
          forceFullReschedule
        );
        setScheduleResult(result);

        // 同步更新原始任务的时间和状态
        syncTasksWithScheduleResult(result.tasks);

        // 基于 scheduleResult 重新检测冲突，确保 pendingConflicts 同步
        const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
        setPendingConflicts(newConflicts);

        setIsComputing(false);
        
        // 显示增量排期提示
        showIncrementalScheduleNotification(result, expandedTasks);
      }, 500);
    }
  };
  
  // 同步任务列表与排期结果（更新时间和自动计算状态）
  const syncTasksWithScheduleResult = (scheduledTasks: Task[]) => {
    const now = new Date();
    setTasks(prevTasks => prevTasks.map(task => {
      const scheduled = scheduledTasks.find(t => t.id === task.id);
      if (scheduled) {
        // 计算自动状态（新逻辑：completed需要手动确认）
        let autoStatus: 'pending' | 'in-progress' | 'to-confirm' = 'pending';
        if (scheduled.startDate && scheduled.endDate) {
          if (now < scheduled.startDate) {
            autoStatus = 'pending';
          } else if (now >= scheduled.endDate) {
            autoStatus = 'to-confirm'; // 改为待确认完成
          } else {
            autoStatus = 'in-progress';
          }
        }
        
        // 已完成和已阻塞是终态，保持不变
        // 其他状态根据时间自动计算
        let newStatus = task.status;
        if (task.status === 'completed' || task.status === 'blocked') {
          // 保持原状态
          newStatus = task.status;
        } else if (task.isLocked && task.status) {
          // 手动锁定的任务保持原状态
          newStatus = task.status;
        } else {
          // 自动计算状态
          newStatus = autoStatus;
        }
        
        return {
          ...task,
          startDate: scheduled.startDate,
          endDate: scheduled.endDate,
          assignedResources: scheduled.assignedResources,
          status: newStatus
        };
      }
      return task;
    }));
  };
  
  // 显示增量排期结果通知
  const showIncrementalScheduleNotification = (result: ScheduleResult, allTasks: Task[]) => {
    const lockedCount = allTasks.filter(t => 
      t.status === 'completed' || t.status === 'in-progress' || t.isLocked
    ).length;
    const newScheduledCount = result.tasks.length - lockedCount;
    
    if (lockedCount > 0 && !forceFullReschedule) {
      console.log(`[增量排期] 已保留 ${lockedCount} 个锁定任务，新排 ${newScheduledCount} 个任务`);
      
      // 如果有警告，显示提示
      if (result.warnings.length > 0) {
        console.warn('[增量排期警告]', result.warnings);
      }
    }
  };

  const handleConflictResolution = (resolutions: Map<string, 'switch' | 'delay'>) => {
    setIsComputing(true);
    setJustResolvedConflict(true); // 标记刚刚解决了冲突
    setSavedResolutions(resolutions); // 保存用户的选择
    setTimeout(() => {
      // 根据用户的选择生成排期（使用增量排期）
      const result = generateIncrementalSchedule(
        tasks, 
        sharedResources, 
        new Date(), 
        defaultWorkingHours, 
        conflictStrategy, 
        forceFullReschedule,
        resolutions
      );
      setScheduleResult(result);

      // 同步更新原始任务的时间和状态
      syncTasksWithScheduleResult(result.tasks);

      // 基于新生成的排期结果重新检测冲突
      const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
      setPendingConflicts(newConflicts);

      setIsComputing(false);
      
      // 显示增量排期提示
      showIncrementalScheduleNotification(result, tasks);
    }, 500);
  };

  const handleTaskChange = useCallback((taskId: string, field: keyof Task, value: any) => {
    // 合并状态更新，减少渲染次数
    setTasks(prevTasks => {
      const newTasks = prevTasks.map(t => {
        if (t.id !== taskId) return t;

        // 如果修改的是截止日期，将时间设置为18:30（下班时间）
        const WORK_END_HOUR = 18.5; // 18:30
        if (field === 'deadline' && value instanceof Date) {
          const deadline = new Date(value);
          deadline.setHours(WORK_END_HOUR, 30, 0, 0); // 设置为18:30:00
          value = deadline;
        }

        // 如果修改的是任务类型，检查当前的 fixedResourceId 是否匹配新的类型
        if (field === 'taskType' && t.fixedResourceId) {
          const fixedResource = resourceMap.get(t.fixedResourceId);
          if (fixedResource && fixedResource.workType !== value) {
            return { ...t, [field]: value, fixedResourceId: undefined };
          }
        }

        // 如果状态变为已完成，记录实际完成时间
        if (field === 'status' && value === 'completed') {
          return { ...t, [field]: value, actualEndDate: new Date() };
        }

        // 如果状态从已完成变为其他状态，清除实际完成时间
        if (field === 'status' && t.status === 'completed' && value !== 'completed') {
          return { ...t, [field]: value, actualEndDate: undefined };
        }

        // 如果修改的是平面工时或后期工时，自动计算总工时
        if (field === 'estimatedHoursGraphic' || field === 'estimatedHoursPost') {
          const graphicHours = field === 'estimatedHoursGraphic' ? (value || 0) : (t.estimatedHoursGraphic || 0);
          const postHours = field === 'estimatedHoursPost' ? (value || 0) : (t.estimatedHoursPost || 0);
          const totalHours = graphicHours + postHours;
          
          return { 
            ...t, 
            [field]: value,
            estimatedHours: totalHours || t.estimatedHours
          };
        }

        return { ...t, [field]: value };
      });
      
      return newTasks;
    });
    
    // 重置冲突相关状态（合并为一次更新）
    setJustResolvedConflict(false);
    setSavedResolutions(null);
    setPendingConflicts(new Map());
  }, [resourceMap]);

  const handleDeleteTask = useCallback((taskId: string) => {
    setShowDeadlineWarningDialog(false); // 关闭预警弹窗
    setJustResolvedConflict(false); // 任务变更，重置冲突解决标记
    setSavedResolutions(null); // 重置保存的解决方案
    setPendingConflicts(new Map()); // 清除待处理的冲突

    // 同时从其他任务的依赖中移除该任务，然后删除任务本身
    setTasks(prevTasks => prevTasks
      .map(t => ({
        ...t,
        dependencies: t.dependencies?.filter(d => d !== taskId)
      }))
      .filter(t => t.id !== taskId)
    );
  }, []);

  // 切换任务锁定状态
  const handleToggleTaskLock = useCallback((taskId: string) => {
    setTasks(prevTasks => prevTasks.map(t => {
      if (t.id === taskId) {
        return { ...t, isLocked: !t.isLocked };
      }
      return t;
    }));
  }, []);

  // 处理任务拆分
  const handleTaskSplit = (subTasks: any[], summaryHours: number) => {
    if (!selectedTaskForSplit) return;

    console.log('[ComplexScenario] 开始处理任务拆分');
    console.log('[ComplexScenario] 原任务:', selectedTaskForSplit);
    console.log('[ComplexScenario] 子任务数量:', subTasks.length);
    console.log('[ComplexScenario] 汇总工时:', summaryHours);

    setJustResolvedConflict(false); // 任务变更，重置冲突解决标记
    setSavedResolutions(null); // 重置保存的解决方案
    setPendingConflicts(new Map()); // 清除待处理的冲突

    // 创建子任务 - 使用全局计数器确保ID唯一
    const newSubTasks: Task[] = subTasks.map((subTask, index) => {
      taskIdCounter.current += 1; // 确保每个子任务ID唯一
      return {
        id: `task-${taskIdCounter.current}-sub-${index}`,
        name: subTask.name,
        description: `任务拆分 - ${selectedTaskForSplit.name} 的第 ${index + 1} 部分`,
        estimatedHours: subTask.estimatedHours,
        assignedResources: subTask.assignedResource ? [subTask.assignedResource] : [],
        priority: 'high', // 拆分任务设为高优先级
        status: 'pending',
        projectId: selectedTaskForSplit.projectId,
        dependencies: [
          ...(selectedTaskForSplit.dependencies || []), // 继承原任务的依赖
          ...(subTask.dependencies || []) // 子任务之间的依赖关系
        ],
        taskType: selectedTaskForSplit.taskType,
        deadline: selectedTaskForSplit.deadline, // 继承截止日期
        fixedResourceId: subTask.assignedResource || undefined, // 如果手动指定，则固定资源
      };
    });

    console.log('[ComplexScenario] 创建的子任务:', newSubTasks);

    // 创建一个汇总任务（用于等待所有子任务完成）
    taskIdCounter.current += 1;
    const summaryTask: Task = {
      id: `task-${taskIdCounter.current}-summary`,
      name: `${selectedTaskForSplit.name}（汇总）`,
      description: summaryHours > 0 ? `等待所有子任务完成并进行整合（需要 ${summaryHours} 小时）` : '等待所有子任务完成',
      estimatedHours: summaryHours || 0,
      assignedResources: [],
      priority: 'high',
      status: 'pending',
      projectId: selectedTaskForSplit.projectId,
      dependencies: newSubTasks.map(t => t.id), // 依赖所有子任务
      taskType: selectedTaskForSplit.taskType,
      deadline: selectedTaskForSplit.deadline,
    };

    console.log('[ComplexScenario] 创建的汇总任务:', summaryTask);

    // 更新依赖这个任务的其他任务
    const dependentTasks = tasks.filter(t => t.dependencies?.includes(selectedTaskForSplit.id));
    console.log('[ComplexScenario] 依赖原任务的其他任务:', dependentTasks);

    // 删除原任务
    const updatedTasks = tasks
      .map(t => ({
        ...t,
        dependencies: t.dependencies?.map(d => d === selectedTaskForSplit.id ? summaryTask.id : d)
      }))
      .filter(t => t.id !== selectedTaskForSplit.id);

    // 添加子任务和汇总任务
    const finalTasks = [...updatedTasks, ...newSubTasks, summaryTask];
    console.log('[ComplexScenario] 最终任务列表数量:', finalTasks.length);
    console.log('[ComplexScenario] 更新任务列表');

    setTasks(finalTasks);
    setShowTaskSplitDialog(false);
    setSelectedTaskForSplit(null);

    // 调用生成排期（强制生成，跳过冲突检测，使用最新的任务列表）
    console.log('[ComplexScenario] 调用生成排期（强制）');
    handleGenerateSchedule(true, finalTasks);
  };

  // 打开任务拆分弹窗
  const openTaskSplitDialog = (task: Task) => {
    console.log('[ComplexScenario] 打开任务拆分弹窗:', task.name);
    setSelectedTaskForSplit(task);
    setShowTaskSplitDialog(true);
  };

  const handleAddTask = (taskType: '平面' | '后期' | '物料' = '平面') => {
    setJustResolvedConflict(false); // 任务变更，重置冲突解决标记
    setSavedResolutions(null); // 重置保存的解决方案
    setPendingConflicts(new Map()); // 清除待处理的冲突
    taskIdCounter.current += 1; // 确保ID唯一
    // 设置默认截止日期为一周后（工作日）
    const defaultDeadline = new Date();
    let daysToAdd = 7;
    while (daysToAdd > 0) {
      defaultDeadline.setDate(defaultDeadline.getDate() + 1);
      const dayOfWeek = defaultDeadline.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 跳过周末
        daysToAdd--;
      }
    }
    const newTask: Task = {
      id: `task-${taskIdCounter.current}`,
      name: `新任务 ${tasks.length + 1}`,
      description: '',
      estimatedHours: taskType === '物料' ? 0 : 8,
      assignedResources: [], // 自动分配
      priority: 'normal',
      status: 'pending',
      projectId: activeProject === 'all' ? projects[0]?.id : activeProject,
      dependencies: [],
      taskType,
      deadline: defaultDeadline
    };
    setTasks([...tasks, newTask]);
  };

  const handleAddProject = () => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: `新项目 ${projects.length + 1}`,
      description: '',
      priority: 'normal',
      resourcePool: [],
      color: '#64748b',
      tasks: []
    };
    setProjects([...projects, newProject]);
  };

  // 处理从模板创建项目
  const handleProjectFromTemplate = (project: Project) => {
    // 添加到项目列表
    setProjects([...projects, project]);

    // 添加项目任务到任务列表
    setTasks([...tasks, ...project.tasks]);

    // 清空排期结果，需要重新计算
    setScheduleResult(null);

    // 显示成功消息
    alert(`已成功从模板创建项目 "${project.name}"，包含 ${project.tasks.length} 个任务`);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(projects.filter(p => p.id !== projectId));
    // 同时删除该项目的所有任务
    setTasks(tasks.filter(t => t.projectId !== projectId));
  };

  const handleProjectChange = (projectId: string, field: keyof Project, value: any) => {
    setProjects(projects.map(p => p.id === projectId ? { ...p, [field]: value } : p));
    
    // 如果修改的是项目优先级，同步更新所有子任务的优先级
    if (field === 'priority' && (value === 'urgent' || value === 'normal')) {
      setTasks(tasks.map(t => 
        t.projectId === projectId ? { ...t, priority: value } : t
      ));
    }
  };

  // filteredTasks 已在上方使用 useMemo 缓存

  // 根据排期时间自动计算任务状态
  // 新逻辑：
  // - 当前时间 < 开始时间 → 待处理
  // - 开始时间 ≤ 当前时间 < 结束时间 → 进行中
  // - 当前时间 ≥ 结束时间 且 未手动确认 → 待确认完成
  // - 用户手动确认 → 已完成
  // - 当前时间 > 截止日期且未完成 → 超期（显示警告，但不改变状态）
  const calculateAutoStatus = (task: Task): 'pending' | 'in-progress' | 'to-confirm' => {
    const now = new Date();
    
    // 如果没有排期信息，保持待处理
    if (!task.startDate || !task.endDate) {
      return 'pending';
    }
    
    // 当前时间在开始时间之前 -> 待处理
    if (now < task.startDate) {
      return 'pending';
    }
    
    // 当前时间在结束时间之后 -> 待确认完成（需要人工确认）
    if (now >= task.endDate) {
      return 'to-confirm';
    }
    
    // 当前时间在开始时间和结束时间之间 -> 进行中
    return 'in-progress';
  };

  // 检查任务是否超期（当前时间 > 截止日期，且任务未完成）
  const isTaskOverdue = (task: Task): boolean => {
    if (!task.deadline || task.status === 'completed') {
      return false;
    }
    const now = new Date();
    return now > task.deadline;
  };

  // 获取任务的实际状态
  // - 已完成和已阻塞是终态，不会自动改变
  // - 其他状态根据时间自动计算
  const getTaskActualStatus = (task: Task): 'pending' | 'in-progress' | 'to-confirm' | 'completed' | 'overdue' | 'blocked' => {
    // 已完成和已阻塞是终态，保持不变
    if (task.status === 'completed' || task.status === 'blocked') {
      return task.status;
    }
    
    // 如果已超期（超过截止日期且未完成），显示超期警告
    // 但实际状态仍然根据时间计算
    if (isTaskOverdue(task)) {
      // 如果已经到了结束时间，显示待确认
      if (task.endDate && new Date() >= task.endDate) {
        return 'to-confirm';
      }
      // 否则显示进行中或待处理
      return calculateAutoStatus(task);
    }
    
    // 否则使用自动计算的状态
    return calculateAutoStatus(task);
  };

  // 自动更新所有任务状态
  const handleAutoUpdateStatus = () => {
    if (!scheduleResult) {
      alert('请先生成排期结果');
      return;
    }
    
    const updatedTasks = tasks.map(task => {
      const autoStatus = calculateAutoStatus(task);
      // 只有当任务没有被手动锁定且不是阻塞状态时，才自动更新状态
      if (!task.isLocked && task.status !== 'blocked') {
        return { ...task, status: autoStatus };
      }
      return task;
    });
    
    setTasks(updatedTasks);
    console.log('[ComplexScenario] 已自动更新任务状态');
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'senior': return 'bg-purple-500 text-white';
      case 'junior': return 'bg-blue-500 text-white';
      case 'assistant': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  // 资源管理
  const handleAddResource = () => {
    const newResource: Resource = {
      id: `res-${Date.now()}`,
      name: '新成员',
      type: 'human',
      workType: '平面', // 默认为平面
      level: 'junior',
      efficiency: 1.0,
      availability: 1.0,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };
    setSharedResources([...sharedResources, newResource]);
  };

  const handleDeleteResource = (resourceId: string) => {
    setSharedResources(sharedResources.filter(r => r.id !== resourceId));
  };

  const handleResourceChange = (resourceId: string, field: keyof Resource, value: any) => {
    setSharedResources(sharedResources.map(r => r.id === resourceId ? { ...r, [field]: value } : r));
  };

  // 手动调整任务负责人
  const handleUpdateTaskResource = (taskId: string, newResourceId: string) => {
    if (!scheduleResult) return;

    const updatedTasks = scheduleResult.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          assignedResources: newResourceId ? [newResourceId] : []
        };
      }
      return task;
    });

    setScheduleResult({
      ...scheduleResult,
      tasks: updatedTasks
    });

    // 同步更新原始任务列表
    setTasks(tasks.map(t => t.id === taskId ? { ...t, assignedResources: newResourceId ? [newResourceId] : [] } : t));
  };

  // 导出Excel
  const handleExportToExcel = () => {
    if (!scheduleResult) return;

    // 根据当前选择的任务类型过滤数据
    const filteredTasks = scheduleResult.tasks.filter(task =>
      (activeProject === 'all' || task.projectId === activeProject) &&
      (activeTaskType === 'all' || task.taskType === activeTaskType)
    );

    // 准备导出数据
    const exportData = filteredTasks.map(task => {
      const resource = sharedResources.find(r => r.id === task.assignedResources[0]);
      const project = getProjectById(task.projectId || '');
      return {
        '任务名称': task.name,
        '所属项目': project?.name || '-',
        '任务类型': task.taskType || '未指定',
        '负责人': resource ? resource.name : '未分配',
        '负责人类型': resource ? resource.workType || '-' : '-',
        '预估工时(小时)': task.estimatedHours,
        '优先级': task.priority,
        '开始时间': task.startDate ? formatDateTime(task.startDate) : '-',
        '结束时间': task.endDate ? formatDateTime(task.endDate) : '-',
        '状态': task.status,
        '是否关键路径': scheduleResult.criticalPath.includes(task.id) ? '是' : '否'
      };
    });

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData);

    // 设置列宽
    const colWidths = [
      { wch: 20 }, // 任务名称
      { wch: 15 }, // 所属项目
      { wch: 10 }, // 任务类型
      { wch: 12 }, // 负责人
      { wch: 10 }, // 负责人等级
      { wch: 10 }, // 负责人类型
      { wch: 12 }, // 预估工时
      { wch: 8 },  // 优先级
      { wch: 18 }, // 开始时间
      { wch: 18 }, // 结束时间
      { wch: 10 }, // 状态
      { wch: 12 }  // 是否关键路径
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '排期表');

    // 根据当前选择的任务类型生成文件名
    const taskTypeSuffix = activeTaskType === 'all' ? '' : `_${activeTaskType}`;
    const fileName = `复杂项目排期${taskTypeSuffix}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 处理飞书集成对话框中的同步操作
  // 处理飞书集成对话框中的同步操作（同步到飞书）
  const handleFeishuDialogSync = async () => {
    console.log('[Feishu Sync Dialog] 开始同步所有数据到飞书');
    
    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    let config = JSON.parse(configStr);
    
    // 兼容性处理：检测旧配置格式并转换
    if (config.appToken && !config.newMode && !config.legacyMode) {
      console.log('[Feishu Sync Dialog] 检测到旧配置格式，自动转换...');
      const oldTableIds = config.tableIds || {};
      const dataSourceMode = config.dataSourceMode || 'new';
      
      config = {
        appId: config.appId,
        appSecret: config.appSecret,
        dataSourceMode: dataSourceMode,
        newMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            requirements1: oldTableIds.requirements1 || '',
            requirements2: oldTableIds.requirements2 || '',
            schedules: oldTableIds.schedules || '',
          },
        },
        legacyMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            projects: oldTableIds.projects || '',
            tasks: oldTableIds.tasks || '',
            schedules: oldTableIds.schedules || '',
          },
        },
      };
    }
    
    const dataSourceMode = config.dataSourceMode || 'new';
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    
    console.log('[Feishu Sync Dialog] 当前模式:', dataSourceMode);
    console.log('[Feishu Sync Dialog] 模式配置:', modeConfig);
    
    if (!config.appId || !config.appSecret || !modeConfig?.appToken) {
      alert('飞书配置不完整，请确保已填写 App ID、App Secret 和当前模式的 App Token');
      return;
    }
    
    const results: string[] = [];

    // 同步项目（仅传统模式支持）
    if (dataSourceMode === 'legacy' && projects.length > 0 && modeConfig?.tableIds?.projects) {
      try {
        const response = await fetch('/api/feishu/sync-projects-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projects: projects,
            tasks: [],
            config: {
              appId: config.appId,
              appSecret: config.appSecret,
              appToken: modeConfig.appToken,
              tableIds: { projects: modeConfig.tableIds.projects, tasks: modeConfig.tableIds.tasks || '', resources: modeConfig.tableIds.resources || '' },
            },
          }),
        });
        const result = await response.json();
        if (result.success) {
          const deleted = result.stats.projects.deleted || 0;
          const projectResult = deleted > 0 
            ? `✅ 项目：创建 ${result.stats.projects.created}，更新 ${result.stats.projects.updated}，删除 ${deleted}`
            : `✅ 项目：创建 ${result.stats.projects.created}，更新 ${result.stats.projects.updated}`;
          results.push(projectResult);
        } else {
          results.push(`❌ 项目：${result.message}`);
        }
      } catch (error) {
        results.push(`❌ 项目：${error instanceof Error ? error.message : '同步失败'}`);
      }
    }

    // 同步任务（仅传统模式支持）
    if (dataSourceMode === 'legacy' && tasks.length > 0 && modeConfig?.tableIds?.tasks) {
      // 创建项目ID到项目名称的映射
      const projectIdToName = new Map<string, string>();
      projects.forEach((p: any) => {
        if (p.id) projectIdToName.set(p.id, p.name);
      });
      
      // 使用排期后的任务数据（如果存在），否则使用原始任务数据
      // 排期后的数据包含负责人(assignedResources)和依赖关系(dependencies)
      const tasksToSync = scheduleResult?.tasks || tasks;
      console.log(`[Feishu Sync] 任务同步: 原始任务${tasks.length}个, 排期后任务${scheduleResult?.tasks?.length || 0}个, 将同步${tasksToSync.length}个任务`);
      
      // 将任务中的项目ID替换为项目名称
      const tasksWithProjectNames = tasksToSync.map((task: any) => ({
        ...task,
        projectName: task.projectId ? projectIdToName.get(task.projectId) || '' : ''
      }));
      
      try {
        const response = await fetch('/api/feishu/sync-projects-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projects: [],
            tasks: tasksWithProjectNames,
            projectsMap: Object.fromEntries(projectIdToName),
            config: {
              appId: config.appId,
              appSecret: config.appSecret,
              appToken: modeConfig.appToken,
              tableIds: {
                projects: modeConfig.tableIds.projects || '',
                tasks: modeConfig.tableIds.tasks,
                resources: modeConfig.tableIds.resources || ''
              },
            },
          }),
        });
        const result = await response.json();
        if (result.success) {
          const deleted = result.stats.tasks.deleted || 0;
          const taskResult = deleted > 0 
            ? `✅ 任务：创建 ${result.stats.tasks.created}，更新 ${result.stats.tasks.updated}，删除 ${deleted}`
            : `✅ 任务：创建 ${result.stats.tasks.created}，更新 ${result.stats.tasks.updated}`;
          results.push(taskResult);
        } else {
          results.push(`❌ 任务：${result.message}`);
        }
      } catch (error) {
        results.push(`❌ 任务：${error instanceof Error ? error.message : '同步失败'}`);
      }
    }

    // 同步排期
    if (scheduleResult && modeConfig?.tableIds?.schedules) {
      try {
        const syncTasks = scheduleResult.tasks.map(task => {
          const resource = sharedResources.find(r => r.id === task.assignedResources[0]);
          const project = getProjectById(task.projectId || '');
          const originalTask = tasks.find(t => t.id === task.id);
          return {
            id: task.id,
            name: task.name,
            projectName: project?.name || '',
            assignedResourceId: task.assignedResources[0] || '',
            assignedResourceName: resource?.name || '',
            startDate: task.startDate ? task.startDate.toISOString() : '',
            endDate: task.endDate ? task.endDate.toISOString() : '',
            estimatedHours: task.estimatedHours,
            estimatedHoursGraphic: originalTask?.estimatedHoursGraphic,
            estimatedHoursPost: originalTask?.estimatedHoursPost,
            subTaskDependencyMode: originalTask?.subTaskDependencyMode,
            suggestedDeadline: task.suggestedDeadline ? task.suggestedDeadline.toISOString() : undefined,
            status: task.status,
            priority: task.priority,
            taskType: task.taskType || '',
            feishuRecordId: originalTask?.feishuRecordId,
          };
        });

        // 使用新的配置结构构建 URL
        let url = `/api/feishu/sync-schedule?app_id=${encodeURIComponent(config.appId)}` +
          `&app_secret=${encodeURIComponent(config.appSecret)}` +
          `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
          `&data_source_mode=${encodeURIComponent(dataSourceMode)}` +
          `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources || '')}`;
        
        // 根据数据源模式添加对应的表格ID
        if (dataSourceMode === 'new' && modeConfig.tableIds.requirements1) {
          // 需求表模式：使用需求表1作为同步目标
          url += `&requirement_table_id=${encodeURIComponent(modeConfig.tableIds.requirements1 || '')}`;
        }
        url += `&schedules_table_id=${encodeURIComponent(modeConfig.tableIds.schedules || '')}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: syncTasks }),
        });

        const result = await response.json();
        if (result.success) {
          results.push(`✅ 排期：成功 ${result.stats.success}，失败 ${result.stats.error}`);
        } else {
          results.push(`❌ 排期：${result.error || '未知错误'}`);
        }
      } catch (error) {
        results.push(`❌ 排期：${error instanceof Error ? error.message : '同步失败'}`);
      }
    }

    // 显示汇总结果
    if (results.length > 0) {
      alert(`同步完成！\n\n${results.join('\n')}`);
    } else {
      alert('没有数据可同步或未配置飞书表格 ID');
    }
  };

  // 从飞书加载数据（组件内部使用，Header按钮使用 page.tsx 中的函数）
  const handleLoadFromFeishu = async () => {
    const configStr = localStorage.getItem('feishu-config');
    
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    let config;
    try {
      config = JSON.parse(configStr);
    } catch (e) {
      alert('配置格式错误，请重新配置');
      localStorage.removeItem('feishu-config');
      return;
    }
    
    // 兼容性处理：检测旧配置格式并转换
    if (config.appToken && !config.newMode && !config.legacyMode) {
      const oldTableIds = config.tableIds || {};
      const dataSourceMode = config.dataSourceMode || 'new';
      const requirementsLoadMode = config.requirementsLoadMode || 'all';
      
      config = {
        appId: config.appId,
        appSecret: config.appSecret,
        dataSourceMode: dataSourceMode,
        requirementsLoadMode: requirementsLoadMode,
        newMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            requirements1: oldTableIds.requirements1 || '',
            requirements2: oldTableIds.requirements2 || '',
            schedules: oldTableIds.schedules || '',
          },
        },
        legacyMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            projects: oldTableIds.projects || '',
            tasks: oldTableIds.tasks || '',
            schedules: oldTableIds.schedules || '',
          },
        },
      };
      
      localStorage.setItem('feishu-config', JSON.stringify(config));
    }
    
    // 确保config.newMode存在
    if (!config.newMode) {
      config.newMode = {
        appToken: '',
        tableIds: {
          resources: '',
          requirements1: '',
          requirements2: '',
          schedules: '',
        },
      };
    }
    
    // 确保config.newMode.tableIds存在
    if (!config.newMode.tableIds) {
      config.newMode.tableIds = {
        resources: '',
        requirements1: '',
        requirements2: '',
        schedules: '',
      };
    }
    
    const dataSourceMode = config.dataSourceMode || 'new';
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    const requirementsLoadMode = config.requirementsLoadMode || 'all';
    
    // 详细检查每个字段
    const missingFields = [];
    if (!config.appId) missingFields.push('App ID');
    if (!config.appSecret) missingFields.push('App Secret');
    
    if (dataSourceMode === 'new') {
      if (!config.newMode?.appToken) missingFields.push('需求表模式 App Token');
      if (!config.newMode?.tableIds?.resources) missingFields.push('需求表模式 人员表 ID');
      const loadMode = config.requirementsLoadMode || 'all';
      if ((loadMode === 'all' || loadMode === 'requirements1') && !config.newMode?.tableIds?.requirements1) {
        missingFields.push('需求表模式 需求表1 ID');
      }
      if (loadMode === 'requirements2' && !config.newMode?.tableIds?.requirements2) {
        missingFields.push('需求表模式 需求表2 ID');
      }
    } else {
      if (!config.legacyMode?.appToken) missingFields.push('传统模式 App Token');
      if (!config.legacyMode?.tableIds?.resources) missingFields.push('传统模式 人员表 ID');
      if (!config.legacyMode?.tableIds?.projects) missingFields.push('传统模式 项目表 ID');
      if (!config.legacyMode?.tableIds?.tasks) missingFields.push('传统模式 任务表 ID');
    }
    
    if (missingFields.length > 0) {
      const modeText = dataSourceMode === 'new' ? '需求表模式' : '传统模式';
      console.error('[Feishu Load] 配置不完整，缺少字段:', missingFields);
      alert(`配置不完整！\n\n当前模式: ${modeText}\n缺少的字段:\n${missingFields.map(f => `• ${f}`).join('\n')}\n\n请打开配置对话框填写所有必填项（带红色 * 号）\n\n提示：如果之前保存过配置，请重新打开配置对话框保存一次`);
      return;
    }

    setIsLoadingFromFeishu(true);
    try {
      // 构建请求 URL
      let url = `/api/feishu/load-data?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
        `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources)}` +
        `&data_source_mode=${encodeURIComponent(dataSourceMode)}` +
        `&requirements_load_mode=${encodeURIComponent(requirementsLoadMode)}`;
      
      if (dataSourceMode === 'new') {
        const req1Id = config.newMode.tableIds.requirements1;
        const req2Id = config.newMode.tableIds.requirements2;
        
        if (req1Id && req2Id && req1Id === req2Id) {
          alert('配置错误：需求表1和需求表2的ID相同！');
          setIsLoadingFromFeishu(false);
          return;
        }
        
        if ((requirementsLoadMode === 'all' || requirementsLoadMode === 'requirements1') && req1Id) {
          url += `&requirements1_table_id=${encodeURIComponent(req1Id)}`;
        }
        if ((requirementsLoadMode === 'all' || requirementsLoadMode === 'requirements2') && req2Id) {
          url += `&requirements2_table_id=${encodeURIComponent(req2Id)}`;
        }
      } else {
        url += `&projects_table_id=${encodeURIComponent(config.legacyMode.tableIds.projects)}` +
          `&tasks_table_id=${encodeURIComponent(config.legacyMode.tableIds.tasks)}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        alert(`加载数据失败：${result.error}`);
        return;
      }

      const { resources, projects, tasks } = result.data;
      
      setSharedResources([...resources]);
      setProjects([...projects]);
      setTasks([...tasks]);
      
      // 保存到localStorage，添加数据来源标记
      const dataWithSource = {
        resources,
        projects,
        tasks,
        _source: 'feishu',
        _loadMode: requirementsLoadMode,
        _timestamp: Date.now()
      };
      localStorage.setItem('complex-scenario-resources', JSON.stringify(resources));
      localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
      localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));
      localStorage.setItem('complex-scenario-data-source', JSON.stringify({
        source: 'feishu',
        loadMode: requirementsLoadMode,
        taskCount: tasks.length,
        timestamp: Date.now()
      }));
      
      console.log('[Feishu Load] ✅ 数据已保存到localStorage');
      console.log('[Feishu Load] 当前任务数:', tasks.length);
      console.log('[Feishu Load] 第一个任务:', tasks[0]?.name || '无');

      // 更详细的加载结果提示
      const loadModeText = requirementsLoadMode === 'all' ? '全部' : 
        requirementsLoadMode === 'requirements1' ? '仅需求表1' : '仅需求表2';
      
      let message = `成功从飞书多维表加载数据！\n\n`;
      message += `数据源模式: ${dataSourceMode === 'new' ? '需求表模式' : '传统模式'}\n`;
      if (dataSourceMode === 'new') {
        message += `加载范围: ${loadModeText}\n`;
      }
      message += `人员：${resources.length}\n`;
      message += `项目：${projects.length}\n`;
      message += `任务：${tasks.length}\n`;
      
      if (projects.length === 0 && tasks.length === 0) {
        if (dataSourceMode === 'legacy') {
          message += `\n⚠️ 提示: 当前使用传统模式，请确保：`;
          message += `\n1. 项目表ID和任务表ID填写正确`;
          message += `\n2. 飞书应用有权限访问这些表格`;
          message += `\n\n如使用需求表，请切换到"需求表模式"`;
        } else {
          message += `\n⚠️ 提示: 请确保需求表ID填写正确且有访问权限`;
        }
      }
      
      alert(message);
    } catch (error) {
      console.error('[Feishu Load] 加载异常:', error);
      alert(`加载数据失败：${error instanceof Error ? error.message : '请检查网络连接和配置信息'}`);
    } finally {
      setIsLoadingFromFeishu(false);
    }
  };

  // 同步到飞书（支持同步项目、任务或排期）
  const handleSyncToFeishu = async (syncType?: 'projects' | 'tasks' | 'schedules') => {
    console.log('[Feishu Sync] 开始同步到飞书，类型:', syncType || 'schedules');

    const configStr = localStorage.getItem('feishu-config');
    console.log('[Feishu Sync] 配置字符串:', configStr ? '存在' : '不存在');
    
    if (!configStr) {
      console.log('[Feishu Sync] ❌ 没有飞书配置');
      alert('请先配置飞书集成信息');
      return;
    }

    let config = JSON.parse(configStr);
    
    // 兼容性处理：检测旧配置格式并转换
    if (config.appToken && !config.newMode && !config.legacyMode) {
      console.log('[Feishu Sync] 检测到旧配置格式，自动转换...');
      const oldTableIds = config.tableIds || {};
      const dataSourceMode = config.dataSourceMode || 'new';
      
      config = {
        appId: config.appId,
        appSecret: config.appSecret,
        dataSourceMode: dataSourceMode,
        newMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            requirements1: oldTableIds.requirements1 || '',
            requirements2: oldTableIds.requirements2 || '',
            schedules: oldTableIds.schedules || '',
          },
        },
        legacyMode: {
          appToken: config.appToken,
          tableIds: {
            resources: oldTableIds.resources || '',
            projects: oldTableIds.projects || '',
            tasks: oldTableIds.tasks || '',
            schedules: oldTableIds.schedules || '',
          },
        },
      };
      
      localStorage.setItem('feishu-config', JSON.stringify(config));
      console.log('[Feishu Sync] 配置已转换为新格式');
    }
    
    const dataSourceMode = config.dataSourceMode || 'new';
    const modeConfig = dataSourceMode === 'new' ? config.newMode : config.legacyMode;
    
    console.log('[Feishu Sync] 配置内容:', {
      appId: config.appId,
      appSecret: config.appSecret ? '已填写' : '未填写',
      appToken: modeConfig?.appToken ? '已填写' : '未填写',
      dataSourceMode,
      tableIds: modeConfig?.tableIds,
    });

    // 同步项目（传统模式才有项目表）
    if (syncType === 'projects' || syncType === undefined) {
      if (dataSourceMode === 'new') {
        alert('需求表模式不支持同步项目，请使用传统模式');
        return;
      }
      
      if (!config.legacyMode?.tableIds?.projects) {
        alert('请先在传统模式中配置项目表的 Table ID');
        return;
      }

      if (projects.length === 0) {
        alert('当前没有项目数据');
        return;
      }

      setIsSyncingToFeishu(true);
      try {
        const response = await fetch('/api/feishu/sync-projects-tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projects: projects,
            tasks: [],
            config: {
              appId: config.appId,
              appSecret: config.appSecret,
              appToken: modeConfig.appToken,
              tableIds: {
                projects: modeConfig.tableIds.projects,
                tasks: modeConfig.tableIds.tasks || '',
                resources: modeConfig.tableIds.resources || '',
              },
            },
          }),
        });

        const result = await response.json();
        console.log('[Feishu Sync] 项目同步结果:', result);

        if (result.success) {
          alert(`项目同步成功！\n\n创建: ${result.stats.projects.created}\n更新: ${result.stats.projects.updated}\n失败: ${result.stats.projects.failed}`);
          if (result.errors && result.errors.length > 0) {
            console.error('同步错误详情:', result.errors);
          }
        } else {
          alert(`项目同步失败: ${result.message}`);
        }
      } catch (error) {
        console.error('[Feishu Sync] 项目同步异常:', error);
        alert(`项目同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setIsSyncingToFeishu(false);
      }
      return;
    }

    // 同步任务（传统模式才有任务表）
    if (syncType === 'tasks') {
      if (dataSourceMode === 'new') {
        alert('需求表模式不支持同步任务，请使用传统模式');
        return;
      }
      
      if (!config.legacyMode?.tableIds?.tasks) {
        alert('请先在传统模式中配置任务表的 Table ID');
        return;
      }

      if (tasks.length === 0) {
        alert('当前没有任务数据');
        return;
      }

      setIsSyncingToFeishu(true);
      try {
        // 构建项目ID到名称的映射
        const projectIdToName = new Map<string, string>();
        projects.forEach(p => projectIdToName.set(p.id, p.name));

        // 为每个任务添加 projectName 字段
        const tasksWithProjectName = tasks.map(task => ({
          ...task,
          projectName: projectIdToName.get(task.projectId || '') || ''
        }));

        console.log('[Feishu Sync] 准备同步任务数据:', {
          totalTasks: tasksWithProjectName.length,
          sampleTask: JSON.stringify(tasksWithProjectName[0], null, 2)
        });

        const response = await fetch('/api/feishu/sync-projects-tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projects: [],
            tasks: tasksWithProjectName,
            config: {
              appId: config.appId,
              appSecret: config.appSecret,
              appToken: modeConfig.appToken,
              tableIds: {
                projects: modeConfig.tableIds.projects || '',
                tasks: modeConfig.tableIds.tasks,
                resources: modeConfig.tableIds.resources || '',
              },
            },
          }),
        });

        const result = await response.json();
        console.log('[Feishu Sync] 任务同步结果:', result);

        if (result.success) {
          alert(`任务同步成功！\n\n创建: ${result.stats.tasks.created}\n更新: ${result.stats.tasks.updated}\n失败: ${result.stats.tasks.failed}`);
          if (result.errors && result.errors.length > 0) {
            console.error('同步错误详情:', result.errors);
          }
        } else {
          alert(`任务同步失败: ${result.message}`);
        }
      } catch (error) {
        console.error('[Feishu Sync] 任务同步异常:', error);
        alert(`任务同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setIsSyncingToFeishu(false);
      }
      return;
    }

    // 同步排期（默认行为，不传参数时）
    if (!scheduleResult) {
      console.log('[Feishu Sync] ❌ 没有排期结果');
      alert('请先生成排期结果');
      return;
    }

    if (!modeConfig?.tableIds?.schedules) {
      alert('请先在当前模式中配置排期表的 Table ID');
      return;
    }

    setIsSyncingToFeishu(true);

    try {
      // 准备同步数据 - 直接使用排期结果中的数据
      const syncTasks = scheduleResult.tasks.map(task => {
        const resource = sharedResources.find(r => r.id === task.assignedResources[0]);
        const project = getProjectById(task.projectId || '');
        
        // 项目名称：优先从 project 获取，否则从 projectId 提取（格式：project-项目名）
        let projectName = project?.name || '';
        if (!projectName && task.projectId && task.projectId.startsWith('project-')) {
          projectName = task.projectId.replace('project-', '');
        }
        
        return {
          id: task.id,
          name: task.name,
          // 项目名称
          projectName,
          // 负责人信息
          assignedResourceId: task.assignedResources[0] || '',
          assignedResourceName: resource?.name || '',
          // 排期信息
          startDate: task.startDate ? task.startDate.toISOString() : '',
          endDate: task.endDate ? task.endDate.toISOString() : '',
          estimatedHours: task.estimatedHours,
          estimatedHoursGraphic: task.estimatedHoursGraphic || 0,
          estimatedHoursPost: task.estimatedHoursPost || 0,
          // 状态和优先级
          status: task.status,
          priority: task.priority,
          // 任务类型
          taskType: task.taskType || '',
          subTaskType: task.subTaskType || '',
          // 细分类和语言 - 直接从 task 获取
          subType: task.subType || '',
          language: task.language || '',
          // 截止日期
          deadline: task.deadline ? task.deadline.toISOString() : '',
          suggestedDeadline: task.suggestedDeadline ? task.suggestedDeadline.toISOString() : '',
          // 父任务名称
          parentTaskName: '',
        };
      });

      console.log('[Feishu Sync] 准备同步', syncTasks.length, '个任务');
      console.log('[Feishu Sync] 排期结果第一个任务的所有字段:', JSON.stringify(scheduleResult.tasks[0], null, 2));

      // 调用同步接口 - 使用新的配置结构
      const url = `/api/feishu/sync-schedule?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(modeConfig.appToken)}` +
        `&schedules_table_id=${encodeURIComponent(modeConfig.tableIds.schedules)}` +
        `&resources_table_id=${encodeURIComponent(modeConfig.tableIds.resources || '')}`;
      
      console.log('[Feishu Sync] 同步URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: syncTasks,
        }),
      });

      const result = await response.json();
      console.log('[Feishu Sync] 同步结果:', result);

      if (result.success) {
        alert(`同步成功！\n\n成功: ${result.stats.success}\n失败: ${result.stats.error}`);
        if (result.errors && result.errors.length > 0) {
          console.error('同步错误详情:', result.errors);
        }
      } else {
        alert(`同步失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('[Feishu Sync] 同步异常:', error);
      alert(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSyncingToFeishu(false);
    }
  };

  // AI优化排期
  const handleAiOptimize = async () => {
    if (!scheduleResult || tasks.length === 0) {
      alert('请先生成排期结果');
      return;
    }

    setIsAiOptimizing(true);
    setAiSuggestion('');

    try {
      const response = await fetch('/api/ai-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks,
          resources: sharedResources,
          currentResult: scheduleResult,
        }),
      });

      if (!response.ok) {
        throw new Error('AI优化请求失败');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedText += parsed.content;
                setAiSuggestion(accumulatedText);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('AI优化错误:', error);
      alert('AI优化失败，请稍后重试');
    } finally {
      setIsAiOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">复杂场景</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          多项目并行排期，支持项目管理和资源共享
        </p>
      </div>

      {/* Shared Resource Pool */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" />
                共享人员池
              </CardTitle>
              <CardDescription>
                所有项目共享的人员，系统会根据效率、优先级和工时自动分配
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddResource} size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                添加成员
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {sharedResources.filter(r => r.type === 'human').map(resource => {
              const efficiency = resource.efficiency || 1.0;
              return (
                <div key={resource.id} className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: resource.color }}
                      />
                      <Input
                        value={resource.name}
                        onChange={(e) => handleResourceChange(resource.id, 'name', e.target.value)}
                        className="h-6 w-20 text-sm border-0 bg-transparent px-0 focus:ring-0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteResource(resource.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                  <div className="mb-3">
                    <Select
                      value={resource.workType || 'none'}
                      onValueChange={(value) => handleResourceChange(resource.id, 'workType', value !== 'none' ? value : '')}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未指定</SelectItem>
                        <SelectItem value="平面">平面</SelectItem>
                        <SelectItem value="后期">后期</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>效率:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="50"
                          max="300"
                          value={(efficiency * 100).toFixed(0)}
                          onChange={(e) => handleResourceChange(resource.id, 'efficiency', parseFloat(e.target.value) / 100)}
                          className="h-6 w-16 text-right text-xs"
                        />
                        <span>%</span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 人员效率说明 */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">⚡ 人员效率说明</h4>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <div className="font-medium mb-2">效率系数影响任务实际完成时间：</div>
            <div className="grid gap-2 md:grid-cols-3">
              {(() => {
                // 按效率分组显示，不按等级分组
                const resourcesByEfficiency = sharedResources.filter(r => r.type === 'human');
                if (resourcesByEfficiency.length === 0) return null;

                const sortedResources = [...resourcesByEfficiency].sort((a, b) => {
                  const effA = a.efficiency || 1.0;
                  const effB = b.efficiency || 1.0;
                  return effB - effA;
                });

                const baseHours = 8; // 示例：8小时任务

                return sortedResources.map(resource => {
                  const eff = resource.efficiency || 1.0;
                  const actualHours = baseHours / eff;

                  return (
                    <div key={resource.id} className="flex items-start gap-2">
                      <span className="font-bold">{resource.name}</span>
                      <span>效率{(eff * 100).toFixed(0)}%，{baseHours}小时任务实际用时{actualHours.toFixed(1)}小时</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <strong>说明：</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>效率越高，完成任务用时越短（实际工时 = 预估工时 / 效率）</li>
                <li>甘特图任务条长度反映实际完成时间，高效率人员的任务条更短</li>
                <li>人员分配会综合考虑累计工时和效率，确保负载均衡</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-500" />
              项目管理
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAddProject}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                添加项目
              </Button>
              <Button
                onClick={() => setShowTemplateDialog(true)}
                variant="outline"
                size="sm"
                className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0"
              >
                <FileText className="h-4 w-4" />
                使用模板
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            当前管理 {projects.length} 个并行项目，共享人员池
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>颜色</TableHead>
                  <TableHead>任务数</TableHead>
                  <TableHead>资源数</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map(project => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Input
                        value={project.name}
                        onChange={(e) => handleProjectChange(project.id, 'name', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={project.description || ''}
                        onChange={(e) => handleProjectChange(project.id, 'description', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={project.priority}
                        onValueChange={(value: 'urgent' | 'normal') => handleProjectChange(project.id, 'priority', value)}
                      >
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">普通</SelectItem>
                          <SelectItem value="urgent">紧急</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        value={project.color || '#3b82f6'}
                        onChange={(e) => handleProjectChange(project.id, 'color', e.target.value)}
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tasks.filter(t => t.projectId === project.id).length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {project.resourcePool?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>


      {/* Task Type Tabs */}
      <Tabs value={activeTaskType} onValueChange={(value) => setActiveTaskType(value as 'all' | '平面' | '后期' | '物料')} className="mb-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            全部 ({tasks.filter(task => activeProject === 'all' || task.projectId === activeProject).length})
          </TabsTrigger>
          <TabsTrigger value="平面">
            平面 ({tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '平面').length})
          </TabsTrigger>
          <TabsTrigger value="后期">
            后期 ({tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '后期').length})
          </TabsTrigger>
          <TabsTrigger value="物料">
            物料 ({tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '物料').length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            共享人员: {sharedResources.length} 个
          </Badge>
          <Badge variant="outline" className="gap-1">
            <GitBranch className="h-3 w-3" />
            总任务: {tasks.length} 个
          </Badge>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                添加任务
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleAddTask('平面')}>
                <span className="mr-2">🎨</span>
                添加平面任务
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddTask('后期')}>
                <span className="mr-2">🎬</span>
                添加后期任务
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAddTask('物料')}>
                <span className="mr-2">📦</span>
                添加物料任务
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-3">
            {/* 增量排期选项 */}
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-md border">
              <Checkbox
                id="forceFullReschedule"
                checked={forceFullReschedule}
                onCheckedChange={(checked) => setForceFullReschedule(checked as boolean)}
              />
              <label
                htmlFor="forceFullReschedule"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                title="勾选后，所有任务（包括已完成/进行中的任务）将重新排期；不勾选则保留锁定任务的时间分配"
              >
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                强制完全重新排期
              </label>
            </div>
            <Button
              onClick={() => handleGenerateSchedule()}
              disabled={isComputing}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isComputing ? '计算中...' : '生成综合排期'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoUpdateStatus}
              disabled={!scheduleResult}
              className="gap-2"
              title="根据当前时间和排期自动更新任务状态"
            >
              <Zap className="h-4 w-4" />
              自动更新状态
            </Button>
          </div>
        </div>
      </div>

      {/* Task Management Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-purple-500" />
                任务管理
              </CardTitle>
              <CardDescription>管理所有项目的任务，支持跨项目依赖</CardDescription>
            </div>
            {/* Project Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">项目筛选：</span>
              <Select value={activeProject} onValueChange={setActiveProject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">任务名称</TableHead>
                  <TableHead className="min-w-[160px]">项目</TableHead>
                  <TableHead>任务类型</TableHead>
                  <TableHead className="min-w-[120px]">细分类</TableHead>
                  <TableHead className="min-w-[80px]">语言</TableHead>
                  <TableHead>指定人员</TableHead>
                  <TableHead>
                    {filteredTasks.some(t => t.taskType === '物料') ? '提供时间' : '预估工时'}
                  </TableHead>
                  <TableHead>平面</TableHead>
                  <TableHead>后期</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead className="w-[100px]">依赖</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={getProjectById(task.projectId || '')}
                    projects={projects}
                    tasks={tasks}
                    resourceMap={resourceMap}
                    graphicResources={graphicResources}
                    postResources={postResources}
                    resourcesByWorkType={resourcesByWorkType}
                    sharedResources={sharedResources}
                    activeProject={activeProject}
                    getTaskActualStatus={getTaskActualStatus}
                    isTaskOverdue={isTaskOverdue}
                    onTaskChange={handleTaskChange}
                    onToggleLock={handleToggleTaskLock}
                    onDelete={handleDeleteTask}
                    getProjectById={getProjectById}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Results */}
      {scheduleResult && (
        <Tabs value={activeProject} onValueChange={setActiveProject} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">全部项目</TabsTrigger>
            {projects.map(project => (
              <TabsTrigger key={project.id} value={project.id}>
                {project.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeProject} className="space-y-6">
            {/* View Controls */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={activeView === 'gantt' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveView('gantt')}
                  className="gap-2"
                >
                  <GitBranch className="h-4 w-4" />
                  甘特图
                </Button>
                <Button
                  variant={activeView === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveView('calendar')}
                  className="gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  日历视图
                </Button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>总工期</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.totalDuration} 天</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>总工时</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.totalHours} 小时</CardTitle>
                </CardHeader>
              </Card>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="cursor-pointer" onClick={() => setShowDeadlineWarningDialog(true)}>
                      <CardDescription>截止日期预警</CardDescription>
                      <div className="flex items-baseline gap-2">
                        <CardTitle className={`text-2xl ${overdueCount > 0 ? 'text-red-500' : nearDeadlineCount > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                          {deadlineWarningCount} 个
                        </CardTitle>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 space-y-1">
                        <div>
                          超期：<span className="text-red-500 font-medium">{overdueCount} 个</span>
                        </div>
                        <div>
                          临近：<span className="text-amber-500 font-medium">{nearDeadlineCount} 个</span>
                        </div>
                        <div className="text-slate-400">
                          预警阈值：{deadlineWarningDays} 天
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeadlineSettingsDialog(true)}
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>关键链</CardDescription>
                  <CardTitle className="text-2xl">{scheduleResult.criticalChain.length} 个任务</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Task Type Filter for Gantt/Calendar View */}
            <Tabs value={activeTaskType} onValueChange={(value) => setActiveTaskType(value as 'all' | '平面' | '后期' | '物料')} className="mb-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">全部 ({scheduleResult.tasks.filter(task => activeProject === 'all' || task.projectId === activeProject).length})</TabsTrigger>
                <TabsTrigger value="平面">平面 ({scheduleResult.tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '平面').length})</TabsTrigger>
                <TabsTrigger value="后期">后期 ({scheduleResult.tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '后期').length})</TabsTrigger>
                <TabsTrigger value="物料">物料 ({scheduleResult.tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '物料').length})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View: Gantt or Calendar */}
            {activeView === 'gantt' ? (
              <Card>
                <CardHeader>
                  <CardTitle>多项目综合甘特图</CardTitle>
                  <CardDescription>
                    {activeProject === 'all' ? '所有项目时间线' : getProjectById(activeProject)?.name} 可视化（工作时间：9:30 - 18:30）
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GanttChart
                    scheduleResult={{
                      ...scheduleResult,
                      tasks: scheduleResult.tasks.filter(task =>
                        (activeProject === 'all' || task.projectId === activeProject) &&
                        (activeTaskType === 'all' || task.taskType === activeTaskType)
                      )
                    }}
                    resources={sharedResources}
                    projects={projects.map(p => ({
                      id: p.id,
                      color: p.color || '#3b82f6',
                      name: p.name
                    }))}
                    onTaskClick={openTaskSplitDialog}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>日历视图</CardTitle>
                  <CardDescription>
                    {activeProject === 'all' ? '所有项目时间线' : getProjectById(activeProject)?.name} 日历展示
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CalendarView
                    scheduledTasks={scheduleResult.tasks.filter(task =>
                      (activeProject === 'all' || task.projectId === activeProject) &&
                      (activeTaskType === 'all' || task.taskType === activeTaskType)
                    )}
                    resources={sharedResources}
                    tasks={tasks.filter(task =>
                      (activeProject === 'all' || task.projectId === activeProject) &&
                      (activeTaskType === 'all' || task.taskType === activeTaskType)
                    )}
                    onTaskClick={openTaskSplitDialog}
                  />
                </CardContent>
              </Card>
            )}

            {/* Task Table View */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>排期结果表格</CardTitle>
                      <CardDescription>
                        详细展示任务、负责人、时间段等信息
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleAiOptimize}
                        disabled={isAiOptimizing}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        {isAiOptimizing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {isAiOptimizing ? 'AI分析中...' : 'AI优化排期'}
                      </Button>
                      </div>
                  </div>
                  {/* Task Type Filter */}
                  <Tabs value={activeTaskType} onValueChange={(value) => setActiveTaskType(value as 'all' | '平面' | '后期' | '物料')} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all">
                        全部 ({scheduleResult.tasks.filter(task => activeProject === 'all' || task.projectId === activeProject).length})
                      </TabsTrigger>
                      <TabsTrigger value="平面">
                        平面 ({scheduleResult.tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '平面').length})
                      </TabsTrigger>
                      <TabsTrigger value="后期">
                        后期 ({scheduleResult.tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '后期').length})
                      </TabsTrigger>
                      <TabsTrigger value="物料">
                        物料 ({scheduleResult.tasks.filter(task => (activeProject === 'all' || task.projectId === activeProject) && task.taskType === '物料').length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b">
                        <tr>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">任务名称</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">所属项目</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">任务类型</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">细分类</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">语言</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">负责人</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">开始时间</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">结束时间</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">截止日期</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">工时</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">状态</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {scheduleResult.tasks
                          .filter(task =>
                            (activeProject === 'all' || task.projectId === activeProject) &&
                            (activeTaskType === 'all' || task.taskType === activeTaskType)
                          )
                          .map(task => {
                          const project = getProjectById(task.projectId || '');
                          const resource = sharedResources.find(r => r.id === task.assignedResources[0]);
                          const isCritical = scheduleResult.criticalPath.includes(task.id);

                          return (
                            <tr key={task.id} className="hover:bg-muted/50 border-b transition-colors">
                              <td className="p-2 align-middle whitespace-nowrap font-medium">
                                {task.name}
                                {isCritical && (
                                  <Badge variant="destructive" className="ml-2 text-xs">关键</Badge>
                                )}
                                {task.taskType === '物料' && (
                                  <Badge variant="outline" className="ml-2 text-xs">物料</Badge>
                                )}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">{project?.name || '-'}</td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                <Badge variant={task.taskType === '平面' ? 'default' : task.taskType === '后期' ? 'secondary' : 'outline'}>
                                  {task.taskType || '-'}
                                </Badge>
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap text-sm">{task.subType || '-'}</td>
                              <td className="p-2 align-middle whitespace-nowrap text-sm">{task.language || '-'}</td>
                              <td className="p-2 align-middle whitespace-nowrap min-w-[250px]">
                                {task.taskType === '物料' ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <span>甲方提供</span>
                                    {task.estimatedMaterialDate ? (
                                      <span className="text-xs">
                                        （{formatDateTime(task.estimatedMaterialDate)}）
                                      </span>
                                    ) : (
                                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                        ⚠️ 未填写提供时间
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={task.assignedResources[0] || 'none'}
                                      onValueChange={(value) => handleUpdateTaskResource(task.id, value !== 'none' ? value : '')}
                                    >
                                      <SelectTrigger className="h-8 min-w-[160px]">
                                        <SelectValue>
                                          {resource ? (
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: resource.color }}
                                              />
                                              <span className="text-sm">{resource.name}</span>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 text-sm">未分配</span>
                                          )}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">未分配</SelectItem>
                                        {sharedResources
                                          .filter(r => r.type === 'human' && (!task.taskType || r.workType === task.taskType))
                                          .map(r => (
                                          <SelectItem key={r.id} value={r.id}>
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: r.color }}
                                              />
                                              <span>{r.name}</span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                  </div>
                                )}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.status !== 'completed' && task.startDate ? formatDateTime(task.startDate) : '-'}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.status !== 'completed' && task.endDate ? formatDateTime(task.endDate) : '-'}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.taskType === '物料' ? (
                                  <span className="text-slate-400">-</span>
                                ) : task.deadline ? (
                                  <span className="text-sm">{formatDate(task.deadline)}</span>
                                ) : task.suggestedDeadline ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm text-blue-600">{formatDate(task.suggestedDeadline)}</span>
                                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">建议</Badge>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">{task.estimatedHours}h</td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                                  {task.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>


          </TabsContent>
        </Tabs>
      )}

      {/* 截止日期预警对话框 */}
      <Dialog open={showDeadlineWarningDialog} onOpenChange={setShowDeadlineWarningDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              截止日期预警
            </DialogTitle>
            <div className="flex items-center justify-between mt-2">
              <DialogDescription className="text-base">
                以下任务的结束时间距离截止日期小于 {deadlineWarningDays} 天
              </DialogDescription>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDeadlineWarningDialog(false);
                  setShowDeadlineSettingsDialog(true);
                }}
                className="gap-1"
              >
                <Settings className="h-4 w-4" />
                设置预警天数
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-3">
              {scheduleResult?.tasks
                .filter(task => {
                  if (!task.deadline || !task.endDate) return false;
                  const daysToDeadline = Math.ceil(
                    (task.deadline.getTime() - task.endDate.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return daysToDeadline < deadlineWarningDays;
                })
                .sort((a, b) => {
                  const daysA = Math.ceil(
                    (a.deadline!.getTime() - a.endDate!.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const daysB = Math.ceil(
                    (b.deadline!.getTime() - b.endDate!.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  // 超期任务（days < 0）排在前面，临近任务（days >= 0）排在后面
                  return daysA - daysB;
                })
                .map(task => {
                  const resource = sharedResources.find(r => r.id === task.assignedResources[0]);
                  const project = projects.find(p => p.id === task.projectId);
                  const daysToDeadline = Math.ceil(
                    (task.deadline!.getTime() - task.endDate!.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={task.id}
                      className={`border rounded-lg p-4 ${
                        daysToDeadline < 0
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : daysToDeadline === 0
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-base">{task.name}</h4>
                            {project && (
                              <Badge variant="outline">{project.name}</Badge>
                            )}
                            {daysToDeadline < 0 && (
                              <Badge variant="destructive">超期</Badge>
                            )}
                            {daysToDeadline === 0 && (
                              <Badge className="bg-orange-500 hover:bg-orange-600">今日截止</Badge>
                            )}
                            {daysToDeadline > 0 && daysToDeadline < 3 && (
                              <Badge className="bg-amber-500 hover:bg-amber-600">剩余 {daysToDeadline} 天</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-600 dark:text-slate-400">负责人：</span>
                              <span className="font-medium ml-1">
                                {resource ? resource.name : '未分配'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-400">预估工时：</span>
                              <span className="font-medium ml-1">{task.estimatedHours}h</span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-400">结束时间：</span>
                              <span className="font-medium ml-1">
                                {task.endDate ? formatDateTime(task.endDate) : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-400">截止日期：</span>
                              <span className="font-medium ml-1">
                                {formatDateToInputValue(task.deadline)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* 拆分任务按钮 - 只有超期任务才显示，并且不允许拆分已被拆分过的任务 */}
                        {daysToDeadline < 0 && !task.id.includes('-sub-') && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation(); // 防止事件冒泡
                              openTaskSplitDialog(task);
                            }}
                            className="gap-1"
                          >
                            <Users className="h-4 w-4" />
                            拆分任务
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowDeadlineWarningDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 截止日期预警设置对话框 */}
      <Dialog open={showDeadlineSettingsDialog} onOpenChange={setShowDeadlineSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              设置截止日期预警天数
            </DialogTitle>
            <DialogDescription>
              设置任务结束时间距离截止日期多少天时触发预警
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="warning-days" className="text-sm font-medium">
                预警天数
              </label>
              <div className="flex items-center gap-3">
                <Input
                  id="warning-days"
                  type="number"
                  min="1"
                  max="30"
                  value={deadlineWarningDays}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 1 && value <= 30) {
                      setDeadlineWarningDays(value);
                    }
                  }}
                  className="w-20"
                />
                <span className="text-sm text-slate-600">天</span>
              </div>
              <p className="text-xs text-slate-500">
                当任务结束时间距离截止日期小于设定的天数时，系统会显示预警
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">常用设置：</p>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 5, 7, 10, 14].map(days => (
                  <Button
                    key={days}
                    variant={deadlineWarningDays === days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDeadlineWarningDays(days)}
                  >
                    {days} 天
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadlineSettingsDialog(false)}>
              取消
            </Button>
            <Button onClick={() => setShowDeadlineSettingsDialog(false)}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 人员冲突处理对话框 */}
      <ConflictResolutionDialog
        isOpen={conflictDialogOpen}
        conflicts={pendingConflicts}
        onConfirm={handleConflictResolution}
        onClose={() => setConflictDialogOpen(false)}
      />

      {/* 任务拆分对话框 */}
      <TaskSplitDialog
        task={selectedTaskForSplit}
        resources={sharedResources}
        isOpen={showTaskSplitDialog}
        onClose={() => setShowTaskSplitDialog(false)}
        onConfirm={handleTaskSplit}
      />

      {/* 飞书集成对话框 */}
      <FeishuIntegrationDialog
        open={showFeishuDialog}
        onOpenChange={setShowFeishuDialog}
        onSync={handleFeishuDialogSync}
      />

      {/* 模板创建对话框 */}
      <TemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onProjectCreated={handleProjectFromTemplate}
      />
    </div>
  );
}
