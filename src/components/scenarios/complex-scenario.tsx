'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ExcelTemplateGenerator from '@/components/excel-template-generator';
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
import { Play, GitBranch, Users, AlertTriangle, CheckCircle2, Network, Plus, Trash2, Settings, Download, Sparkles, Loader2, Calendar, MoreVertical, Globe, FileText } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import * as XLSX from 'xlsx';
import { defaultWorkingHours } from '@/lib/sample-data';
import { Task, ScheduleResult, Project, Resource, ResourceLevel, ResourceConflictStrategy, ConflictTask } from '@/types/schedule';
import GanttChart from '@/components/gantt-chart';
import { CalendarView } from '@/components/views/calendar-view';
import { ConflictResolutionDialog } from '@/components/conflict-resolution-dialog';
import { TaskSplitDialog } from '@/components/task-split-dialog';
import { detectResourceConflicts } from '@/lib/schedule-algorithms';
import FeishuIntegrationDialog from '@/components/feishu-integration-dialog';
import TemplateDialog from '@/components/template-dialog';

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
    deadline: new Date('2024-04-30T18:30:00'),
    resourcePool: ['res-1', 'res-2', 'res-3', 'res-4'],
    color: '#3b82f6',
    tasks: []
  },
  {
    id: 'proj-2',
    name: '广告片项目',
    description: '产品广告视频制作',
    priority: 'urgent',
    deadline: new Date('2024-05-15T18:30:00'),
    resourcePool: ['res-1', 'res-3'],
    color: '#10b981',
    tasks: []
  },
  {
    id: 'proj-3',
    name: '纪录片项目',
    description: '企业纪录片制作',
    priority: 'normal',
    deadline: new Date('2024-06-01T18:30:00'),
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

  // 标记是否需要强制生成排期（用于任务拆分后立即生成）
  const forceGenerateSchedule = useRef(false);

  // 全局任务ID计数器，确保ID唯一
  const taskIdCounter = useRef(Date.now());

  // 使用 ref 跟踪是否已经加载过数据，避免重复加载
  const hasLoadedData = useRef(false);

  // 数据加载：只在组件首次挂载时执行
  useEffect(() => {
    // 如果已经加载过数据，则不再加载
    if (hasLoadedData.current) return;
    
    hasLoadedData.current = true;

    const savedProjects = localStorage.getItem('complex-scenario-projects');
    const savedTasks = localStorage.getItem('complex-scenario-tasks');
    const savedResources = localStorage.getItem('complex-scenario-resources');
    const savedScheduleResult = localStorage.getItem('complex-scenario-schedule-result');

    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      // 将日期字符串转换回 Date 对象
      const projectsWithDates = parsed.map((p: Project) => {
        const deadline = p.deadline ? new Date(p.deadline) : undefined;
        // 统一将截止日期时间设置为18:30:00（下班时间）
        if (deadline) {
          deadline.setHours(18, 30, 0, 0);
        }
        return {
          ...p,
          deadline,
          startDate: p.startDate ? new Date(p.startDate) : undefined
        };
      });
      setProjects(projectsWithDates);
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
        
        return {
          ...t,
          deadline,
          startDate: t.startDate ? new Date(t.startDate) : undefined,
          endDate: t.endDate ? new Date(t.endDate) : undefined,
          dependencies: validDependencies
        };
      });
      setTasks(tasksWithDates);
    }
    if (savedResources) {
      setSharedResources(JSON.parse(savedResources));
    }
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
        projects: parsed.projects.map((p: Project) => {
          const deadline = p.deadline ? new Date(p.deadline) : undefined;
          // 统一将截止日期时间设置为18:30:00（下班时间）
          if (deadline) {
            deadline.setHours(18, 30, 0, 0);
          }
          return {
            ...p,
            deadline,
            startDate: p.startDate ? new Date(p.startDate) : undefined
          };
        })
      };
      setScheduleResult(scheduleResultWithDates);
    }
  }, []);

  useEffect(() => {
    // 始终保存数据，即使数量为0也要保存
    localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
    
    // 保存任务时，保留所有 assignedResources（包括手动分配的）
    // 在下次重新生成排期时，autoAssignResources 会清除并重新分配
    localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));
    
    localStorage.setItem('complex-scenario-resources', JSON.stringify(sharedResources));
    if (scheduleResult) {
      localStorage.setItem('complex-scenario-schedule-result', JSON.stringify(scheduleResult));
    }
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

  const handleGenerateSchedule = (force = false, tasksOverride?: Task[]) => {
    const tasksToUse = tasksOverride || tasks;
    console.log('[ComplexScenario] handleGenerateSchedule called, force:', force, 'tasks count:', tasksToUse.length);

    // 检查是否有物料任务未填写提供时间
    const materialTasksWithoutDate = tasksToUse.filter(t => t.taskType === '物料' && !t.estimatedMaterialDate);
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
        const result = generateSchedule(tasksToUse, sharedResources, new Date(), defaultWorkingHours, conflictStrategy, savedResolutions);
        setScheduleResult(result);

        // 基于新生成的排期结果重新检测冲突，更新 pendingConflicts
        const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
        setPendingConflicts(newConflicts);

        setIsComputing(false);
      }, 500);
      return;
    }

    // 如果强制生成，跳过冲突检测
    if (force) {
      setTimeout(() => {
        console.log('[ComplexScenario] 强制生成排期（跳过冲突检测）');
        const result = generateSchedule(tasksToUse, sharedResources, new Date(), defaultWorkingHours, conflictStrategy);
        setScheduleResult(result);

        // 基于 scheduleResult 重新检测冲突，确保 pendingConflicts 同步
        const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
        setPendingConflicts(newConflicts);

        setIsComputing(false);
      }, 500);
      return;
    }

    // 否则，检测资源冲突（始终使用当前正在编辑的任务列表）
    const conflicts = detectResourceConflicts(tasksToUse, sharedResources, undefined);

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
        const result = generateSchedule(tasksToUse, sharedResources, new Date(), defaultWorkingHours, conflictStrategy);
        setScheduleResult(result);

        // 基于 scheduleResult 重新检测冲突，确保 pendingConflicts 同步
        const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
        setPendingConflicts(newConflicts);

        setIsComputing(false);
      }, 500);
    }
  };

  const handleConflictResolution = (resolutions: Map<string, 'switch' | 'delay'>) => {
    setIsComputing(true);
    setJustResolvedConflict(true); // 标记刚刚解决了冲突
    setSavedResolutions(resolutions); // 保存用户的选择
    setTimeout(() => {
      // 根据用户的选择生成排期
      const result = generateSchedule(tasks, sharedResources, new Date(), defaultWorkingHours, conflictStrategy, resolutions);
      setScheduleResult(result);

      // 基于新生成的排期结果重新检测冲突
      const newConflicts = detectResourceConflicts(result.tasks, sharedResources, undefined);
      setPendingConflicts(newConflicts);

      setIsComputing(false);
    }, 500);
  };

  const handleTaskChange = (taskId: string, field: keyof Task, value: any) => {
    setJustResolvedConflict(false); // 任务变更，重置冲突解决标记
    setSavedResolutions(null); // 重置保存的解决方案
    setPendingConflicts(new Map()); // 清除待处理的冲突

    setTasks(tasks.map(t => {
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
        const fixedResource = sharedResources.find(r => r.id === t.fixedResourceId);
        if (fixedResource && fixedResource.workType !== value) {
          // 指定的资源类型与新的任务类型不匹配，清除指定资源
          console.log(`任务 ${t.name} 的类型从 ${t.taskType} 改为 ${value}，清除指定的资源 ${fixedResource.name}`);
          return { ...t, [field]: value, fixedResourceId: undefined };
        }
      }

      return { ...t, [field]: value };
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setShowDeadlineWarningDialog(false); // 关闭预警弹窗
    setJustResolvedConflict(false); // 任务变更，重置冲突解决标记
    setSavedResolutions(null); // 重置保存的解决方案
    setPendingConflicts(new Map()); // 清除待处理的冲突

    // 同时从其他任务的依赖中移除该任务，然后删除任务本身
    const updatedTasks = tasks
      .map(t => ({
        ...t,
        dependencies: t.dependencies?.filter(d => d !== taskId)
      }))
      .filter(t => t.id !== taskId);

    setTasks(updatedTasks);
  };

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
      taskType
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
    // 如果修改的是截止日期，将时间设置为18:30（下班时间）
    const WORK_END_HOUR = 18.5; // 18:30
    if (field === 'deadline' && value instanceof Date) {
      const deadline = new Date(value);
      deadline.setHours(WORK_END_HOUR, 30, 0, 0); // 设置为18:30:00
      value = deadline;
    }
    setProjects(projects.map(p => p.id === projectId ? { ...p, [field]: value } : p));
    
    // 如果修改的是项目优先级，同步更新所有子任务的优先级
    if (field === 'priority' && (value === 'urgent' || value === 'normal')) {
      setTasks(tasks.map(t => 
        t.projectId === projectId ? { ...t, priority: value } : t
      ));
    }
  };

  const filteredTasks = activeProject === 'all' 
    ? tasks 
    : tasks.filter(t => t.projectId === activeProject);

  const getProjectById = (projectId: string) => {
    return projects.find(p => p.id === projectId);
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
        '负责人等级': resource ? (resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理') : '-',
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
    await handleSyncToFeishu();
  };

  // 从飞书加载数据
  const handleLoadFromFeishu = async () => {
    console.log('[Feishu Load] 开始从飞书加载数据');

    const configStr = localStorage.getItem('feishu-config');
    if (!configStr) {
      alert('请先配置飞书集成信息');
      return;
    }

    const config = JSON.parse(configStr);
    if (!config.appId || !config.appSecret || !config.appToken ||
        !config.tableIds?.resources || !config.tableIds?.projects || !config.tableIds?.tasks) {
      alert('飞书配置不完整，请填写 App ID、App Secret、App Token 和所有 Table ID');
      return;
    }

    setIsLoadingFromFeishu(true);
    try {
      const response = await fetch(
        `/api/feishu/load-data?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(config.appToken)}` +
        `&resources_table_id=${encodeURIComponent(config.tableIds.resources)}` +
        `&projects_table_id=${encodeURIComponent(config.tableIds.projects)}` +
        `&tasks_table_id=${encodeURIComponent(config.tableIds.tasks)}`
      );

      const result = await response.json();
      console.log('[Feishu Load] 加载结果:', result);

      if (!result.success) {
        alert(`加载数据失败：${result.error}`);
        return;
      }

      const { resources, projects, tasks } = result.data;
      setSharedResources(resources);
      setProjects(projects);
      setTasks(tasks);
      localStorage.setItem('complex-scenario-resources', JSON.stringify(resources));
      localStorage.setItem('complex-scenario-projects', JSON.stringify(projects));
      localStorage.setItem('complex-scenario-tasks', JSON.stringify(tasks));

      alert(`成功从飞书多维表加载数据！\n\n人员：${resources.length}\n项目：${projects.length}\n任务：${tasks.length}`);
    } catch (error) {
      console.error('[Feishu Load] 加载异常:', error);
      alert(`加载数据失败：${error instanceof Error ? error.message : '请检查网络连接和配置信息'}`);
    } finally {
      setIsLoadingFromFeishu(false);
    }
  };

  // 同步到飞书
  const handleSyncToFeishu = async () => {
    console.log('[Feishu Sync] 开始同步到飞书');

    const configStr = localStorage.getItem('feishu-config');
    console.log('[Feishu Sync] 配置字符串:', configStr ? '存在' : '不存在');

    if (!configStr) {
      console.log('[Feishu Sync] ❌ 没有飞书配置');
      alert('请先配置飞书集成信息');
      return;
    }

    const config = JSON.parse(configStr);
    console.log('[Feishu Sync] 配置内容:', {
      appId: config.appId,
      appSecret: config.appSecret ? '已填写' : '未填写',
      appToken: config.appToken ? '已填写' : '未填写',
      tableIds: config.tableIds,
    });

    // 验证配置是否完整
    if (!config.appId || !config.appSecret || !config.appToken) {
      console.log('[Feishu Sync] ❌ 飞书配置不完整:', {
        appId: !!config.appId,
        appSecret: !!config.appSecret,
        appToken: !!config.appToken,
      });
      alert('飞书配置不完整，请填写 App ID、App Secret 和 App Token');
      return;
    }

    // 至少需要一个 Table ID 才能同步
    const hasAnyTableId = config.tableIds?.resources || config.tableIds?.projects ||
                          config.tableIds?.tasks || config.tableIds?.schedules;

    if (!hasAnyTableId) {
      console.log('[Feishu Sync] ❌ 未配置任何 Table ID');
      alert('请至少配置一个表的 Table ID（人员、项目、任务或排期表）');
      return;
    }

    setIsSyncingToFeishu(true);

    try {
      // 准备同步数据
      const syncResources = sharedResources.map(resource => ({
        ...resource,
      }));

      const syncProjects = projects.map(project => ({
        ...project,
      }));

      const syncTasks = tasks.map(task => {
        const resource = sharedResources.find(r => r.id === task.assignedResources[0]);
        const project = getProjectById(task.projectId || '');

        return {
          id: task.id,
          name: task.name,
          description: task.description,
          estimatedHours: task.estimatedHours,
          assignedResources: task.assignedResources,
          deadline: task.deadline ? task.deadline.toISOString() : undefined,
          priority: task.priority,
          status: task.status,
          taskType: task.taskType,
          projectId: task.projectId,
          dependencies: task.dependencies,
          // 排期信息（如果有）
          startDate: task.startDate ? task.startDate.toISOString() : undefined,
          endDate: task.endDate ? task.endDate.toISOString() : undefined,
        };
      });

      console.log('[Feishu Sync] 准备同步数据:', {
        人员: syncResources.length,
        项目: syncProjects.length,
        任务: syncTasks.length,
      });
      console.log('[Feishu Sync] Table ID 配置:', {
        人员表: config.tableIds?.resources || '未配置（将跳过）',
        项目表: config.tableIds?.projects || '未配置（将跳过）',
        任务表: config.tableIds?.tasks || '未配置（将跳过）',
        排期表: config.tableIds?.schedules || '未配置（将跳过）',
      });

      // 显示同步提示
      const tablesToSync = [];
      if (config.tableIds?.resources) tablesToSync.push('人员表');
      if (config.tableIds?.projects) tablesToSync.push('项目表');
      if (config.tableIds?.tasks) tablesToSync.push('任务表');
      if (config.tableIds?.schedules) tablesToSync.push('排期表');

      if (tablesToSync.length === 0) {
        alert('请至少配置一个表的 Table ID 才能同步数据！');
        setIsSyncingToFeishu(false);
        return;
      }

      const confirmMsg = `即将同步以下数据到飞书：\n\n${tablesToSync.join('、')}\n\n是否继续？`;
      if (!confirm(confirmMsg)) {
        setIsSyncingToFeishu(false);
        return;
      }

      // 调用同步接口
      const url = `/api/feishu/sync-all?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(config.appToken)}` +
        `&resources_table_id=${encodeURIComponent(config.tableIds?.resources || '')}` +
        `&projects_table_id=${encodeURIComponent(config.tableIds?.projects || '')}` +
        `&tasks_table_id=${encodeURIComponent(config.tableIds?.tasks || '')}` +
        `&schedules_table_id=${encodeURIComponent(config.tableIds?.schedules || '')}`;

      console.log('[Feishu Sync] 同步URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resources: syncResources,
          projects: syncProjects,
          tasks: syncTasks,
        }),
      });

      const result = await response.json();
      console.log('[Feishu Sync] 同步结果:', result);

      if (result.success) {
        const { stats } = result;

        // 构建详细的成功/失败信息
        let message = '同步完成！\n\n';

        const sections = [
          { name: '人员', stats: stats.resources, enabled: !!config.tableIds?.resources },
          { name: '项目', stats: stats.projects, enabled: !!config.tableIds?.projects },
          { name: '任务', stats: stats.tasks, enabled: !!config.tableIds?.tasks },
          { name: '排期', stats: stats.schedules, enabled: !!config.tableIds?.schedules },
        ];

        sections.forEach(section => {
          if (section.enabled && section.stats) {
            message += `${section.name}: 成功 ${section.stats.success}, 失败 ${section.stats.error}\n`;
          }
        });

        // 检查是否有 UserFieldConvFail 错误（字段类型错误）
        const hasFieldTypeError = result.errors && result.errors.some((err: string) =>
          err.includes('UserFieldConvFail') || err.includes('1254066')
        );

        if (hasFieldTypeError) {
          message += '\n⚠️ 部分数据因字段类型问题同步失败\n';
          message += '请点击下方按钮查看修复指南：\n\n';
          message += '[查看飞书表结构修复指南]';
        }

        alert(message);

        if (result.errors && result.errors.length > 0) {
          console.error('同步错误详情:', result.errors);

          // 如果有字段类型错误，打开修复指南
          if (hasFieldTypeError) {
            window.open('/docs/feishu-table-fix-guide.md', '_blank');
          }
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
      {/* 页面标题和导出按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">复杂场景</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            多项目并行排期，支持项目管理和资源共享
          </p>
        </div>
        <ExcelTemplateGenerator scenario="complex" />
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
                  <div className="mb-3">
                    <Select
                      value={resource.level || 'junior'}
                      onValueChange={(value: ResourceLevel) => handleResourceChange(resource.id, 'level', value)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistant">助理</SelectItem>
                        <SelectItem value="junior">初级</SelectItem>
                        <SelectItem value="senior">高级</SelectItem>
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
                    <div className="flex items-center justify-between">
                      <span>可用性:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          max="100"
                          value={(resource.availability * 100).toFixed(0)}
                          onChange={(e) => handleResourceChange(resource.id, 'availability', parseFloat(e.target.value) / 100)}
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
                  const efficiencyLabel = eff >= 1.5 ? '高' : eff >= 1.0 ? '中' : '低';
                  const colorClass = eff >= 1.5 ? 'text-purple-500' : eff >= 1.0 ? 'text-blue-500' : 'text-slate-500';

                  return (
                    <div key={resource.id} className="flex items-start gap-2">
                      <span className={`${colorClass} font-bold min-w-[60px]}`}>{resource.name}</span>
                      <span>效率{(eff * 100).toFixed(0)}%，{baseHours}小时任务实际用时{actualHours.toFixed(1)}小时（{efficiencyLabel}效率）</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <strong>说明：</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>效率越高，完成任务用时越短（实际工时 = 预估工时 / 效率）</li>
                <li>等级（高级/初级/助理）仅作为默认效率值的参考，可以自定义</li>
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
                  <TableHead>开始日期</TableHead>
                  <TableHead>截止日期</TableHead>
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
                        type="datetime-local"
                        value={formatDateTimeToInputValue(project.startDate)}
                        onChange={(e) => handleProjectChange(project.id, 'startDate', new Date(e.target.value))}
                        className="w-40 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={formatDateToInputValue(project.deadline)}
                        onChange={(e) => handleProjectChange(project.id, 'deadline', new Date(e.target.value))}
                        className="w-36 h-8"
                      />
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
          <Button
            onClick={() => handleGenerateSchedule()}
            disabled={isComputing}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isComputing ? '计算中...' : '生成综合排期'}
          </Button>
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
                  <TableHead className="w-[250px]">任务名称</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>任务类型</TableHead>
                  <TableHead>指定人员</TableHead>
                  <TableHead>
                    {tasks.filter(t =>
                      (activeProject === 'all' || t.projectId === activeProject) &&
                      (activeTaskType === 'all' || t.taskType === activeTaskType)
                    ).some(t => t.taskType === '物料') ? '工时/提供时间' : '预估工时'}
                  </TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>依赖任务</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.filter(task =>
                  (activeProject === 'all' || task.projectId === activeProject) &&
                  (activeTaskType === 'all' || task.taskType === activeTaskType)
                ).map(task => {
                  const project = getProjectById(task.projectId || '');

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Input
                          value={task.name}
                          onChange={(e) => handleTaskChange(task.id, 'name', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.projectId || 'none'}
                          onValueChange={(value) => handleTaskChange(task.id, 'projectId', value !== 'none' ? value : '')}
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
                        <Select
                          value={task.taskType || 'none'}
                          onValueChange={(value) => handleTaskChange(task.id, 'taskType', value !== 'none' ? value : '')}
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
                      </TableCell>
                      <TableCell>
                        {task.taskType === '物料' ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <Select
                            value={task.fixedResourceId || 'none'}
                            onValueChange={(value) => handleTaskChange(task.id, 'fixedResourceId', value !== 'none' ? value : undefined)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder={task.taskType ? "选择人员" : "先选择任务类型"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">自动分配</SelectItem>
                              {task.taskType ? (
                                sharedResources.filter(r => r.workType === task.taskType).map(resource => (
                                  <SelectItem key={resource.id} value={resource.id}>
                                    {resource.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-xs text-slate-500">
                                  请先选择任务类型
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
                                onChange={(e) => handleTaskChange(task.id, 'estimatedMaterialDate', new Date(e.target.value))}
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
                          <TableCell>
                            <span className="text-slate-400">-</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-slate-400">-</span>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Input
                              type="number"
                              value={task.estimatedHours}
                              onChange={(e) => handleTaskChange(task.id, 'estimatedHours', parseInt(e.target.value))}
                              className="w-24 h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={task.priority}
                              onValueChange={(value) => handleTaskChange(task.id, 'priority', value)}
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
                            {(task.taskType as string) === '物料' ? (
                              <span className="text-slate-400">-</span>
                            ) : (
                              <div className="space-y-1">
                                <Input
                                  type="date"
                                  value={formatDateToInputValue(task.deadline)}
                                  onChange={(e) => handleTaskChange(task.id, 'deadline', new Date(e.target.value))}
                                  className="w-36 h-8"
                                />
                                <p className="text-[10px] text-slate-500">默认到当天18:30</p>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value=""
                                onValueChange={(value) => {
                                  if (value && !task.dependencies?.includes(value)) {
                                    const newDeps = [...(task.dependencies || []), value];
                                    handleTaskChange(task.id, 'dependencies', newDeps);
                                  }
                                }}
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
                                          onClick={() => {
                                            const newDeps = task.dependencies!.filter(id => id !== depId);
                                            handleTaskChange(task.id, 'dependencies', newDeps);
                                          }}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                                              <span className="text-xs text-slate-500">
                                                ({r.level === 'senior' ? '高级' : r.level === 'junior' ? '初级' : '助理'})
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {resource && (
                                      <Badge className={getLevelBadgeColor(resource.level || 'junior')} variant="secondary" style={{ fontSize: '10px', padding: '2px 6px' }} title={resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理'}>
                                        {resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理'}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.startDate ? formatDateTime(task.startDate) : '-'}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.endDate ? formatDateTime(task.endDate) : '-'}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.taskType === '物料' ? (
                                  <span className="text-slate-400">-</span>
                                ) : task.deadline ? (
                                  formatDate(task.deadline)
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
